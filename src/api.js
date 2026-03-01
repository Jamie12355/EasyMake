export async function generateContent(params) {
    try {
        const res = await fetch('/api/content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server Error: ${res.statusText}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Error generating content:", error);
        throw error;
    }
}

export async function generateVideo(prompt) {
    try {
        // 1. Initiate video generation task using serverless endpoint
        const initRes = await fetch('/api/luma-init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });

        if (!initRes.ok) {
            const errData = await initRes.json().catch(() => ({}));
            throw new Error(errData.error || `Server Error: ${initRes.statusText}`);
        }

        const initData = await initRes.json();
        const generationId = initData.id;

        // 2. Poll for completion using serverless endpoint
        let isCompleted = false;
        let videoUrl = null;

        while (!isCompleted) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds before polling

            const pollRes = await fetch(`/api/luma-status?id=${generationId}`);
            if (!pollRes.ok) throw new Error('Failed to check video status');

            const pollData = await pollRes.json();

            if (pollData.state === 'completed') {
                isCompleted = true;
                videoUrl = pollData.assets.video;
            } else if (pollData.state === 'failed') {
                throw new Error('Video generation failed at provider');
            }
        }

        return videoUrl;
    } catch (error) {
        console.error("Error generating video:", error);
        throw error;
    }
}
