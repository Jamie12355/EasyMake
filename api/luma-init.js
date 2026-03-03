import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt } = req.body;
        const apiKey = process.env.VITE_VIDEO_API_KEY;
        const url = 'https://api.lumalabs.ai/dream-machine/v1/generations';

        let generationId;

        try {
            console.log("[luma-init] Attempting Kling AI first...");

            const ak = process.env.VITE_KLING_AK || 'ALAnrRPrhAb9dfmLgKyKBnYBtJmAeDCM';
            const sk = process.env.VITE_KLING_SK || 'YghMPk3NgnY4JrtBJrNbCDkPDPyrdy88';

            const token = jwt.sign(
                { iss: ak, exp: Math.floor(Date.now() / 1000) + 1800, nbf: Math.floor(Date.now() / 1000) - 5 },
                sk,
                { header: { alg: 'HS256', typ: 'JWT' } }
            );

            const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    model_name: "kling-v1",
                    prompt,
                    duration: "5",
                    aspect_ratio: "9:16" // Updated to 9:16 to match Director mode standard
                })
            });

            const data = await res.json();
            if (data.code !== 0 || !data.data?.task_id) {
                throw new Error(`Kling Error: ${JSON.stringify(data)}`);
            }
            generationId = `kling_${data.data.task_id}`;

        } catch (klingError) {
            console.warn("[luma-init] Kling failed, falling back to Luma AI:", klingError.message);

            if (!apiKey) throw new Error("No Luma API Key provided and Kling failed.");

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
                const errText = await initRes.text();
                throw new Error(`Luma API Error: ${errText}`);
            }

            const initData = await initRes.json();
            generationId = initData.id;
        }

        res.status(200).json({ id: generationId });
    } catch (error) {
        console.error("Error initiating video:", error);
        res.status(500).json({ error: error.message });
    }
}
