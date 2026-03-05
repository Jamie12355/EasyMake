import { useState, useEffect } from 'react';
import { X, Play, Download, Trash2, Calendar, Film } from 'lucide-react';

export default function VideoGallery({ onClose, lang = 'zh' }) {
    const [videos, setVideos] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all' or industry name

    useEffect(() => {
        loadVideosFromHistory();
    }, []);

    const loadVideosFromHistory = () => {
        try {
            const history = localStorage.getItem('easyMakeHistory');
            if (history) {
                const parsed = JSON.parse(history);
                // Filter only video entries
                const videoEntries = parsed.filter(item => item.videoUrl);
                setVideos(videoEntries);
            }
        } catch (err) {
            console.error('Failed to load videos:', err);
        }
    };

    const deleteVideo = (id) => {
        try {
            const history = localStorage.getItem('easyMakeHistory');
            if (history) {
                const parsed = JSON.parse(history);
                const updated = parsed.filter(item => item.id !== id);
                localStorage.setItem('easyMakeHistory', JSON.stringify(updated));
                setVideos(updated.filter(item => item.videoUrl));
            }
        } catch (err) {
            console.error('Failed to delete video:', err);
        }
    };

    const clearAll = () => {
        if (window.confirm(lang === 'zh' ? '确定要删除所有视频吗？' : 'Delete all videos?')) {
            localStorage.setItem('easyMakeHistory', JSON.stringify([]));
            setVideos([]);
        }
    };

    const formatDate = (timestamp) => {
        try {
            return new Date(timestamp).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return timestamp;
        }
    };

    const filteredVideos = filter === 'all'
        ? videos
        : videos.filter(v => v.industry === filter);

    return (
        <div className="glass-panel animate-fade-in" style={{ width: '100%' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="card-title m-0" style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                        <Film size={24} style={{ color: 'var(--accent-primary)' }} />
                        {lang === 'zh' ? '📹 视频库' : '📹 Video Gallery'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {lang === 'zh' ? `共 ${filteredVideos.length} 个视频，支持静音自动播放` : `${filteredVideos.length} videos with silent autoplay`}
                    </p>
                </div>
                {onClose && (
                    <button
                        className="btn-secondary"
                        onClick={onClose}
                        style={{ fontSize: '0.8rem' }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {videos.length === 0 ? (
                <div style={{
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255,255,255,0.1)'
                }}>
                    <Film size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        {lang === 'zh' ? '暂无视频，生成您的第一个视频吧！' : 'No videos yet. Create your first one!'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setFilter('all')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '20px',
                                    border: filter === 'all' ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                                    background: filter === 'all' ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.02)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                }}
                            >
                                {lang === 'zh' ? '全部' : 'All'} ({videos.length})
                            </button>
                        </div>
                        <button
                            onClick={clearAll}
                            className="btn-secondary"
                            style={{ fontSize: '0.8rem', marginLeft: 'auto', padding: '0.5rem 1rem' }}
                        >
                            <Trash2 size={14} />
                            {lang === 'zh' ? '全部删除' : 'Clear All'}
                        </button>
                    </div>

                    {/* Video Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: '1.25rem'
                    }}>
                        {filteredVideos.map((video) => (
                            <div
                                key={video.id}
                                style={{
                                    position: 'relative',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    transition: 'all 0.3s',
                                    aspectRatio: '9/16'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                    e.currentTarget.style.borderColor = 'rgba(37,99,235,0.5)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                            >
                                {/* Video */}
                                <video
                                    key={`${video.id}-video`}
                                    src={video.videoUrl}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                />

                                {/* Overlay Info */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    padding: '0.75rem',
                                    opacity: 0,
                                    transition: 'opacity 0.3s',
                                    pointerEvents: 'none'
                                }}
                                className="video-card-overlay"
                                >
                                    {/* Metadata */}
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.4rem' }}>
                                        <Calendar size={11} />
                                        {formatDate(video.timestamp)}
                                    </div>

                                    {/* Idea Preview */}
                                    <p style={{
                                        fontSize: '0.75rem',
                                        color: 'white',
                                        margin: '0 0 0.4rem 0',
                                        lineHeight: 1.3,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {video.idea}
                                    </p>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <a
                                            href={video.videoUrl}
                                            download={`easymake_${video.id}.mp4`}
                                            className="btn-primary"
                                            style={{
                                                flex: 1,
                                                fontSize: '0.7rem',
                                                padding: '0.4rem 0.6rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.3rem',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <Download size={11} />
                                            {lang === 'zh' ? '下载' : 'DL'}
                                        </a>
                                        <button
                                            onClick={() => deleteVideo(video.id)}
                                            style={{
                                                background: 'rgba(239,68,68,0.2)',
                                                border: '1px solid rgba(239,68,68,0.3)',
                                                color: '#ef4444',
                                                borderRadius: '6px',
                                                padding: '0.4rem 0.6rem',
                                                cursor: 'pointer',
                                                fontSize: '0.7rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>

                                {/* Play Icon (visible always) */}
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(37,99,235,0.8)',
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.3s',
                                    pointerEvents: 'none'
                                }}
                                className="video-card-play"
                                >
                                    <Play size={24} fill="white" color="white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* CSS for hover effects */}
            <style>{`
                .glass-panel:hover .video-card-overlay {
                    opacity: 1;
                }
                .glass-panel:hover .video-card-play {
                    opacity: 1;
                }
            `}</style>
        </div>
    );
}
