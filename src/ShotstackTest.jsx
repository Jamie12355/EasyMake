import { useState } from 'react';

export default function ShotstackTest() {
    const [log, setLog] = useState(['Ready. Click "Run Shotstack Test" to start.']);
    const [loading, setLoading] = useState(false);
    const [videoUrl, setVideoUrl] = useState(null);

    const addLog = (msg, type = 'info') => {
        setLog(prev => [...prev, { msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }]);
    };

    const runTest = async () => {
        setLoading(true);
        setVideoUrl(null);
        setLog([]);
        addLog('Starting Shotstack cloud rendering test...');
        addLog('Using 3 public stock videos & audios (Zero Luma/MiniMax API costs)');

        // Mock scenes imitating what Luma and MiniMax would return
        const mockScenes = [
            {
                status: 'completed',
                video_url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/footage/earth.mp4',
                tts_audio_url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/cologne.mp3'
            },
            {
                status: 'completed',
                video_url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/footage/skater.mp4',
                tts_audio_url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/cologne.mp3'
            },
            {
                status: 'completed',
                video_url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/footage/surfer.mp4',
                tts_audio_url: 'https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/cologne.mp3'
            }
        ];

        try {
            addLog('Submitting payload to /api/pipeline-stitch...');
            const t0 = Date.now();

            const res = await fetch('/api/pipeline-stitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes: mockScenes })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'API Error');
            }

            const data = await res.json();

            if (!data.video_url) {
                throw new Error('No video URL returned from API');
            }

            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            addLog(`✅ Cloud stitching complete in ${elapsed}s!`, 'ok');
            addLog(`🔗 Result URL: ${data.video_url}`, 'ok');
            setVideoUrl(data.video_url);

        } catch (e) {
            addLog(`❌ FAILED: ${e?.message || String(e)}`, 'err');
            console.error('[Shotstack test error]', e);
        }
        setLoading(false);
    };

    const logColor = (type) => {
        if (type === 'ok') return '#10b981';
        if (type === 'err') return '#ef4444';
        return '#94a3b8';
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ color: '#8b5cf6', marginBottom: '0.4rem' }}>☁️ Shotstack Stitching Test</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
                Tests the Shotstack cloud timeline editor backend API without calling Luma API or MiniMax API.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#a5b4fc', fontSize: '1rem', marginBottom: '1rem' }}>Run Test</h2>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button
                        onClick={runTest}
                        disabled={loading}
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', color: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontWeight: 600, fontSize: '0.9rem' }}
                    >
                        {loading ? '⏳ Wait... Stitching in cloud...' : '🎬 Run Shotstack Test'}
                    </button>
                    <button
                        onClick={() => setLog([])}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', padding: '0.75rem 1.25rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                    >
                        Clear Log
                    </button>
                </div>
                <div style={{ background: '#000', borderRadius: '10px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.78rem', height: '260px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {log.map((entry, i) => (
                        <div key={i} style={{ color: logColor(entry.type), lineHeight: 1.6 }}>
                            {typeof entry === 'string' ? entry : entry.msg}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem' }}>
                <h2 style={{ color: '#a5b4fc', fontSize: '1rem', marginBottom: '1rem' }}>Output</h2>
                {videoUrl ? (
                    <div style={{ textAlign: 'center' }}>
                        <video src={videoUrl} controls autoPlay style={{ maxWidth: '280px', borderRadius: '12px', border: '2px solid rgba(16,185,129,0.3)' }} />
                        <br />
                        <a href={videoUrl} download="shotstack_test.mp4" target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '0.75rem', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
                            ⬇ View Final MP4
                        </a>
                    </div>
                ) : (
                    <p style={{ color: '#475569', fontSize: '0.85rem' }}>No output yet. Run the tests above.</p>
                )}
            </div>
        </div>
    );
}
