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
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { ids } = req.query;
    if (!ids) return res.status(400).json({ error: 'Query parameter "ids" is required' });

    const idArray = ids.split(',').filter(Boolean);

    try {
        const token = generateKlingToken();

        const results = await Promise.all(idArray.map(async (taskId) => {
            const apiRes = await fetch(`https://api.klingai.com/v1/videos/lip-sync/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!apiRes.ok) {
                return { id: taskId, status: 'failed', error: await apiRes.text() };
            }

            const data = await apiRes.json();

            // Kling AI status mapping:
            // 10 = queued, 50 = running, 99 = completed, 100 = failed
            if (data.code !== 0 || !data.data) {
                return { id: taskId, status: 'failed', error: data.message };
            }

            const taskStatus = data.data.task_status;
            let status = 'rendering';
            let video_url = null;

            if (taskStatus === 99 || taskStatus === 'succeed') {
                status = 'completed';
                // Find the first valid video URL in task_result
                const resultsArray = data.data.task_result?.videos || [];
                if (resultsArray.length > 0) {
                    video_url = resultsArray[0].url;
                } else if (data.data.task_result?.video_url) {
                    video_url = data.data.task_result.video_url;
                }
            } else if (taskStatus === 100 || taskStatus === 'failed') {
                status = 'failed';
            }

            return {
                id: taskId,
                status,
                video_url
            };
        }));

        res.status(200).json({ results });
    } catch (err) {
        console.error('[lipsync-status] Poll Error:', err);
        res.status(500).json({ error: err.message });
    }
}
