// Kling-native pipeline for real person videos
// Supports: TTS + Video Generation + Lip Sync in one unified flow
// No Shotstack needed - each scene is a complete video

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

// Step 1: Generate video using Kling (high quality)
async function fireKlingVideoGeneration(prompt, duration = '5') {
    const token = generateKlingToken();
    console.log('[kling-pipeline] Firing Kling video generation...');

    const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            model_name: "kling-v1",
            prompt,
            duration,
            aspect_ratio: "9:16"
        })
    });

    const data = await res.json();
    if (data.code !== 0 || !data.data?.task_id) {
        throw new Error(`Kling Video Generation Error: ${JSON.stringify(data)}`);
    }

    console.log('[kling-pipeline] Video generation task created:', data.data.task_id);
    return `kling_${data.data.task_id}`;
}

// Step 2: Poll video generation status
async function pollKlingVideoStatus(taskId) {
    const token = generateKlingToken();
    const actualTaskId = taskId.replace('kling_', '');
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes with 5s intervals

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${actualTaskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (data.code === 0) {
                const status = data.data?.task_status;
                console.log(`[kling-pipeline] Video status: ${status}`);

                if (status === 'succeed') {
                    const videoUrl = data.data?.task_result?.videos?.[0]?.url;
                    if (videoUrl) {
                        console.log('[kling-pipeline] Video generation completed');
                        return videoUrl;
                    }
                } else if (status === 'failed') {
                    throw new Error('Kling video generation failed');
                }
            }
        } catch (e) {
            console.warn('[kling-pipeline] Poll error:', e.message);
        }

        attempts++;
    }

    throw new Error('Kling video generation timeout');
}

// Step 3: Lip sync with TTS (精细口型同步)
async function fireKlingLipSync(videoTaskId, ttsText, ttsSpeed = 1.0) {
    const token = generateKlingToken();
    const actualTaskId = videoTaskId.replace('kling_', '');
    console.log('[kling-pipeline] Firing Kling lip sync with TTS...');

    const res = await fetch('https://api.klingai.com/v1/videos/lip-sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            model_name: "kling-v1",
            input: {
                origin_task_id: actualTaskId,  // Reference to video task
                tts_text: ttsText,              // Chinese voiceover text
                tts_timbre: "male_1",           // Young male voice
                tts_speed: ttsSpeed
            }
        })
    });

    const data = await res.json();
    if (data.code !== 0 || !data.data?.task_id) {
        throw new Error(`Kling Lip Sync Error: ${JSON.stringify(data)}`);
    }

    console.log('[kling-pipeline] Lip sync task created:', data.data.task_id);
    return `kling_lipsync_${data.data.task_id}`;
}

// Step 4: Poll lip sync status
async function pollKlingLipSyncStatus(syncTaskId) {
    const token = generateKlingToken();
    const actualTaskId = syncTaskId.replace('kling_lipsync_', '');
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes with 5s intervals

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        try {
            const res = await fetch(`https://api.klingai.com/v1/videos/lip-sync/${actualTaskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (data.code === 0) {
                const status = data.data?.task_status;
                console.log(`[kling-pipeline] Lip sync status: ${status}`);

                if (status === 'succeed') {
                    const videoUrl = data.data?.task_result?.videos?.[0]?.url;
                    if (videoUrl) {
                        console.log('[kling-pipeline] Lip sync completed');
                        return videoUrl;
                    }
                } else if (status === 'failed') {
                    console.warn('[kling-pipeline] Lip sync failed, will use original video');
                    return null;  // Fallback to original video
                }
            }
        } catch (e) {
            console.warn('[kling-pipeline] Poll error:', e.message);
        }

        attempts++;
    }

    console.warn('[kling-pipeline] Lip sync timeout, using original video');
    return null;  // Fallback to original video
}

// Main pipeline: Video + Lip Sync
export async function executeKlingRealPersonPipeline(scene) {
    try {
        // Ensure duration is a string
        const duration = String(scene.duration_seconds || 5);

        // Step 1: Generate video
        const videoTaskId = await fireKlingVideoGeneration(scene.luma_prompt, duration);
        const videoUrl = await pollKlingVideoStatus(videoTaskId);

        // Step 2: Lip sync with TTS
        const syncTaskId = await fireKlingLipSync(videoTaskId, scene.tts_text);
        const syncedVideoUrl = await pollKlingLipSyncStatus(syncTaskId) || videoUrl;

        return {
            video_url: syncedVideoUrl,
            tts_audio_url: null,  // Kling TTS is embedded in video
            status: 'completed',
            job_id: syncTaskId
        };
    } catch (error) {
        console.error('[kling-pipeline] Pipeline error:', error);
        throw error;
    }
}
