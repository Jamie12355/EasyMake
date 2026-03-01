import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Film, Mic, Scissors, Download, CheckCircle2, Loader2, AlertCircle, Play, ChevronRight, Plus, Minus, Sparkles, Pencil, ArrowRight } from 'lucide-react';

const DEFAULT_SCENE = (id) => ({
    scene_id: id,
    scene_label: id === 1 ? 'Hook' : id === 2 ? 'Main Message' : id === 3 ? 'Call to Action' : `Scene ${id}`,
    scene_label_zh: id === 1 ? '开场钩子' : id === 2 ? '核心卖点' : id === 3 ? '引导行动' : `第${id}幕`,
    tts_text: '',
    luma_prompt: '',
    luma_job_id: null,
    tts_audio: null,
    video_url: null,
    status: 'pending',
    ai_filling: false,
});

const MIN_SCENES = 2;
const MAX_SCENES = 5;

export default function VideoPipeline({ idea, advanced = {}, lang = 'zh', onClose }) {
    // Phase: 'plan' | 'execute' | 'done'
    const [phase, setPhase] = useState('plan');
    const [sceneCount, setSceneCount] = useState(3);
    const [scenes, setScenes] = useState([DEFAULT_SCENE(1), DEFAULT_SCENE(2), DEFAULT_SCENE(3)]);
    const [log, setLog] = useState([]);
    const [currentStep, setCurrentStep] = useState('');
    const [finalVideoUrl, setFinalVideoUrl] = useState(null);
    const [error, setError] = useState(null);
    const ffmpegRef = useRef(null);
    const hasStarted = useRef(false);

    const addLog = useCallback((msg) => {
        setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    }, []);

    // --- Scene count management ---
    const adjustSceneCount = (delta) => {
        const newCount = Math.min(MAX_SCENES, Math.max(MIN_SCENES, sceneCount + delta));
        setSceneCount(newCount);
        setScenes(prev => {
            if (delta > 0) {
                return [...prev, DEFAULT_SCENE(prev.length + 1)];
            } else {
                return prev.slice(0, newCount);
            }
        });
    };

    const updateScene = (index, field, value) => {
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    // AI auto-fill a single scene's tts_text via DeepSeek
    const aiAutoFillScene = async (index) => {
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, ai_filling: true } : s));
        try {
            const scene = scenes[index];
            const res = await fetch('/api/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idea: `为以下视频分镜写一句中文旁白：\n主题：${idea || '留学机构介绍'}\n场景角色：${scene.scene_label_zh}（${scene.scene_label}）\n要求：不超过25个中文字，简洁有力，适合视频配音`,
                    advanced: { ...advanced, _singleLine: true }
                })
            });
            const data = await res.json();
            // Extract just a short punchy line from the result
            const text = data.social_media_post || '';
            const firstLine = text.split(/\n/)[0].replace(/[#@！!]/g, '').trim().slice(0, 25);
            updateScene(index, 'tts_text', firstLine);

            // Also generate a Luma prompt
            const lumaPrompt = data.video_prompt || '';
            if (lumaPrompt) updateScene(index, 'luma_prompt', lumaPrompt);
        } catch (e) {
            console.error('AI fill failed:', e);
        }
        setScenes(prev => prev.map((s, i) => i === index ? { ...s, ai_filling: false } : s));
    };

    // AI auto-fill ALL scenes at once via the pipeline init endpoint
    const aiAutoFillAll = async () => {
        setScenes(prev => prev.map(s => ({ ...s, ai_filling: true })));
        try {
            const res = await fetch('/api/pipeline-generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idea, advanced, scene_count: sceneCount })
            });
            if (!res.ok) throw new Error('Script generation failed');
            const { scenes: generated } = await res.json();
            setScenes(generated.map((s, i) => ({
                ...DEFAULT_SCENE(i + 1),
                ...s,
                ai_filling: false,
                status: 'pending'
            })));
        } catch (e) {
            console.error('Auto fill all failed:', e);
            setScenes(prev => prev.map(s => ({ ...s, ai_filling: false })));
        }
    };

    const loadFFmpeg = async () => {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        // Try unpkg first, fall back to jsdelivr
        const cdns = [
            'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
            'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
        ];

        let lastError = null;
        for (const baseURL of cdns) {
            try {
                addLog(`加载 ffmpeg.wasm (${baseURL.includes('unpkg') ? 'unpkg' : 'jsdelivr'})...`);
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                });
                addLog('✅ ffmpeg.wasm 加载成功');
                return ffmpeg;
            } catch (e) {
                lastError = e;
                addLog(`⚠️ CDN ${baseURL.includes('unpkg') ? 'unpkg' : 'jsdelivr'} 加载失败，尝试备用...`);
            }
        }

        // Both CDNs failed - likely missing COOP/COEP headers (SharedArrayBuffer)
        const errMsg = lastError?.message || String(lastError) || 'ffmpeg.wasm 加载失败 — 请确保用 HTTPS 访问，或浏览器支持 SharedArrayBuffer';
        throw new Error(errMsg);
    };

    const pollScenes = async (scenesData) => {
        const jobIds = scenesData.map(s => s.luma_job_id);
        let completed = new Array(scenesData.length).fill(false);
        let updatedScenes = [...scenesData];
        addLog(`监控 ${jobIds.length} 个 Luma 渲染任务...`);
        while (!completed.every(Boolean)) {
            await new Promise(r => setTimeout(r, 5000));
            const res = await fetch(`/api/pipeline-status?ids=${jobIds.join(',')}`);
            if (!res.ok) continue;
            const { results } = await res.json();
            results.forEach((r, i) => {
                if (r.status === 'completed' && r.video_url) {
                    if (!completed[i]) addLog(`✅ Scene ${i + 1} 渲染完成`);
                    completed[i] = true;
                    updatedScenes[i] = { ...updatedScenes[i], video_url: r.video_url, status: 'completed' };
                } else if (r.status === 'failed') {
                    completed[i] = true;
                    updatedScenes[i] = { ...updatedScenes[i], status: 'failed' };
                    addLog(`❌ Scene ${i + 1} 失败`);
                } else {
                    addLog(`⏳ Scene ${i + 1} 渲染中...`);
                }
            });
            setScenes([...updatedScenes]);
        }
        return updatedScenes;
    };

    const stitchVideos = async (finalScenes) => {
        setCurrentStep('stitch');
        addLog('加载 ffmpeg.wasm...');
        const ffmpeg = await loadFFmpeg();
        const validScenes = finalScenes.filter(s => s.status === 'completed' && s.video_url);
        if (validScenes.length === 0) throw new Error('没有可用的视频片段');
        addLog(`开始下载 ${validScenes.length} 个片段...`);
        const fileList = [];
        for (let i = 0; i < validScenes.length; i++) {
            const scene = validScenes[i];
            const vidName = `scene${i}.mp4`;
            const audName = `scene${i}.mp3`;
            const mergedName = `merged${i}.mp4`;
            addLog(`下载 Scene ${i + 1}...`);
            await ffmpeg.writeFile(vidName, await fetchFile(scene.video_url));
            const base64Data = scene.tts_audio.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
            await ffmpeg.writeFile(audName, bytes);
            addLog(`合并配音 Scene ${i + 1}...`);
            await ffmpeg.exec(['-i', vidName, '-i', audName, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', mergedName]);
            fileList.push(mergedName);
        }
        addLog('拼接所有场景...');
        const concatContent = fileList.map(f => `file '${f}'`).join('\n');
        await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatContent));
        await ffmpeg.exec([
            '-f', 'concat', '-safe', '0', '-i', 'concat_list.txt',
            '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-y', 'output.mp4'
        ]);
        addLog('✅ 剪辑完毕！');
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        return URL.createObjectURL(blob);
    };

    const runPipeline = async () => {
        const validScenes = scenes.filter(s => s.tts_text.trim());
        if (validScenes.length === 0) return;
        setPhase('execute');
        setCurrentStep('tts_luma');
        setError(null);
        setLog([]);
        setFinalVideoUrl(null);
        try {
            addLog(`开始执行 ${validScenes.length} 个分镜的渲染任务...`);
            const res = await fetch('/api/pipeline-execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes: validScenes })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '执行失败');
            }
            const { scenes: enriched } = await res.json();
            setScenes(enriched);
            addLog(`✅ Luma 任务已提交，配音已生成！`);
            setCurrentStep('luma');
            const finalScenes = await pollScenes(enriched);
            const outputUrl = await stitchVideos(finalScenes);
            setFinalVideoUrl(outputUrl);
            setCurrentStep('done');
            addLog('🎬 视频生成完毕！');
        } catch (err) {
            const errMsg = err?.message || String(err) || '未知错误，请检查浏览器控制台';
            setError(errMsg);
            setCurrentStep('error');
            addLog(`❌ 错误: ${errMsg}`);
            console.error('[Pipeline] Full error:', err);
        }
    };

    const stepOrder = ['tts_luma', 'luma', 'stitch', 'done'];
    const currentStepIndex = stepOrder.indexOf(currentStep);

    const allScenesHaveText = scenes.every(s => s.tts_text.trim().length > 0);

    // Check if all scenes are done (video + audio ready) so we can retry just the stitch
    const canRetryStitch = currentStep === 'error' &&
        scenes.length > 0 &&
        scenes.every(s => s.video_url && s.tts_audio);

    const retryStitch = async () => {
        setError(null);
        setCurrentStep('stitch');
        setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 重试剪辑拼接...`]);
        try {
            const outputUrl = await stitchVideos(scenes);
            setFinalVideoUrl(outputUrl);
            setCurrentStep('done');
            addLog('🎬 视频生成完毕！');
        } catch (err) {
            const errMsg = err?.message || String(err) || '剪辑失败';
            setError(errMsg);
            setCurrentStep('error');
            addLog(`❌ 错误: ${errMsg}`);
            console.error('[Retry Stitch]', err);
        }
    };

    // ============== PLAN PHASE UI ==============
    if (phase === 'plan') {
        return (
            <div className="glass-panel animate-fade-in" style={{ width: '100%' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="card-title m-0" style={{ fontSize: '1.3rem' }}>
                            <Film size={20} style={{ display: 'inline', marginRight: '0.7rem', color: 'var(--accent-primary)' }} />
                            {lang === 'zh' ? '🎬 视频导演模式 — 分镜编辑器' : '🎬 Director Mode — Storyboard Editor'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {lang === 'zh' ? '自定义分镜数量，手动输入配音脚本，或让 AI 一键填充' : 'Set scene count, write scripts manually, or let AI fill them in'}
                        </p>
                    </div>
                    {onClose && <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>✕</button>}
                </div>

                {/* Scene Count Selector */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                            {lang === 'zh' ? '分镜数量' : 'Scene Count'}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                            {lang === 'zh' ? `建议 3 个分镜（2-${MAX_SCENES} 可选）` : `Recommend 3 scenes (${MIN_SCENES}-${MAX_SCENES} available)`}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => adjustSceneCount(-1)}
                            disabled={sceneCount <= MIN_SCENES}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: sceneCount <= MIN_SCENES ? 'not-allowed' : 'pointer', opacity: sceneCount <= MIN_SCENES ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'all 0.2s' }}
                        ><Minus size={16} /></button>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)', minWidth: '2rem', textAlign: 'center' }}>{sceneCount}</span>
                        <button
                            onClick={() => adjustSceneCount(1)}
                            disabled={sceneCount >= MAX_SCENES}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: sceneCount >= MAX_SCENES ? 'not-allowed' : 'pointer', opacity: sceneCount >= MAX_SCENES ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                        ><Plus size={16} /></button>
                    </div>
                </div>

                {/* AI Fill All Button */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        onClick={aiAutoFillAll}
                        disabled={scenes.some(s => s.ai_filling)}
                        className="btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))', border: '1px solid rgba(139,92,246,0.3)', padding: '0.85rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600 }}
                    >
                        {scenes.some(s => s.ai_filling) ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                        {lang === 'zh' ? 'AI 一键生成全部分镜脚本' : 'AI Auto-Generate All Scene Scripts'}
                    </button>
                </div>

                {/* Scene Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                    {scenes.map((scene, i) => (
                        <div key={scene.scene_id} style={{ padding: '1.25rem', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
                            {/* Scene Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)', color: 'white', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{scene.scene_label_zh}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>({scene.scene_label})</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => aiAutoFillScene(i)}
                                    disabled={scene.ai_filling}
                                    className="btn-secondary"
                                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', opacity: scene.ai_filling ? 0.6 : 1 }}
                                >
                                    {scene.ai_filling ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                                    {lang === 'zh' ? 'AI 填充' : 'AI Fill'}
                                </button>
                            </div>

                            {/* TTS Script Input */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                                    <Mic size={11} />
                                    {lang === 'zh' ? '配音旁白文案' : 'Voiceover Script'}
                                    <span style={{ marginLeft: 'auto', color: scene.tts_text.length > 20 ? '#f59e0b' : 'var(--text-secondary)' }}>
                                        {scene.tts_text.length}/25 字
                                    </span>
                                </label>
                                <textarea
                                    className="magic-input"
                                    value={scene.tts_text}
                                    onChange={e => updateScene(i, 'tts_text', e.target.value.slice(0, 35))}
                                    placeholder={lang === 'zh' ? `例：每年60万学生选择留学英国！` : 'e.g., 600k students go to UK each year!'}
                                    style={{ minHeight: '60px', fontSize: '0.9rem', padding: '0.7rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', resize: 'vertical' }}
                                />
                            </div>

                            {/* Luma Visual Prompt (collapsible) */}
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
                                    <Film size={11} />
                                    {lang === 'zh' ? '画面描述（可选，留空则由AI自动生成）' : 'Visual Description (optional, AI will generate if empty)'}
                                </label>
                                <textarea
                                    className="magic-input"
                                    value={scene.luma_prompt}
                                    onChange={e => updateScene(i, 'luma_prompt', e.target.value)}
                                    placeholder={lang === 'zh' ? '留空即可，AI 会根据脚本自动生成最优画面提示词...' : 'Leave blank — AI will generate the optimal visual prompt from your script...'}
                                    style={{ minHeight: '55px', fontSize: '0.8rem', padding: '0.65rem', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', color: 'var(--text-secondary)', resize: 'vertical' }}
                                />
                            </div>

                            {/* Completion indicator */}
                            {scene.tts_text.trim() && (
                                <div style={{ position: 'absolute', top: '1rem', right: scene.ai_filling ? '6rem' : '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: '#10b981' }}>
                                    {!scene.ai_filling && <><CheckCircle2 size={12} /> 已填写</>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Launch Button */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {allScenesHaveText
                            ? <span style={{ color: '#10b981' }}>✅ {lang === 'zh' ? `${scenes.length} 个分镜已就绪，可以开始渲染` : `${scenes.length} scenes ready to render`}</span>
                            : <span style={{ color: '#f59e0b' }}>⚠️ {lang === 'zh' ? '请确保每个分镜都有配音脚本' : 'All scenes need a voiceover script'}</span>
                        }
                    </div>
                    <button
                        className="btn-primary"
                        onClick={runPipeline}
                        disabled={!allScenesHaveText}
                        style={{ opacity: allScenesHaveText ? 1 : 0.4, cursor: allScenesHaveText ? 'pointer' : 'not-allowed', gap: '0.6rem' }}
                    >
                        <Film size={18} />
                        {lang === 'zh' ? '开始生成视频' : 'Start Rendering'}
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // ============== EXECUTE PHASE UI ==============
    const steps = [
        { id: 'tts_luma', label: lang === 'zh' ? '配音 + 触发渲染' : 'TTS + Fire Renders' },
        { id: 'luma', label: lang === 'zh' ? 'Luma 多镜头渲染' : 'Multi-Scene Rendering' },
        { id: 'stitch', label: lang === 'zh' ? '剪辑 + 拼接' : 'Edit & Stitch' },
        { id: 'done', label: lang === 'zh' ? '导出完成' : 'Export Done' },
    ];

    return (
        <div className="glass-panel animate-fade-in" style={{ width: '100%' }}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="card-title m-0" style={{ fontSize: '1.2rem' }}>
                    <Film size={18} style={{ display: 'inline', marginRight: '0.7rem', color: 'var(--accent-primary)' }} />
                    {lang === 'zh' ? '🎬 正在生成您的视频...' : '🎬 Rendering Your Video...'}
                </h2>
                {onClose && <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>✕</button>}
            </div>

            {/* Step Tracker */}
            <div className="flex gap-2 mb-6" style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {steps.map((step, i) => {
                    const isActive = currentStep === step.id;
                    const isDone = currentStepIndex > i;
                    return (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)', color: isDone ? '#10b981' : isActive ? 'var(--accent-primary)' : 'var(--text-secondary)', border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : isActive ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                                {isDone ? <CheckCircle2 size={12} /> : isActive ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />}
                                {step.label}
                            </div>
                            {i < steps.length - 1 && <ChevronRight size={12} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                        </div>
                    );
                })}
            </div>

            {/* Scene Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                {scenes.map((scene, i) => (
                    <div key={scene.scene_id} style={{ padding: '0.85rem', borderRadius: '12px', background: scene.status === 'completed' ? 'rgba(16,185,129,0.07)' : scene.status === 'failed' ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${scene.status === 'completed' ? 'rgba(16,185,129,0.2)' : scene.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Scene {i + 1}</span>
                            {scene.status === 'completed' ? <CheckCircle2 size={13} color="#10b981" /> : scene.status === 'failed' ? <AlertCircle size={13} color="#ef4444" /> : <Loader2 size={13} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />}
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4, margin: '0 0 0.4rem 0' }}>{scene.tts_text}</p>
                        {scene.tts_audio && <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Mic size={10} />配音就绪</div>}
                    </div>
                ))}
            </div>

            {/* Final Video */}
            {finalVideoUrl && (
                <div style={{ textAlign: 'center', marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
                    <h4 style={{ color: '#10b981', marginBottom: '1rem' }}>🎬 视频已生成！</h4>
                    <video src={finalVideoUrl} controls autoPlay style={{ maxWidth: '300px', maxHeight: '533px', borderRadius: '16px', border: '2px solid rgba(16,185,129,0.3)', display: 'block', margin: '0 auto' }} />
                    <a href={finalVideoUrl} download="easymake_director.mp4" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', textDecoration: 'none' }}>
                        <Download size={16} />
                        下载 9:16 竖版视频
                    </a>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                        <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ color: '#ef4444', fontWeight: 600, margin: '0 0 0.2rem' }}>错误</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{error}</p>
                        </div>
                    </div>
                    {canRetryStitch && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                            <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                ✅ 所有视频和配音已就绪——可以直接重试剪辑而无需重新渲染
                            </p>
                            <button
                                onClick={retryStitch}
                                className="btn-primary"
                                style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', gap: '0.5rem' }}
                            >
                                <Scissors size={15} />
                                重试剪辑拼接 (Retry Stitch)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Log */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.85rem', fontFamily: 'monospace', fontSize: '0.72rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--accent-primary)', marginBottom: '0.4rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline Log</p>
                {log.map((entry, i) => (
                    <div key={i} style={{ color: entry.includes('❌') ? '#ef4444' : entry.includes('✅') || entry.includes('🎬') ? '#10b981' : 'var(--text-secondary)', lineHeight: 1.6 }}>{entry}</div>
                ))}
            </div>
        </div>
    );
}
