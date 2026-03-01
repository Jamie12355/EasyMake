export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt } = req.body;
        const apiKey = process.env.VITE_VIDEO_API_KEY;
        const url = 'https://api.lumalabs.ai/dream-machine/v1/generations';

        const initRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                prompt: prompt,
                model: process.env.VITE_VIDEO_MODEL || "ray-2"
            })
        });

        if (!initRes.ok) {
            throw new Error(`Luma API Error: ${initRes.statusText}`);
        }

        const initData = await initRes.json();
        res.status(200).json({ id: initData.id });
    } catch (error) {
        console.error("Error initiating video:", error);
        res.status(500).json({ error: error.message });
    }
}
