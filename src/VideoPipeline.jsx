import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Film, Mic, Scissors, Download, CheckCircle2, Loader2, AlertCircle, Play, ChevronRight } from 'lucide-react';

const PIPELINE_STEPS = [
    { id: 'script', label_zh: '分镜脚本生成', label_en: 'Generating Storyboard', icon: Film },
    { id: 'luma', label_zh: '多镜头视频渲染', label_en: 'Rendering Video Scenes', icon: Film },
    { id: 'stitch', label_zh: '剪辑拼接 + 字幕烧录', label_en: 'Stitching + Subtitles', icon: Scissors },
    { id: 'done', label_zh: '视频导出完成', label_en: 'Export Complete', icon: Download },
];

export default function VideoPipeline({ idea, advanced = {}, lang = 'zh', onClose }) {
    const [log, setLog] = useState([]);
    const [currentStep, setCurrentStep] = useState(''); // 'script' | 'luma' | 'stitch' | 'done' | 'error'
    const [scenes, setScenes] = useState([]);
    const [finalVideoUrl, setFinalVideoUrl] = useState(null);
    const [error, setError] = useState(null);
    const ffmpegRef = useRef(null);
    const hasStarted = useRef(false);

    const addLog = useCallback((msg) => {
        setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    }, []);

    const loadFFmpeg = async () => {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        ffmpeg.on('log', ({ message }) => {
            if (message.includes('frame') || message.includes('time=')) {
                console.log('[ffmpeg]', message);
            }
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        addLog('ffmpeg.wasm 加载完成');
        return ffmpeg;
    };

    const pollScenes = async (scenesData) => {
        const jobIds = scenesData.map(s => s.luma_job_id);
        let completed = new Array(scenesData.length).fill(false);
        let updatedScenes = [...scenesData];

        addLog(`正在监控 ${jobIds.length} 个 Luma Ray 2 渲染任务...`);

        while (!completed.every(Boolean)) {
            await new Promise(r => setTimeout(r, 5000));

            const res = await fetch(`/api/pipeline-status?ids=${jobIds.join(',')}`);
            if (!res.ok) continue;
            const { results } = await res.json();

            results.forEach((r, i) => {
                if (r.status === 'completed' && r.video_url) {
                    if (!completed[i]) {
                        addLog(`✅ Scene ${i + 1} 渲染完成！`);
                    }
                    completed[i] = true;
                    updatedScenes[i] = { ...updatedScenes[i], video_url: r.video_url, status: 'completed' };
                } else if (r.status === 'failed') {
                    completed[i] = true;
                    updatedScenes[i] = { ...updatedScenes[i], status: 'failed' };
                    addLog(`❌ Scene ${i + 1} 渲染失败`);
                } else {
                    addLog(`⏳ Scene ${i + 1} 渲染中... (${r.status})`);
                }
            });

            setScenes([...updatedScenes]);
        }

        return updatedScenes;
    };

    const stitchVideos = async (finalScenes) => {
        setCurrentStep('stitch');
        addLog('正在加载 ffmpeg.wasm 视频编辑引擎...');
        const ffmpeg = await loadFFmpeg();

        const validScenes = finalScenes.filter(s => s.status === 'completed' && s.video_url);
        if (validScenes.length === 0) throw new Error('No valid scenes to stitch');

        addLog(`开始下载 ${validScenes.length} 个视频片段...`);

        // Download all videos + audios into ffmpeg virtual filesystem
        const fileList = [];
        for (let i = 0; i < validScenes.length; i++) {
            const scene = validScenes[i];
            const vidName = `scene${i}.mp4`;
            const audName = `scene${i}.mp3`;
            const mergedName = `merged${i}.mp4`;

            addLog(`下载 Scene ${i + 1} 视频...`);
            await ffmpeg.writeFile(vidName, await fetchFile(scene.video_url));

            addLog(`写入 Scene ${i + 1} 语音...`);
            // TTS is base64 encoded — convert to Uint8Array
            const base64Data = scene.tts_audio.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
            }
            await ffmpeg.writeFile(audName, bytes);

            // Merge video + audio for this scene, pad audio to video duration
            addLog(`配音合并 Scene ${i + 1}...`);
            await ffmpeg.exec([
                '-i', vidName,
                '-i', audName,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-shortest',
                '-y',
                mergedName
            ]);

            fileList.push(mergedName);
        }

        // Create concat file list
        addLog('正在拼接所有场景...');
        const concatContent = fileList.map(f => `file '${f}'`).join('\n');
        const encoder = new TextEncoder();
        await ffmpeg.writeFile('concat_list.txt', encoder.encode(concatContent));

        // Concatenate all scenes
        await ffmpeg.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat_list.txt',
            '-vf', `subtitles=no,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-y',
            'output.mp4'
        ]);

        addLog('✅ 剪辑完成！正在生成下载链接...');
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        return URL.createObjectURL(blob);
    };

    const runPipeline = useCallback(async () => {
        if (!idea) return;
        setCurrentStep('script');
        setError(null);
        setLog([]);
        setScenes([]);
        setFinalVideoUrl(null);

        try {
            // STEP 1: Init pipeline (script + luma + TTS)
            addLog('正在生成视频脚本与分镜方案...');
            const initRes = await fetch('/api/pipeline-init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, advanced })
            });

            if (!initRes.ok) {
                const err = await initRes.json();
                throw new Error(err.error || 'Pipeline init failed');
            }

            const { scenes: initialScenes } = await initRes.json();
            setScenes(initialScenes);
            addLog(`✅ 脚本生成完成！共 ${initialScenes.length} 个分镜场景`);
            initialScenes.forEach((s, i) => {
                addLog(`   Scene ${i + 1} [${s.scene_label}]: ${s.tts_text}`);
            });

            // STEP 2: Poll Luma renders
            setCurrentStep('luma');
            const finalScenes = await pollScenes(initialScenes);

            // STEP 3: Stitch
            addLog('所有场景渲染完成，开始视频剪辑...');
            const outputUrl = await stitchVideos(finalScenes);
            setFinalVideoUrl(outputUrl);
            setCurrentStep('done');
            addLog('🎬 视频生成完毕！');

        } catch (err) {
            setError(err.message);
            setCurrentStep('error');
            addLog(`❌ 错误: ${err.message}`);
        }
    }, [idea, advanced, addLog]);

    useEffect(() => {
        if (!hasStarted.current) {
            hasStarted.current = true;
            runPipeline();
        }
    }, [runPipeline]);

    const steps = [
        { id: 'script', label: lang === 'zh' ? '脚本 & 分镜' : 'Script & Storyboard' },
        { id: 'luma', label: lang === 'zh' ? 'Luma 多镜头渲染' : 'Multi-Scene Rendering' },
        { id: 'stitch', label: lang === 'zh' ? '剪辑 & 字幕' : 'Edit & Subtitles' },
        { id: 'done', label: lang === 'zh' ? '完成导出' : 'Export Done' },
    ];

    const stepOrder = ['script', 'luma', 'stitch', 'done'];
    const currentStepIndex = stepOrder.indexOf(currentStep);

    return (
        <div className="glass-panel animate-fade-in" style={{ width: '100%' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="card-title m-0" style={{ color: 'var(--accent-primary)' }}>
                        <Film size={22} style={{ display: 'inline', marginRight: '0.8rem' }} />
                        {lang === 'zh' ? '🎬 AI 视频导演模式' : '🎬 AI Video Director Mode'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        脚本 → 配音 → 分镜 → Luma 渲染 → 剪辑 → 9:16 竖版导出
                    </p>
                </div>
                {onClose && (
                    <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>
                        ✕ {lang === 'zh' ? '关闭' : 'Close'}
                    </button>
                )}
            </div>

            {/* Step Tracker */}
            <div className="flex gap-2 mb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem', overflowX: 'auto' }}>
                {steps.map((step, i) => {
                    const isActive = currentStep === step.id;
                    const isDone = currentStepIndex > i;
                    const isError = currentStep === 'error' && i === (currentStepIndex >= 0 ? currentStepIndex : 0);
                    return (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                                background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)',
                                color: isDone ? '#10b981' : isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : isActive ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                transition: 'all 0.3s ease'
                            }}>
                                {isDone ? <CheckCircle2 size={13} /> : isActive ? <Loader2 size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />}
                                {step.label}
                            </div>
                            {i < steps.length - 1 && (
                                <ChevronRight size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Scene Cards */}
            {scenes.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {lang === 'zh' ? '分镜场景' : 'Storyboard Scenes'}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                        {scenes.map((scene, i) => (
                            <div key={scene.scene_id} style={{
                                padding: '1rem', borderRadius: '12px',
                                background: scene.status === 'completed' ? 'rgba(16,185,129,0.05)' : scene.status === 'failed' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${scene.status === 'completed' ? 'rgba(16,185,129,0.2)' : scene.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Scene {scene.scene_id} · {scene.scene_label}
                                    </span>
                                    {scene.status === 'completed' ? <CheckCircle2 size={14} color="#10b981" /> :
                                        scene.status === 'failed' ? <AlertCircle size={14} color="#ef4444" /> :
                                            <Loader2 size={14} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />}
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                                    {scene.tts_text}
                                </p>
                                {scene.tts_audio && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#10b981' }}>
                                        <Mic size={11} />
                                        {lang === 'zh' ? '配音就绪' : 'Voiceover Ready'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Final Video Output */}
            {finalVideoUrl && (
                <div style={{ marginBottom: '2rem', textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                    <h4 style={{ color: '#10b981', marginBottom: '1rem' }}>🎬 {lang === 'zh' ? '您的视频已准备好！' : 'Your Video Is Ready!'}</h4>
                    <video
                        src={finalVideoUrl}
                        controls
                        autoPlay
                        style={{ maxWidth: '320px', maxHeight: '570px', borderRadius: '16px', border: '2px solid rgba(16,185,129,0.3)', display: 'block', margin: '0 auto' }}
                    />
                    <a
                        href={finalVideoUrl}
                        download="easymake_video.mp4"
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', textDecoration: 'none' }}
                    >
                        <Download size={18} />
                        {lang === 'zh' ? '下载 9:16 视频' : 'Download 9:16 Video'}
                    </a>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ padding: '1rem 1.25rem', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '0.25rem' }}>Pipeline Error</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
                    </div>
                </div>
            )}

            {/* Process Log */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Process Log</p>
                {log.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Initializing pipeline...</p>
                ) : (
                    log.map((entry, i) => (
                        <div key={i} style={{ color: entry.includes('❌') ? '#ef4444' : entry.includes('✅') || entry.includes('🎬') ? '#10b981' : 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {entry}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
