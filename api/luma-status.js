export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: "Missing generation ID" });

        const apiKey = process.env.VITE_VIDEO_API_KEY;
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
