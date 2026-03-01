import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const MAX_DURATION = 240; // seconds (4 min, Vercel Pro/Hobby limit)

async function generateScript(idea, advanced = {}) {
    const res = await fetch(`${process.env.VITE_LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VITE_LLM_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.VITE_LLM_MODEL || 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert Chinese short-video scriptwriter (15-60 second vertical 9:16 videos) for top-tier 留学 study abroad agencies.

Your job is to break a concept into a 3-scene video storyboard in JSON format.

Each scene must have:
- scene_id: integer (1, 2, 3)
- scene_label: string (e.g. "Hook", "Main Message", "Call to Action")
- tts_text: A short, punchy Chinese sentence (max 25 Chinese characters) to be spoken aloud as voiceover for this scene.
- luma_prompt: An extremely detailed English visual prompt engineered for Luma Ray 2 (9:16 vertical format). Include: subject, action, camera movement, lighting, aesthetic style, motion dynamics. Emphasize text overlays, kinetic typography, and bold visual storytelling.
- duration_seconds: estimated duration 4-7 seconds based on tts_text length.

FORMAT: Return ONLY raw JSON array with no markdown. No extra text. Example:
[
  { "scene_id": 1, "scene_label": "Hook", "tts_text": "...", "luma_prompt": "...", "duration_seconds": 5 },
  { "scene_id": 2, "scene_label": "Main Message", "tts_text": "...", "luma_prompt": "...", "duration_seconds": 6 },
  { "scene_id": 3, "scene_label": "Call to Action", "tts_text": "...", "luma_prompt": "...", "duration_seconds": 4 }
]`
                },
                {
                    role: 'user',
                    content: `Create a 3-scene video storyboard for this idea: ${idea}
${advanced.bgInfo ? `Agency background: ${advanced.bgInfo}` : ''}
${advanced.targetUniv ? `Target schools: ${advanced.targetUniv}` : ''}
${advanced.audience ? `Audience: ${advanced.audience}` : ''}`
                }
            ],
            temperature: 0.7
        })
    });

    const data = await res.json();
    const raw = data.choices[0].message.content.trim();

    // Strip potential markdown code fences
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
}

async function fireLumaVideo(prompt) {
    const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VITE_VIDEO_API_KEY}`
        },
        body: JSON.stringify({
            prompt,
            model: process.env.VITE_VIDEO_MODEL || 'ray-2',
            aspect_ratio: '9:16',
            loop: false
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Luma API Error: ${err}`);
    }

    const data = await res.json();
    return data.id;
}

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
                voice_id: 'male-qn-jingying',   // 精英青年音色 - confirmed valid
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

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`MiniMax TTS Error: ${err}`);
    }

    const data = await res.json();
    const hex = data.data?.audio;
    if (!hex) throw new Error('No audio returned from MiniMax');

    // Convert hex string to base64 for easy frontend transfer
    const bytes = Buffer.from(hex, 'hex');
    const base64 = bytes.toString('base64');
    return `data:audio/mp3;base64,${base64}`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { idea, advanced = {} } = req.body;
    const minimaxGroupId = process.env.MINIMAX_GROUP_ID;
    const minimaxApiKey = process.env.MINIMAX_API_KEY;

    if (!minimaxGroupId || !minimaxApiKey) {
        return res.status(500).json({ error: 'MiniMax TTS is not configured. Please add MINIMAX_GROUP_ID and MINIMAX_API_KEY to your environment variables.' });
    }

    try {
        // Step 1: Generate Script & Storyboard via DeepSeek
        console.log('[Pipeline] Step 1: Generating storyboard...');
        const scenes = await generateScript(idea, advanced);

        // Step 2: Fire all Luma jobs + TTS in PARALLEL (concurrent execution)
        console.log(`[Pipeline] Step 2: Firing ${scenes.length} concurrent Luma video + TTS jobs...`);
        const enrichedScenes = await Promise.all(scenes.map(async (scene) => {
            const [lumaId, ttsAudioBase64] = await Promise.all([
                fireLumaVideo(scene.luma_prompt),
                generateMiniMaxTTS(scene.tts_text, minimaxGroupId, minimaxApiKey)
            ]);

            return {
                ...scene,
                luma_job_id: lumaId,
                tts_audio: ttsAudioBase64,
                video_url: null,
                status: 'rendering'
            };
        }));

        // Return scene data immediately — frontend will poll for Luma statuses
        return res.status(200).json({ scenes: enrichedScenes });
    } catch (error) {
        console.error('[Pipeline] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
