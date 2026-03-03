// Generates script/storyboard only - no Luma or TTS fired
// Used by the Planning phase of the Director Mode editor

const LLM_BASE_URL = process.env.VITE_LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_API_KEY = process.env.VITE_LLM_API_KEY || '';
const LLM_MODEL = process.env.VITE_LLM_MODEL || 'deepseek-chat';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { idea, advanced = {}, scene_count = 3, videoMode = 'real_person' } = req.body;

    const modeInstruction = videoMode === 'real_person'
        ? "- luma_prompt: Detailed English visual prompt (9:16 vertical). MUST describe a realistic young Chinese male (e.g., student, consultant) looking directly at the camera, talking and naturally lip-syncing to the viewer. Gender MUST be male to match the voice."
        : "- luma_prompt: Detailed English visual prompt (9:16 vertical). MUST describe a high-quality 3D cartoon/Pixar styled animation. Do NOT include a real person.";

    try {
        const llmRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_API_KEY}`
            },
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert Chinese short-video scriptwriter for 留学 study abroad agencies. 
Break a concept into exactly ${scene_count} scenes for a 9:16 vertical short video.

Each scene must have:
- scene_id: integer
- scene_label: English label (Hook / Main Message / Highlight / Call to Action / etc.)
- scene_label_zh: Chinese label (开场钩子 / 核心卖点 / 亮点展示 / 引导行动 / etc.)
- tts_text: Short punchy Chinese sentence (max 25 chars) for voiceover
${modeInstruction}
- duration_seconds: 5 or 10 only (5 for short text, 10 for longer text)

Return ONLY raw JSON array. No markdown. No extra text.`
                    },
                    {
                        role: 'user',
                        content: `Generate ${scene_count}-scene storyboard for: ${idea}
${advanced.bgInfo ? `Agency: ${advanced.bgInfo}` : ''}
${advanced.targetUniv ? `Target schools: ${advanced.targetUniv}` : ''}
${advanced.audience ? `Audience: ${advanced.audience}` : ''}`
                    }
                ],
                temperature: 0.7
            })
        });

        const data = await llmRes.json();
        const raw = data.choices[0].message.content.trim();
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const scenes = JSON.parse(cleaned);
        return res.status(200).json({ scenes });
    } catch (error) {
        console.error('[Generate Script] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
