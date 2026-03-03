import jwt from 'jsonwebtoken';

function generateKlingToken() {
    const ak = process.env.VITE_KLING_AK || 'ALAnrRPrhAb9dfmLgKyKBnYBtJmAeDCM';
    const sk = process.env.VITE_KLING_SK || 'YghMPk3NgnY4JrtBJrNbCDkPDPyrdy88';
    return jwt.sign(
        { iss: ak, exp: Math.floor(Date.now() / 1000) + 1800, nbf: Math.floor(Date.now() / 1000) - 5 },
        sk,
        { header: { alg: 'HS256', typ: 'JWT' } }
    );
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { ids } = req.query; // comma-separated luma job IDs
    if (!ids) return res.status(400).json({ error: 'ids query param required' });

    const jobIds = ids.split(',').filter(Boolean);
    const apiKey = process.env.VITE_VIDEO_API_KEY;

    try {
        const results = await Promise.all(jobIds.map(async (id) => {
            if (id.startsWith('kling_lipsync_')) {
                // ===== Handle Kling Lip Sync task =====
                const klingTaskId = id.replace('kling_lipsync_', '');
                const token = generateKlingToken();
                const pollRes = await fetch(`https://api.klingai.com/v1/videos/lip-sync/${klingTaskId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!pollRes.ok) {
                    return { id, status: 'failed', video_url: null };
                }

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

                return {
                    id,
                    status: mappedStatus,
                    video_url: videoUrl,
                    progress: null
                };
            }

            if (id.startsWith('kling_')) {
                // ===== Handle Kling Video Generation task =====
                const klingTaskId = id.replace('kling_', '');
                const token = generateKlingToken();
                const pollRes = await fetch(`https://api.klingai.com/v1/videos/text2video/${klingTaskId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!pollRes.ok) {
                    return { id, status: 'failed', video_url: null };
                }

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

                return {
                    id,
                    status: mappedStatus,
                    video_url: videoUrl,
                    progress: null
                };
            }

            const pollRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!pollRes.ok) {
                return { id, status: 'failed', video_url: null };
            }

            const data = await pollRes.json();
            const videoUrl = data.assets?.video || null;

            return {
                id,
                status: data.state,          // 'pending', 'dreaming', 'completed', 'failed'
                video_url: videoUrl,
                progress: data.generation_type || null
            };
        }));

        return res.status(200).json({ results });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
