import { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export default function FFmpegTest() {
    const [log, setLog] = useState(['Ready. Click ① to start.']);
    const [loadDone, setLoadDone] = useState(false);
    const [videoUrl, setVideoUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stitching, setStitching] = useState(false);
    const ffmpegRef = useRef(null);

    const addLog = (msg, type = 'info') => {
        setLog(prev => [...prev, { msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }]);
    };

    const envChecks = [
        {
            label: 'SharedArrayBuffer',
            ok: typeof SharedArrayBuffer !== 'undefined',
            pass: '✅ Available (required for ffmpeg.wasm)',
            fail: '❌ NOT available — COOP/COEP headers missing',
        },
        {
            label: 'WebAssembly',
            ok: typeof WebAssembly !== 'undefined',
            pass: '✅ Supported',
            fail: '❌ Not supported in this browser',
        },
        {
            label: 'COOP/COEP Headers',
            ok: window.crossOriginIsolated,
            pass: '✅ Active (crossOriginIsolated = true)',
            fail: '❌ Not active — ffmpeg.wasm will fail',
        },
    ];

    const testLoad = async () => {
        setLoading(true);
        const t0 = Date.now();
        addLog('Starting ffmpeg.wasm load test...');
        addLog('Using self-hosted files: /ffmpeg/ffmpeg-core.{js,wasm} + /ffmpeg/worker.js');

        try {
            const ffmpeg = new FFmpeg();
            ffmpegRef.current = ffmpeg;

            addLog('Fetching files as Blob URLs...');
            const [coreURL, wasmURL, workerURL] = await Promise.all([
                toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
                toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
                toBlobURL('/ffmpeg/worker.js', 'text/javascript'),
            ]);

            addLog('Blob URLs created. Loading ffmpeg runtime...');
            await ffmpeg.load({ coreURL, wasmURL, workerURL });

            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            addLog(`✅ ffmpeg.wasm loaded in ${elapsed}s`, 'ok');
            addLog('🎉 Load test PASSED!', 'ok');
            setLoadDone(true);
        } catch (e) {
            addLog(`❌ FAILED: ${e?.message || String(e)}`, 'err');
            console.error('[ffmpeg load]', e);
        }
        setLoading(false);
    };

    const testStitch = async () => {
        const ffmpeg = ffmpegRef.current;
        if (!ffmpeg) return;
        setStitching(true);
        addLog('── Test 2: Video Stitch ──────────────────');

        try {
            const colors = [
                { color: '8b5cf6', label: 'violet (Scene 1)' },
                { color: '3b82f6', label: 'blue (Scene 2)' },
                { color: '10b981', label: 'green (Scene 3)' },
            ];
            const fileList = [];
            for (let i = 0; i < colors.length; i++) {
                const { color, label } = colors[i];
                addLog(`Generating synthetic clip ${i + 1}/3 (${label})...`);
                await ffmpeg.exec([
                    '-f', 'lavfi',
                    '-i', `color=c=0x${color}:size=540x960:rate=30`,
                    '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-y', `clip${i}.mp4`
                ]);
                fileList.push(`clip${i}.mp4`);
                addLog(`✅ clip${i + 1} done`, 'ok');
            }

            const concatContent = fileList.map(f => `file '${f}'`).join('\n');
            await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatContent));

            addLog('Stitching clips into 9:16...');
            await ffmpeg.exec([
                '-f', 'concat', '-safe', '0', '-i', 'concat_list.txt',
                '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-y', 'output.mp4'
            ]);

            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const sizeMB = (blob.size / 1024 / 1024).toFixed(2);

            addLog(`✅ Stitch complete! Output: ${sizeMB} MB`, 'ok');
            addLog('🎬 FULL PIPELINE TEST PASSED — ffmpeg.wasm is working!', 'ok');
            setVideoUrl(url);
        } catch (e) {
            addLog(`❌ Stitch FAILED: ${e?.message || String(e)}`, 'err');
            console.error('[ffmpeg stitch]', e);
        }
        setStitching(false);
    };

    const logColor = (type) => {
        if (type === 'ok') return '#10b981';
        if (type === 'err') return '#ef4444';
        return '#94a3b8';
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
            <h1 style={{ color: '#8b5cf6', marginBottom: '0.4rem' }}>🧪 ffmpeg.wasm Unit Test</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '2rem' }}>
                Tests ffmpeg.wasm using synthetic data only. <strong>Zero API costs. No Luma. No MiniMax.</strong>
            </p>

            {/* Environment Checks */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#a5b4fc', fontSize: '1rem', marginBottom: '1rem' }}>Environment Checks</h2>
                {envChecks.map(c => (
                    <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.ok ? '#10b981' : '#ef4444', flexShrink: 0 }} />
                        <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                            <strong>{c.label}:</strong> {c.ok ? c.pass : c.fail}
                        </span>
                    </div>
                ))}
            </div>

            {/* Test Buttons */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#a5b4fc', fontSize: '1rem', marginBottom: '1rem' }}>Tests</h2>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button
                        onClick={testLoad}
                        disabled={loading || loadDone}
                        style={{ background: loadDone ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#8b5cf6,#3b82f6)', color: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '10px', cursor: loading || loadDone ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontWeight: 600, fontSize: '0.9rem' }}
                    >
                        {loading ? '⏳ Loading...' : loadDone ? '✅ Loaded!' : '① Load ffmpeg.wasm'}
                    </button>
                    <button
                        onClick={testStitch}
                        disabled={!loadDone || stitching}
                        style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', color: 'white', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '10px', cursor: !loadDone || stitching ? 'not-allowed' : 'pointer', opacity: !loadDone || stitching ? 0.4 : 1, fontWeight: 600, fontSize: '0.9rem' }}
                    >
                        {stitching ? '⏳ Stitching...' : '② Stitch Test Videos (3 clips)'}
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

            {/* Output */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.5rem' }}>
                <h2 style={{ color: '#a5b4fc', fontSize: '1rem', marginBottom: '1rem' }}>Output</h2>
                {videoUrl ? (
                    <div style={{ textAlign: 'center' }}>
                        <video src={videoUrl} controls autoPlay style={{ maxWidth: '280px', borderRadius: '12px', border: '2px solid rgba(16,185,129,0.3)' }} />
                        <br />
                        <a href={videoUrl} download="test_stitch.mp4" style={{ display: 'inline-block', marginTop: '0.75rem', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}>
                            ⬇ Download Test MP4
                        </a>
                    </div>
                ) : (
                    <p style={{ color: '#475569', fontSize: '0.85rem' }}>No output yet. Run the tests above.</p>
                )}
            </div>
        </div>
    );
}
