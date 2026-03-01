// Executes the pipeline for user-defined scenes (fires Luma + TTS)
// Called after the user finalizes their storyboard in the Plan phase

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
    if (!res.ok) throw new Error(`Luma Error: ${await res.text()}`);
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
    const data = await res.json();
    return data.choices[0].message.content.trim();
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
                fireLumaVideo(lumaPrompt),
                generateMiniMaxTTS(scene.tts_text, minimaxGroupId, minimaxApiKey)
            ]);

            return {
                ...scene,
                luma_prompt: lumaPrompt,
                luma_job_id: lumaId,
                tts_audio: ttsAudioBase64,
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
