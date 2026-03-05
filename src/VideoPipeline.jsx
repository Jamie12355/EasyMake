import { useState, useRef, useEffect, useCallback } from 'react';
import { Film, Mic, Scissors, Download, CheckCircle2, Loader2, AlertCircle, Play, ChevronRight, Plus, Minus, Sparkles, Pencil, ArrowRight, Wand2 } from 'lucide-react';


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
    // Phase: 'input' | 'review' | 'execute' | 'done'
    const [phase, setPhase] = useState('input');
    const [sceneCount, setSceneCount] = useState(3);
    const [scriptInput, setScriptInput] = useState(idea || '');
    const [videoMode, setVideoMode] = useState('real_person'); // 'real_person' | 'cartoon'
    const [scenes, setScenes] = useState([DEFAULT_SCENE(1), DEFAULT_SCENE(2), DEFAULT_SCENE(3)]);
    const [log, setLog] = useState([]);
    const [currentStep, setCurrentStep] = useState('');
    const [finalVideoUrl, setFinalVideoUrl] = useState(null);
    const [error, setError] = useState(null);
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
                    idea: `为以下视频分镜写一句中文旁白：\n视频模式要求：${videoMode === 'cartoon' ? '3D卡通风格，不要出现真人' : '真人出镜，自然说话口型'}\n主题：${idea || '留学机构介绍'}\n场景角色：${scene.scene_label_zh}（${scene.scene_label}）\n要求：不超过25个中文字，简洁有力，适合视频配音`,
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
                body: JSON.stringify({ idea: scriptInput, advanced, scene_count: sceneCount, videoMode })
            });
            if (!res.ok) throw new Error('Script generation failed');
            const { scenes: generated } = await res.json();
            setScenes(generated.map((s, i) => ({
                ...DEFAULT_SCENE(i + 1),
                ...s,
                ai_filling: false,
                status: 'pending'
            })));
            setPhase('review');
        } catch (e) {
            console.error('Auto fill all failed:', e);
            setScenes(prev => prev.map(s => ({ ...s, ai_filling: false })));
        }
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
        addLog('提交云端混流剪辑任务...');

        const validScenes = finalScenes.filter(s => s.status === 'completed' && s.video_url);
        if (validScenes.length === 0) throw new Error('没有可用的视频片段');

        try {
            const res = await fetch('/api/pipeline-stitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes: validScenes, brandName: 'EasyMake' })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '云端混流失败');
            }

            const data = await res.json();

            if (!data.video_url) {
                throw new Error('云端混流未返回视频链接');
            }

            addLog('✅ 剪辑完毕！');
            return data.video_url;
        } catch (err) {
            console.error('Stitch error:', err);
            throw new Error(err.message || '云剪辑服务连接失败');
        }
    };


    const performLipSync = async (scenesData) => {
        addLog(`开始执行 ${scenesData.length} 个分镜的唇形同步任务...`);
        const synced = [...scenesData];
        const syncJobs = await Promise.all(scenesData.map(async (scene, i) => {
            if (scene.status !== 'completed' || !scene.video_url || !scene.tts_audio_url) return null;
            addLog(`请求 Scene ${i + 1} 唇形同步...`);
            try {
                const res = await fetch('/api/pipeline-lipsync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_url: scene.video_url, audio_url: scene.tts_audio_url })
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                return { index: i, taskId: data.taskId };
            } catch (e) {
                console.error(`Lip Sync init failed for scene ${i}:`, e);
                return null;
            }
        }));

        const validJobs = syncJobs.filter(Boolean);
        if (validJobs.length === 0) return synced;

        addLog(`监控 ${validJobs.length} 个唇形同步任务...`);
        let completed = new Array(validJobs.length).fill(false);
        while (!completed.every(Boolean)) {
            await new Promise(r => setTimeout(r, 5000));
            const activeJobs = validJobs.filter((_, idx) => !completed[idx]);
            if (activeJobs.length === 0) break;

            const ids = activeJobs.map(j => j.taskId).join(',');
            const res = await fetch(`/api/lipsync-status?ids=${ids}`);
            if (!res.ok) continue;

            const { results } = await res.json();
            results.forEach((r) => {
                const jobIndex = validJobs.findIndex(j => j.taskId === r.id);
                if (jobIndex === -1) return;

                const sceneIndex = validJobs[jobIndex].index;
                if (r.status === 'completed' && r.video_url) {
                    if (!completed[jobIndex]) addLog(`✅ Scene ${sceneIndex + 1} 唇形同步完成`);
                    completed[jobIndex] = true;
                    // Replace video_url with the synced one
                    synced[sceneIndex] = { ...synced[sceneIndex], video_url: r.video_url };
                    setScenes([...synced]);
                } else if (r.status === 'failed') {
                    if (!completed[jobIndex]) addLog(`❌ Scene ${sceneIndex + 1} 唇形同步失败，保留原视频`);
                    completed[jobIndex] = true;
                } else {
                    addLog(`👄 Scene ${sceneIndex + 1} 唇对齐中...`);
                }
            });
        }
        return synced;
    };

    const runPipeline = async () => {
        const validScenes = scenes.filter(s => s.tts_text.trim());
        if (validScenes.length === 0) return;
        setPhase('execute');
        setCurrentStep(videoMode === 'real_person' ? 'kling_video' : 'tts_luma');
        setError(null);
        setLog([]);
        setFinalVideoUrl(null);
        try {
            addLog(`开始执行 ${validScenes.length} 个分镜的渲染任务... (${videoMode === 'real_person' ? 'Kling AI 模式' : 'Luma + MiniMax 模式'})`);
            const res = await fetch('/api/pipeline-execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenes: validScenes, videoMode })  // ✓ 传递 videoMode
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '执行失败');
            }
            const { scenes: enriched } = await res.json();
            setScenes(enriched);

            if (videoMode === 'real_person') {
                // ✓ Kling 模式: 视频 + TTS + 唇形同步已经全部完成
                addLog(`✅ Kling AI 生成完毕 (视频 + 配音 + 唇形同步)！`);
                setCurrentStep('done');

                // 直接使用第一个分镜的视频作为预览
                const firstVideo = enriched.find(s => s.video_url);
                if (firstVideo) {
                    setFinalVideoUrl(firstVideo.video_url);
                    addLog('🎬 视频预览已加载！');
                }
            } else {
                // 卡通模式: 保持原有流程 (Luma + MiniMax + Shotstack)
                addLog(`✅ Luma + MiniMax 任务已提交！`);
                setCurrentStep('luma');
                const finalScenes = await pollScenes(enriched);
                const outputUrl = await stitchVideos(finalScenes);
                setFinalVideoUrl(outputUrl);
                setCurrentStep('done');
                addLog('🎬 视频生成完毕！');
            }
        } catch (err) {
            const errMsg = err?.message || String(err) || '未知错误，请检查浏览器控制台';
            setError(errMsg);
            setCurrentStep('error');
            addLog(`❌ 错误: ${errMsg}`);
            console.error('[Pipeline] Full error:', err);
        }
    };

    // ✓ 简化步骤顺序: 真人模式和卡通模式不同
    let stepOrder = [];
    if (videoMode === 'real_person') {
        stepOrder = ['kling_video', 'done'];  // 简洁: 视频生成 → 完成
    } else {
        stepOrder = ['tts_luma', 'luma', 'stitch', 'done'];  // 卡通: 保持原有流程
    }
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

    // Retry the entire pipeline from the beginning
    const retryFullPipeline = () => {
        setError(null);
        setFinalVideoUrl(null);
        setLog([]);
        setPhase('review');  // Go back to review phase to allow modifications
    };

    // ============== INPUT PHASE UI ==============
    if (phase === 'input') {
        return (
            <div className="glass-panel animate-fade-in" style={{ width: '100%' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="card-title m-0" style={{ fontSize: '1.3rem' }}>
                            <Film size={20} style={{ display: 'inline', marginRight: '0.7rem', color: 'var(--accent-primary)' }} />
                            {lang === 'zh' ? '🎬 视频导演模式 — 输入脚本' : '🎬 Director Mode — Input Script'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {lang === 'zh' ? '输入您的完整配音脚本，我们将为您智能拆分并生成分镜提示词' : 'Input your full voiceover script, and we will intelligently break it down into scenes and prompts'}
                        </p>
                    </div>
                    {onClose && <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>✕</button>}
                </div>

                {/* Script Input Textarea */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                        {lang === 'zh' ? '完整视频文案（旁白配音）' : 'Full Voiceover Script'}
                    </label>
                    <textarea
                        className="magic-input"
                        value={scriptInput}
                        onChange={e => setScriptInput(e.target.value)}
                        placeholder={lang === 'zh' ? '在此处粘贴您想让配音朗读的完整脚本文案...' : 'Paste your full voiceover script here...'}
                        style={{ minHeight: '120px', fontSize: '0.9rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', resize: 'vertical' }}
                    />
                </div>

                {/* Sleek Bottom Control Bar */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Scene Count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{lang === 'zh' ? '分镜数' : 'Scenes'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.2rem' }}>
                                <button onClick={() => adjustSceneCount(-1)} disabled={sceneCount <= MIN_SCENES} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.2rem 0.5rem', opacity: sceneCount <= MIN_SCENES ? 0.3 : 1 }}><Minus size={14} /></button>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '1.2rem', textAlign: 'center' }}>{sceneCount}</span>
                                <button onClick={() => adjustSceneCount(1)} disabled={sceneCount >= MAX_SCENES} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.2rem 0.5rem', opacity: sceneCount >= MAX_SCENES ? 0.3 : 1 }}><Plus size={14} /></button>
                            </div>
                        </div>

                        {/* Video Mode */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{lang === 'zh' ? '模式' : 'Mode'}</span>
                            <select
                                value={videoMode}
                                onChange={e => setVideoMode(e.target.value)}
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="real_person" style={{ color: 'black' }}>{lang === 'zh' ? '真人发声 (Real Person)' : 'Real Person'}</option>
                                <option value="cartoon" style={{ color: 'black' }}>{lang === 'zh' ? '3D卡通旁白 (Cartoon)' : 'Cartoon Animation'}</option>
                            </select>
                        </div>
                    </div>

                    {/* Launch Parse Button */}
                    <button
                        onClick={aiAutoFillAll}
                        disabled={scenes.some(s => s.ai_filling)}
                        className="btn-primary"
                        style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', borderRadius: '12px' }}
                    >
                        {scenes.some(s => s.ai_filling) ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                        {lang === 'zh' ? '解析脚本并生成所有分镜' : 'Parse Script & Generate'}
                    </button>
                </div>
            </div>
        );
    }

    // ============== REVIEW PHASE UI ==============
    if (phase === 'review') {
        return (
            <div className="glass-panel animate-fade-in" style={{ width: '100%' }}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="card-title m-0" style={{ fontSize: '1.3rem' }}>
                            <Film size={20} style={{ display: 'inline', marginRight: '0.7rem', color: 'var(--accent-primary)' }} />
                            {lang === 'zh' ? '👀 审核并确认分镜提示词' : '👀 Review & Confirm Scene Prompts'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {lang === 'zh' ? '你可以基于喜好修改生成的提示词文案，确认无误再提交API生成视频' : 'You can edit the generated prompts based on your preference before calling the API'}
                        </p>
                    </div>
                    {onClose && <button className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>✕</button>}
                </div>

                {/* Back to Input Action */}
                <button
                    onClick={() => setPhase('input')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: 0, marginBottom: '1.5rem' }}
                >
                    <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> {lang === 'zh' ? '返回修改源脚本' : 'Back to Script'}
                </button>

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
                                    {lang === 'zh' ? 'AI 重新生成该幕' : 'Regenerate Scene'}
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
    // ✓ 真人模式: Kling AI (简洁流程) | 卡通模式: Luma + Shotstack (原有流程)
    const steps = videoMode === 'real_person'
        ? [
            { id: 'kling_video', label: lang === 'zh' ? 'Kling 视频生成' : 'Kling AI Rendering' },
            { id: 'done', label: lang === 'zh' ? '导出完成' : 'Export Done' }
        ]
        : [
            { id: 'tts_luma', label: lang === 'zh' ? '配音 + 触发渲染' : 'TTS + Fire Renders' },
            { id: 'luma', label: lang === 'zh' ? '多镜头并行渲染' : 'Multi-Scene Rendering' },
            { id: 'stitch', label: lang === 'zh' ? '云端混流拼接' : 'Edit & Stitch' },
            { id: 'done', label: lang === 'zh' ? '导出完成' : 'Export Done' }
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

            {/* Final Video - Cinematic Theater */}
            {finalVideoUrl && (
                <div style={{ marginTop: '2.5rem', animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '360px', margin: '0 auto', aspectRatio: '9/16', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
                        <video src={finalVideoUrl} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '2rem 1.5rem 1.5rem', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                            <a href={finalVideoUrl} download="easymake_director.mp4" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', padding: '0.8rem 1.8rem', borderRadius: '100px', fontSize: '0.95rem', pointerEvents: 'auto', boxShadow: '0 8px 20px rgba(37,99,235,0.5)' }}>
                                <Download size={18} /> {lang === 'zh' ? '保存竖版高清视频' : 'Save HD Video'}
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                        <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ color: '#ef4444', fontWeight: 600, margin: '0 0 0.2rem' }}>{lang === 'zh' ? '错误' : 'Error'}</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{error}</p>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(239,68,68,0.15)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {canRetryStitch ? (
                            <>
                                <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: 0, width: '100%' }}>
                                    ✅ {lang === 'zh' ? '所有视频和配音已就绪——可以直接重试剪辑而无需重新渲染' : 'All videos and audio are ready — retry stitching without re-rendering'}
                                </p>
                                <button
                                    onClick={retryStitch}
                                    className="btn-primary"
                                    style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', gap: '0.5rem' }}
                                >
                                    <Scissors size={15} />
                                    {lang === 'zh' ? '重试剪辑拼接' : 'Retry Stitching'}
                                </button>
                            </>
                        ) : (
                            <>
                                <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: 0, width: '100%' }}>
                                    🔄 {lang === 'zh' ? '请重试生成视频或返回修改脚本' : 'Try regenerating or go back to modify the script'}
                                </p>
                                <button
                                    onClick={retryFullPipeline}
                                    className="btn-primary"
                                    style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', gap: '0.5rem' }}
                                >
                                    <Loader2 size={15} />
                                    {lang === 'zh' ? '重新生成视频' : 'Retry Generation'}
                                </button>
                                <button
                                    onClick={() => setPhase('review')}
                                    className="btn-secondary"
                                    style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', gap: '0.5rem' }}
                                >
                                    <Pencil size={15} />
                                    {lang === 'zh' ? '修改脚本' : 'Edit Script'}
                                </button>
                            </>
                        )}
                    </div>
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
