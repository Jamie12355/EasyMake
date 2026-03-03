// Executes the pipeline for user-defined scenes (fires Luma + TTS)
// Called after the user finalizes their storyboard in the Plan phase

// Hardcoded fallbacks so env vars never cause URL parse errors
const LLM_BASE_URL = process.env.VITE_LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_API_KEY = process.env.VITE_LLM_API_KEY || '';
const LLM_MODEL = process.env.VITE_LLM_MODEL || 'deepseek-chat';
const VIDEO_API_KEY = process.env.VITE_VIDEO_API_KEY || '';
const VIDEO_MODEL = process.env.VITE_VIDEO_MODEL || 'ray-2';

async function fireLumaVideo(prompt) {
    const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VIDEO_API_KEY}`
        },
        body: JSON.stringify({
            prompt,
            model: VIDEO_MODEL,
            aspect_ratio: '9:16',
            loop: false
        })
    });
    if (!res.ok) throw new Error(`Luma Error: ${await res.text()}`);
    const data = await res.json();
    return data.id;
}

import jwt from 'jsonwebtoken';

function generateKlingToken() {
    const ak = process.env.VITE_KLING_AK || 'ALAnrRPrhAb9dfmLgKyKBnYBtJmAeDCM';
    const sk = process.env.VITE_KLING_SK || 'YghMPk3NgnY4JrtBJrNbCDkPDPyrdy88';
    return jwt.sign(
        {
            iss: ak,
            exp: Math.floor(Date.now() / 1000) + 1800,
            nbf: Math.floor(Date.now() / 1000) - 5
        },
        sk,
        { header: { alg: 'HS256', typ: 'JWT' } }
    );
}

async function fireKlingVideo(prompt) {
    const token = generateKlingToken();
    const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            model_name: "kling-v1",
            prompt,
            duration: "5",
            aspect_ratio: "9:16"
        })
    });

    const data = await res.json();
    if (data.code !== 0 || !data.data?.task_id) {
        throw new Error(`Kling Error: ${JSON.stringify(data)}`);
    }

    return `kling_${data.data.task_id}`;
}

async function fireVideoGeneration(prompt) {
    try {
        console.log('[fireVideoGeneration] Attempting Kling AI first...');
        return await fireKlingVideo(prompt);
    } catch (e) {
        console.warn('[fireVideoGeneration] Kling failed, falling back to Luma:', e.message);
        return await fireLumaVideo(prompt);
    }
}

export const config = {
    maxDuration: 60, // Luma Ray 2 queue can be slow, giving Vercel fn max time
};

import { put } from '@vercel/blob';

// --- API Helper Functions ---
async function generateMiniMaxTTS(text, groupId, apiKey) {
    const res = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${groupId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'speech-02-hd',
            text: text,
            stream: false,
            voice_setting: {
                voice_id: 'male-qn-qingse',
                speed: 1.0,
                vol: 1.0,
                pitch: 0
            },
            audio_setting: {
                audio_sample_rate: 32000,
                bitrate: 128000,
                format: 'mp3',
                channel: 1
            }
        })
    });
    const data = await res.json();
    const hex = data.data?.audio;
    if (!hex) throw new Error(`MiniMax Error: ${JSON.stringify(data.base_resp)}`);
    const bytes = Buffer.from(hex, 'hex');
    return `data:audio/mp3;base64,${bytes.toString('base64')}`;
}

// Auto-generate a Luma prompt from TTS text if user didn't provide one
async function autoGenerateLumaPrompt(ttsText, sceneLabel) {
    // Fallback prompt in case LLM call fails
    const fallbackPrompt = `Cinematic 9:16 vertical video, study abroad theme, Chinese university student holding acceptance letter, modern campus background, golden hour lighting, slow zoom in camera, mixed media scrapbook style, vivid colors`;

    try {
        if (!LLM_API_KEY) return fallbackPrompt;

        const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_API_KEY}`
            },
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `Generate a single highly detailed English visual prompt for Luma Ray 2 (9:16 vertical format) based on a Chinese short video script line. The prompt must be cinematic, study abroad themed, and include camera movement, lighting, and aesthetic style. Return ONLY the prompt text, nothing else.`
                    },
                    {
                        role: 'user',
                        content: `Script: "${ttsText}" | Scene role: ${sceneLabel}`
                    }
                ],
                temperature: 0.8,
                max_tokens: 150
            })
        });
        if (!res.ok) return fallbackPrompt;
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || fallbackPrompt;
    } catch (e) {
        console.warn('[autoGenerateLumaPrompt] Failed, using fallback:', e.message);
        return fallbackPrompt;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { scenes } = req.body;
    const minimaxGroupId = process.env.MINIMAX_GROUP_ID;
    const minimaxApiKey = process.env.MINIMAX_API_KEY;

    if (!minimaxGroupId || !minimaxApiKey) {
        return res.status(500).json({ error: 'MiniMax TTS not configured in environment variables.' });
    }

    try {
        const enrichedScenes = await Promise.all(scenes.map(async (scene) => {
            // If no luma_prompt provided, auto-generate one from the tts_text
            const lumaPrompt = scene.luma_prompt?.trim()
                ? scene.luma_prompt
                : await autoGenerateLumaPrompt(scene.tts_text, scene.scene_label || 'Main Scene');

            const [lumaId, ttsAudioBase64] = await Promise.all([
                fireVideoGeneration(lumaPrompt),
                generateMiniMaxTTS(scene.tts_text, minimaxGroupId, minimaxApiKey)
            ]);

            // Convert Base64 data URI to Buffer for Blob upload
            const base64Data = ttsAudioBase64.split(',')[1] || ttsAudioBase64;
            const audioBuffer = Buffer.from(base64Data, 'base64');

            // Upload to Vercel Blob to get a public URL for Shotstack
            const blobUpload = await put(`tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`, audioBuffer, {
                access: 'public',
                contentType: 'audio/mp3'
            });

            return {
                ...scene,
                luma_prompt: lumaPrompt,
                luma_job_id: lumaId,
                tts_audio: ttsAudioBase64,       // Keeping base64 just in case frontend still wants to play it
                tts_audio_url: blobUpload.url,   // NEW: The public URL for Shotstack
                video_url: null,
                status: 'rendering'
            };
        }));


        return res.status(200).json({ scenes: enrichedScenes });
    } catch (error) {
        console.error('[Execute Pipeline] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
