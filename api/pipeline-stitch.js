export const config = {
    maxDuration: 60, // Serverless fn can run for up to 60s
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { scenes } = req.body;

        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
            return res.status(400).json({ error: 'Valid scenes array is required' });
        }

        const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;

        if (!SHOTSTACK_API_KEY) {
            return res.status(500).json({
                error: 'Shotstack API key (SHOTSTACK_API_KEY) was not found in environment variables. Please add it to your .env or Vercel dashboard.'
            });
        }

        // =========================================================================
        // PRE-PROCESSING
        // Shotstack requires public URLs for audio. Since our TTS audio is base64, 
        // we either need to upload it to a storage bucket (Vercel Blob, S3, Supabase)
        // OR have the TTS generation step save directly to storage instead of base64.
        // For right now, returning a hard failure so we can set up the storage.
        // =========================================================================

        return res.status(500).json({
            error: 'Backend implementation required: Because cloud editors need public URLs for audio (not base64), we need a place to upload the TTS audio first. Do you want to use Vercel Blob (free, instant) or Supabase?'
        });

    } catch (error) {
        console.error('Stitching API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
