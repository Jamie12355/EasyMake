export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idea, advanced } = req.body;

        const systemPrompt = `You are a master social media copywriter and animation director for top-tier Chinese study abroad (留学) agencies. 
Your goal is to take the user's input and generate two things:
1. Highly engaging, convincing Chinese social media copy (爆款文案) tailored for platforms like Xiaohongshu (小红书), WeChat, or Douyin.
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
You must return ONLY valid JSON in the following format, with no markdown formatting around it:
{
  "social_media_post": "Your text post with hashtags and emojis here...",
  "video_prompt": "Mixed media animation, stop-motion scrapbook style. [Detailed description of the scene]..."
}`;

        let userPrompt = `IDEA: ${idea}\n`;
        if (advanced) {
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
        }

        const apiKey = process.env.VITE_LLM_API_KEY;
        const baseUrl = process.env.VITE_LLM_BASE_URL || "https://api.deepseek.com";
        const model = process.env.VITE_LLM_MODEL || "deepseek-chat";

        const apiRes = await fetch(`${baseUrl}/chat/completions`, {
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

        if (!apiRes.ok) {
            throw new Error(`LLM API Error: ${apiRes.statusText}`);
        }

        const data = await apiRes.json();
        let content = data.choices[0].message.content;
        content = content.replace(/^```json\s*/, '').replace(/```$/, '').trim();

        res.status(200).json(JSON.parse(content));
    } catch (error) {
        console.error("Error generating content:", error);
        res.status(500).json({ error: error.message });
    }
}
