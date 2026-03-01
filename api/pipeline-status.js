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
