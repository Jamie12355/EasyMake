import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: "Missing generation ID" });

        const apiKey = process.env.VITE_VIDEO_API_KEY;

        if (id.startsWith('kling_')) {
            const klingTaskId = id.replace('kling_', '');
            const ak = process.env.VITE_KLING_AK || 'ALAnrRPrhAb9dfmLgKyKBnYBtJmAeDCM';
            const sk = process.env.VITE_KLING_SK || 'YghMPk3NgnY4JrtBJrNbCDkPDPyrdy88';

            const token = jwt.sign(
                { iss: ak, exp: Math.floor(Date.now() / 1000) + 1800, nbf: Math.floor(Date.now() / 1000) - 5 },
                sk,
                { header: { alg: 'HS256', typ: 'JWT' } }
            );

            const pollRes = await fetch(`https://api.klingai.com/v1/videos/text2video/${klingTaskId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!pollRes.ok) throw new Error('Failed to check Kling video status');

            const payload = await pollRes.json();
            const stateMap = {
                'submitted': 'pending',
                'processing': 'dreaming',
                'succeed': 'completed',
                'failed': 'failed'
            };

            const taskStatus = payload.data?.task_status || 'failed';
            const mappedStatus = stateMap[taskStatus] || 'failed';
            const videoUrl = payload.data?.task_result?.videos?.[0]?.url || null;

            return res.status(200).json({
                state: mappedStatus,
                assets: { video: videoUrl }
            });
        }

        const url = `https://api.lumalabs.ai/dream-machine/v1/generations/${id}`;

        const pollRes = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!pollRes.ok) {
            throw new Error('Failed to check video status');
        }

        const pollData = await pollRes.json();
        res.status(200).json(pollData);

    } catch (error) {
        console.error("Error checking video status:", error);
        res.status(500).json({ error: error.message });
    }
}
