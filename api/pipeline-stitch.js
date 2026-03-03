export const config = {
    maxDuration: 60, // Serverless fn can run for up to 60s
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { scenes, brandName = 'EasyMake' } = req.body;

        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
            return res.status(400).json({ error: 'Valid scenes array is required' });
        }

        const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;

        if (!SHOTSTACK_API_KEY) {
            return res.status(500).json({
                error: 'Shotstack API key (SHOTSTACK_API_KEY) was not found in environment variables.'
            });
        }

        // 1. Build Shotstack Timeline
        const videoClips = scenes.map((scene, i) => {
            return {
                asset: { type: 'video', src: scene.video_url },
                start: i * 5,
                length: 5,
                fit: 'cover' // Ensures it fills 9:16
            };
        });

        // Add Outro clip with company brand
        videoClips.push({
            asset: {
                type: 'title',
                text: brandName,
                style: 'minimal',
                color: '#ffffff',
                size: 'medium'
            },
            start: scenes.length * 5,
            length: 3,
            transition: { in: 'fade', out: 'fade' }
        });

        const audioClips = scenes.map((scene, i) => {
            const isLast = i === scenes.length - 1;
            return {
                asset: { type: 'audio', src: scene.tts_audio_url },
                start: i * 5,
                length: isLast ? 6 : 5, // Give the last audio an extra second to trail off naturally into the outro
                transition: isLast ? { out: 'fade' } : undefined
            };
        });

        const payload = {
            timeline: {
                background: '#000000',
                tracks: [
                    { clips: audioClips },
                    { clips: videoClips }
                ]
            },
            output: {
                format: 'mp4',
                resolution: '1080',
                aspectRatio: '9:16'
            }
        };

        // 2. Submit Render task to Shotstack
        const response = await fetch('https://api.shotstack.io/edit/v1/render', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SHOTSTACK_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Shotstack submission failed: ${err}`);
        }

        const data = await response.json();
        const renderId = data.response.id;

        // 3. Poll for completion (Shotstack is very fast, usually < 15s for short clips)
        let videoUrl = null;
        let attempts = 0;

        while (attempts < 15) { // 30s max wait
            await new Promise(r => setTimeout(r, 2000));
            attempts++;

            const pollRes = await fetch(`https://api.shotstack.io/edit/v1/render/${renderId}`, {
                headers: { 'x-api-key': SHOTSTACK_API_KEY }
            });

            if (!pollRes.ok) continue;

            const pollData = await pollRes.json();
            const status = pollData.response.status;

            if (status === 'done') {
                videoUrl = pollData.response.url;
                break;
            } else if (status === 'failed') {
                throw new Error(`Shotstack render failed: ${pollData.response.error}`);
            }
        }

        if (!videoUrl) {
            throw new Error('云渲染超时，请稍后重试');
        }

        return res.status(200).json({ video_url: videoUrl });

    } catch (error) {
        console.error('Stitching API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
