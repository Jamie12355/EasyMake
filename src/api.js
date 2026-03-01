export async function generateContent(params) {
    const { idea, advanced } = params;

    const systemPrompt = `You are a master social media copywriter and animation director for top-tier Chinese study abroad (留学) agencies. 
Your goal is to take the user's input and generate two things:
1. Highly engaging, convincing English social media copy for platforms like Instagram/TikTok.
2. A highly detailed English video generation prompt specifically engineered for the 'Luma Dream Machine Ray Flash 2' model.

CRITICAL LUMA PROMPT ENGINEERING RULES:
Because video generation is expensive, you MUST engineer the video prompt to be extremely high-quality and guarantee a "wow" factor. 
Follow these exact Luma prompting best practices:
- Aesthetic: The video MUST be heavily styled as "Mixed Media / Scrapbook style". Explicitly use keywords like: "Mixed Media animation", "stop-motion", "collage", "2D cartoon elements blending with photorealistic 3D assets".
- Subject & Action: Be extremely explicit about what the main subject is doing (e.g., "A hyper-realistic paper cutout of a student opening an acceptance letter, suddenly bursting with 2D animated confetti").
- Camera Movement: Explicitly define the camera motion. Use exact terms like: "Dynamic zoom in", "Slow pan to the right", "Cinematic tracking shot", or "FPV flythrough".
- Lighting & Atmosphere: Define the mood. Use terms like: "Volumetric lighting", "Sunny university campus lighting", "Neon glowing accents", or "Soft studio lighting".

Please incorporate the user's advanced settings (if any) naturally into the copy and the video concept.

OUTPUT FORMAT:
You must return ONLY valid JSON in the following format, with no markdown formatting around it (do not use \`\`\`json):
{
  "social_media_post": "Your text post with hashtags and emojis here...",
  "video_prompt": "Mixed media animation, stop-motion scrapbook style. [Detailed description of the scene]..."
}`;

    let userPrompt = `IDEA: ${idea}\n`;
    if (advanced.tones) userPrompt += `TONE OF VOICE: ${advanced.tones}\n`;
    if (advanced.bgInfo) userPrompt += `AGENCY BACKGROUND: ${advanced.bgInfo}\n`;
    if (advanced.audience) userPrompt += `TARGET AUDIENCE: ${advanced.audience}\n`;
    if (advanced.response) userPrompt += `DESIRED RESPONSE FROM USER: ${advanced.response}\n`;
    if (advanced.animPref) userPrompt += `USER REQUESTED AESTHETIC: ${advanced.animPref}\n`;
    if (advanced.cameraMove) userPrompt += `USER REQUESTED CAMERA MOVEMENT: ${advanced.cameraMove}\n`;
    if (advanced.lighting) userPrompt += `USER REQUESTED LIGHTING & VIBE: ${advanced.lighting}\n`;

    if (advanced.targetUniv) userPrompt += `TARGET UNIVERSITY TIER: ${advanced.targetUniv}\n`;
    if (advanced.urgencyHook) userPrompt += `URGENCY HOOK: Please inject a psychological urgency trigger (e.g. application deadlines approaching) into the copy.\n`;
    if (advanced.cta) userPrompt += `PRIVATE TRAFFIC CTA: Please explicitly append a conversion-oriented CTA at the end of the post (e.g. 'DM us for a 1v1 review' or 'Comment 1 for timeline').\n`;

    const apiKey = import.meta.env.VITE_LLM_API_KEY;
    const baseUrl = import.meta.env.VITE_LLM_BASE_URL;
    const model = import.meta.env.VITE_LLM_MODEL;

    try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        if (!res.ok) {
            throw new Error(`LLM API Error: ${res.statusText}`);
        }

        const data = await res.json();
        let content = data.choices[0].message.content;

        // Clean up markdown block if the model ignores the instruction
        content = content.replace(/^```json\s*/, '').replace(/```$/, '').trim();

        return JSON.parse(content);
    } catch (error) {
        console.error("Error generating content:", error);
        throw error;
    }
}

export async function generateVideo(prompt) {
    const apiKey = import.meta.env.VITE_VIDEO_API_KEY;
    // Luma Dream Machine API
    const url = 'https://api.lumalabs.ai/dream-machine/v1/generations';

    try {
        // 1. Initiate video generation task
        const initRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                prompt: prompt,
                model: import.meta.env.VITE_VIDEO_MODEL || "ray-2-flash"
            })
        });

        if (!initRes.ok) {
            throw new Error(`Luma API Error: ${initRes.statusText}`);
        }

        const initData = await initRes.json();
        const generationId = initData.id;

        // 2. Poll for completion
        let isCompleted = false;
        let videoUrl = null;

        while (!isCompleted) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds before polling

            const pollRes = await fetch(`${url}/${generationId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!pollRes.ok) throw new Error('Failed to check video status');

            const pollData = await pollRes.json();

            if (pollData.state === 'completed') {
                isCompleted = true;
                videoUrl = pollData.assets.video;
            } else if (pollData.state === 'failed') {
                throw new Error('Video generation failed at provider');
            }
            // if queued or running, it will loop again
        }

        return videoUrl;

    } catch (error) {
        console.error("Error generating video:", error);
        throw error;
    }
}
