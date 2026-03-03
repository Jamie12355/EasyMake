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

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { video_url, audio_url } = req.body;

    if (!video_url || !audio_url) {
        return res.status(400).json({ error: 'video_url and audio_url are required' });
    }

    try {
        const token = generateKlingToken();
        const klingRes = await fetch('https://api.klingai.com/v1/videos/lip-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model_name: "kling-v1",
                input: {
                    video_url: video_url,
                    sound_file: audio_url
                }
            })
        });

        const klingData = await klingRes.json();

        if (klingData.code !== 0 || !klingData.data?.task_id) {
            throw new Error(`Kling Lip Sync Error: ${JSON.stringify(klingData)}`);
        }

        return res.status(200).json({ taskId: klingData.data.task_id });

    } catch (klingErr) {
        console.error('[pipeline-lipsync] Error:', klingErr.message);
        return res.status(500).json({ error: klingErr.message });
    }
}
