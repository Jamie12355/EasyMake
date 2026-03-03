import { useState, useEffect } from 'react';
import { Sparkles, Wand2, Copy, Video, CheckCircle2, ArrowRight, Play, FastForward, Globe, Settings2, ChevronDown, ChevronUp, Image, Film, Briefcase, ShoppingBag, Home, MapPin, Rocket } from 'lucide-react';
import { generateContent, generateVideo, generateImage } from './api';
import VideoPipeline from './VideoPipeline';
import ShotstackTest from './ShotstackTest';
import './index.css';
import './App.css';

const IND_CONFIG = {
  study_abroad: {
    id: "study_abroad",
    icon: <Globe size={28} />,
    label_zh: "留学机构",
    label_en: "Study Abroad",
    badge_zh: "✨ 专为留学机构打造的零摩擦内容工具",
    badge_en: "✨ The easiest way for study abroad agencies to generate content",
    heroSubtitle_zh: "只需输入您的想法，EasyMake 即可瞬间为您的留学机构生成引人入胜的社媒文案与高质量的介绍动画。",
    heroSubtitle_en: "Just tell us your idea. EasyMake instantly generates engaging social media copies and high-quality animations for your education agency.",
    ideaPlaceholder_zh: "例如：介绍我们的英国本科名校申请服务...",
    ideaPlaceholder_en: "e.g., Introduction to our UK University application service...",
    adv_bgInfo_zh: "例如：深耕留英10年、G5名校导师团队...",
    adv_bgInfo_en: "e.g., 10 years experience, G5 alumni...",
    adv_audience_zh: "例如：准备申请英国本科的高中生家长...",
    adv_audience_en: "e.g., Parents of high school students applying to UK..."
  },
  ecommerce: {
    id: "ecommerce",
    icon: <ShoppingBag size={28} />,
    label_zh: "电商带货",
    label_en: "E-commerce",
    badge_zh: "✨ 专为电商带货打造的零摩擦内容工具",
    badge_en: "✨ The easiest way for e-commerce to generate content",
    heroSubtitle_zh: "只需输入您的想法，EasyMake 即可瞬间为您的电商店铺生成爆款种草文案与高质量的带货动画。",
    heroSubtitle_en: "Just tell us your idea. EasyMake instantly generates engaging social media copies and high-quality product animations.",
    ideaPlaceholder_zh: "例如：推荐我们的新款便携榨汁机，突出续航和便携...",
    ideaPlaceholder_en: "e.g., Recommend our new portable blender, highlight battery & size...",
    adv_bgInfo_zh: "例如：自有工厂、三年质保、全网销量Top1...",
    adv_bgInfo_en: "e.g., Own factory, 3-year warranty, Top seller...",
    adv_audience_zh: "例如：注重性价比的学生党和年轻上班族...",
    adv_audience_en: "e.g., Budget-conscious students and young professionals..."
  },
  real_estate: {
    id: "real_estate",
    icon: <Home size={28} />,
    label_zh: "房产营销",
    label_en: "Real Estate",
    badge_zh: "✨ 专为房产营销打造的零摩擦内容工具",
    badge_en: "✨ The easiest way for real estate to generate content",
    heroSubtitle_zh: "只需输入您的想法，EasyMake 即可瞬间为您的房产项目生成吸睛文案与极具奢华感的看房动画。",
    heroSubtitle_en: "Just tell us your idea. EasyMake instantly generates engaging social media copies and luxurious property tour animations.",
    ideaPlaceholder_zh: "例如：介绍市中心的豪华海景大平层，强调无遮挡视野...",
    ideaPlaceholder_en: "e.g., Introducing a luxury ocean-view penthouse downtown...",
    adv_bgInfo_zh: "例如：世界500强开发商、金牌物业...",
    adv_bgInfo_en: "e.g., Top 500 developer, premium property management...",
    adv_audience_zh: "例如：寻找改善型住房的高净值人群...",
    adv_audience_en: "e.g., High net-worth individuals looking for luxury homes..."
  },
  local_service: {
    id: "local_service",
    icon: <MapPin size={28} />,
    label_zh: "本地生活",
    label_en: "Local Services",
    badge_zh: "✨ 专为本地生活服务打造的零摩擦内容工具",
    badge_en: "✨ The easiest way for local businesses to generate content",
    heroSubtitle_zh: "只需输入您的想法，EasyMake 即可瞬间为您的门店生成同城引流文案与探店动画。",
    heroSubtitle_en: "Just tell us your idea. EasyMake instantly generates engaging local promos and store-tour animations.",
    ideaPlaceholder_zh: "例如：新开业的日式烧肉店周末双人套餐特惠...",
    ideaPlaceholder_en: "e.g., Grand opening of our Japanese BBQ weekend set meal...",
    adv_bgInfo_zh: "例如：大众点评必吃榜、全城仅此一家...",
    adv_bgInfo_en: "e.g., Top rated on Yelp, exclusive local dining...",
    adv_audience_zh: "例如：喜欢打卡美食的年轻情侣...",
    adv_audience_en: "e.g., Foodies and young couples..."
  },
  tech_startup: {
    id: "tech_startup",
    icon: <Rocket size={28} />,
    label_zh: "科技创业",
    label_en: "Tech Startup",
    badge_zh: "✨ 专为科技创业打造的零摩擦内容工具",
    badge_en: "✨ The easiest way for tech startups to generate content",
    heroSubtitle_zh: "只需输入您的想法，EasyMake 即可瞬间为您的科技产品生成极具未来感的发布文案与演示动画。",
    heroSubtitle_en: "Just tell us your idea. EasyMake instantly generates engaging futuristic product launch copies and demo animations.",
    ideaPlaceholder_zh: "例如：发布我们全新的AI智能健康检测戒指...",
    ideaPlaceholder_en: "e.g., Launching our new AI smart health tracking ring...",
    adv_bgInfo_zh: "例如：硅谷研发团队、获得千万美元融资...",
    adv_bgInfo_en: "e.g., Silicon Valley based, backed by top VCs...",
    adv_audience_zh: "例如：热爱科技尝鲜的数码极客...",
    adv_audience_en: "e.g., Tech geeks and early adopters..."
  }
};



const i18n = {
  zh: {
    dashboard: "仪表盘",
    badge: "✨ 专为留学机构打造的零摩擦内容生成工具",
    heroTitle: "打造爆款社媒内容",
    heroHighlight: "零摩擦。",
    heroSubtitle: "只需输入您的想法，EasyMake 即可瞬间为您的留学机构生成引人入胜的社媒文案与高质量的介绍动画。",
    ideaTitle: "您的想法是？",
    ideaPlaceholder: "例如：介绍我们的英国本科名校申请服务...",
    ideaFooter: "只需点击一次，剩下的交给我们。",
    generateBtn: "一键生成魔法",
    directorModeBtn: "🎬 视频导演模式 (AI 自动剪辑)",
    directorModeDesc: "脚本 → 配音 → 分镜 → Luma → 剪辑拼接 → 9:16 导出",
    statusTitle: "魔法正在生效",
    statusTextActive: "正在为您撰写极具吸引力的爆款文案...",
    statusTextDone: "文案撰写完成",
    statusTextDesc: "正在优化互动性与内容清晰度",
    statusVidActive: "正在渲染介绍动画...",
    statusVidDone: "动画渲染完成",
    statusVidWait: "等待开始渲染视频动画",
    statusVidDesc: "正在生成关键帧并添加动态效果",
    statusImgActive: "正在为您绘制超清配图...",
    statusImgDone: "配图绘制完成",
    statusImgWait: "等待绘制静止影像",
    statusImgDesc: "使用 Photon 模型进行视觉推理",
    resultTextTitle: "生成的社媒贴文",
    copyBtn: "复制文案",
    copiedBtn: "已复制！",
    resultVidTitle: "介绍动画",
    resultImgTitle: "社媒配图",
    downloadBtn: "下载",
    createAnotherBtn: "创建下一篇帖子",
    langCode: "中 / EN",
    switchLang: "Switch to English",
    advancedSettings: "高级设置（可选）",
    tones: "预期语气",
    tonesPlaceholder: "例如：专业、热情、鼓励...",
    animPref: "画面偏好",
    animPrefOption1: "无偏好 (General)",
    animPrefOption2: "混合拼贴/剪纸风 (Mixed Media Collage)",
    animPrefOption3: "超写实电影级 (Cinematic Realism)",
    animPrefOption4: "3D 动漫风 (3D Pixar Style)",
    cameraMove: "运镜要求 (Camera)",
    cameraMoveOption1: "自动决定 (Auto)",
    cameraMoveOption2: "平滑跟拍 (Smooth Tracking)",
    cameraMoveOption3: "FPV 穿越机第一人称 (FPV Drone)",
    cameraMoveOption4: "电影级推拉 (Cinematic Zoom IN/OUT)",
    lighting: "光影氛围 (Lighting)",
    lightingOption1: "自动决定 (Auto)",
    lightingOption2: "清晨阳光/体积光 (Volumetric Golden Hour)",
    lightingOption3: "电影感暗调深邃光 (Dark Moody Cinematic)",
    lightingOption4: "赛博霓虹光 (Cyberpunk Neon)",
    bgInfo: "机构背景",
    bgInfoPlaceholder: "例如：深耕留英10年、G5名校导师团队...",
    audience: "目标群众",
    audiencePlaceholder: "例如：准备申请英国本科的高中生家长...",
    response: "期望效果",
    responsePlaceholder: "期望他们看后感到专业可靠，并私信咨询...",
    targetUniv: "目标院校库",
    targetUnivOption1: "无偏好 (General)",
    targetUnivOption2: "G5 超级精英",
    targetUnivOption3: "王曼星华 (KCL, Manchester, Warwick, Edinburgh)",
    targetUnivOption4: "澳洲八大名校 (Go8)",
    targetUnivOption5: "美国常春藤 (Ivy League)",
    targetUnivOption6: "QS 世界前50名校",
    targetUnivOption7: "泛商科顶尖名校 (LBS, WBS, Cass...)",
    targetUnivOption8: "艺术设计顶尖名校 (UAL, Parsons, RISD...)",
    targetUnivOption9: "港三新二 (HKU, CUHK, HKUST, NUS, NTU)",
    urgencyHook: "开启申请季黄金倒计时",
    urgencyHookDesc: "自动在内容中植入申请截止日期等紧迫感锚点",
    cta: "生成私域引流转化文案",
    ctaDesc: "自动在文末添加'私聊领取资料'等高转化引导",
    limitReached: "今日额度已用完",
    limitReachedDesc: "为控制 API 成本，每个用户每天最多生成 99 次 (搭载 Luma Ray 2 混合渲染模型)",
    generationsLeft: "今日剩余生成次数:",
    genTextLabel: "生成社媒文案 (DeepSeek)",
    genVideoLabel: "附加生成视频动画 (Luma Ray 2)",
    genImageLabel: "附加生成高清配图 (Luma Photon)",
  },
  en: {
    dashboard: "Dashboard",
    badge: "✨ The easiest way for influencers to generate content",
    heroTitle: "Create viral posts with",
    heroHighlight: "Zero Friction.",
    heroSubtitle: "Just tell us your idea. EasyMake instantly generates engaging Chinese social media captions and high-quality introductory animations for your 留学 agency.",
    ideaTitle: "What's your idea?",
    ideaPlaceholder: "e.g., Introduction to our UK University application service...",
    ideaFooter: "Press exactly one button. We do the rest.",
    generateBtn: "Generate Magic",
    directorModeBtn: "🎬 Video Director Mode (AI Auto-Edit)",
    directorModeDesc: "Script → TTS → Storyboard → Luma → Stitch → 9:16 Export",
    statusTitle: "Crafting Your Content",
    statusTextActive: "Writing captivating Chinese social media copy...",
    statusTextDone: "Copywriting Completed",
    statusTextDesc: "Optimizing for engagement and clarity",
    statusVidActive: "Rendering introductory animation...",
    statusVidDone: "Animation Rendered",
    statusVidWait: "Waiting to render introductory animation",
    statusVidDesc: "Styling frames and creating motion",
    statusImgActive: "Rendering high-resolution image...",
    statusImgDone: "Image Rendered",
    statusImgWait: "Waiting to render image",
    statusImgDesc: "Visual synthesis via Photon",
    resultTextTitle: "Generated Social Media Post",
    copyBtn: "Copy Text",
    copiedBtn: "Copied!",
    resultVidTitle: "Introductory Animation",
    resultImgTitle: "Social Media Image",
    downloadBtn: "Download",
    createAnotherBtn: "Create Another Post",
    langCode: "EN / 中",
    switchLang: "切换为中文",
    advancedSettings: "Advanced Settings (Optional)",
    tones: "Tone of Voice",
    tonesPlaceholder: "e.g., Professional, enthusiastic, encouraging...",
    animPref: "Video Aesthetic",
    animPrefOption1: "No preference",
    animPrefOption2: "Mixed Media / Stop-motion Collage",
    animPrefOption3: "Cinematic Photorealism",
    animPrefOption4: "3D Pixar Style",
    cameraMove: "Camera Movement",
    cameraMoveOption1: "Auto",
    cameraMoveOption2: "Smooth Tracking Shot",
    cameraMoveOption3: "FPV Drone Flythrough",
    cameraMoveOption4: "Cinematic Zoom In/Out",
    lighting: "Lighting & Vibe",
    lightingOption1: "Auto",
    lightingOption2: "Volumetric Golden Hour",
    lightingOption3: "Dark Moody Cinematic",
    lightingOption4: "Cyberpunk Neon",
    bgInfo: "Agency Background",
    bgInfoPlaceholder: "e.g., 10 years experience in UK consulting, G5 alumni...",
    audience: "Target Audience",
    audiencePlaceholder: "e.g., Parents of high school students applying to UK...",
    response: "Desired Response",
    responsePlaceholder: "Feel trust and professionalism, and send a DM...",
    targetUniv: "Target University Lexicon",
    targetUnivOption1: "No preference",
    targetUnivOption2: "G5 Super Elite",
    targetUnivOption3: "King's, Manchester, Warwick, Edinburgh",
    targetUnivOption4: "Group of Eight (Go8)",
    targetUnivOption5: "US Ivy League",
    targetUnivOption6: "QS Top 50 Global Universities",
    targetUnivOption7: "Top Business Schools (LBS, WBS, Cass...)",
    targetUnivOption8: "Top Art & Design Schools (UAL, Parsons, RISD...)",
    targetUnivOption9: "Top HK & SG Universities (港三新二)",
    urgencyHook: "Enable Application Season Urgency Hooks",
    urgencyHookDesc: "Automatically inject deadline urgency anchors into content",
    cta: "Generate Private Traffic CTAs",
    ctaDesc: "Automatically append high-converting Call-to-Actions (e.g. DM for info)",
    limitReached: "Daily Limit Reached",
    limitReachedDesc: "To control API costs, each user is limited to 99 generations per day (using Luma Ray 2)",
    generationsLeft: "Daily generations remaining:",
    genTextLabel: "Generate Social Media Copy (DeepSeek)",
    genVideoLabel: "Also Generate Animation (Luma Ray 2)",
    genImageLabel: "Also Generate Image (Luma Photon)",
  }
};

function App() {
  // Dev/test route — no API costs
  if (window.location.pathname === '/shotstack-test') return <ShotstackTest />;

  const [lang, setLang] = useState("zh");
  const [industry, setIndustry] = useState("study_abroad");
  const [appStarted, setAppStarted] = useState(false);
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedArgs, setAdvancedArgs] = useState({
    tones: "",
    animPref: "",
    cameraMove: "",
    lighting: "",
    bgInfo: "",
    audience: "",
    response: "",
    targetUniv: "",
    urgencyHook: false,
    cta: false
  });
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [generateTextEnabled, setGenerateTextEnabled] = useState(true);
  const [generateVideoEnabled, setGenerateVideoEnabled] = useState(true);
  const [generateImageEnabled, setGenerateImageEnabled] = useState(true);
  const [pipelineMode, setPipelineMode] = useState(false);

  const t = i18n[lang];

  useEffect(() => {
    // Load daily limit from localStorage
    const today = new Date().toISOString().split('T')[0];
    const storedData = localStorage.getItem('easyMakeUsage');
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.date === today) {
        setGenerationsUsed(parsed.count);
      } else {
        localStorage.setItem('easyMakeUsage', JSON.stringify({ date: today, count: 0 }));
      }
    } else {
      localStorage.setItem('easyMakeUsage', JSON.stringify({ date: today, count: 0 }));
    }
  }, []);

  const toggleLanguage = () => {
    setLang(lang === "zh" ? "en" : "zh");
  };

  const handleGenerate = async () => {
    if (!idea.trim()) return;

    if (generationsUsed >= 99) {
      alert(`${t.limitReached}\n\n${t.limitReachedDesc}`);
      return;
    }

    // Update Usage
    const newCount = generationsUsed + 1;
    setGenerationsUsed(newCount);
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('easyMakeUsage', JSON.stringify({ date: today, count: newCount }));

    setStatus("generating_text");

    try {
      // 1. Generate text and video prompt via DeepSeek
      const industryName = lang === 'zh' ? IND_CONFIG[industry].label_zh : IND_CONFIG[industry].label_en;
      const llmResult = await generateContent({ idea, advanced: { ...advancedArgs, industry: industryName } });

      // We can show the text result immediately while the video is still generating!
      setResult({
        text: llmResult.social_media_post,
        videoUrl: null,
        imageUrl: null
      });

      if (generateImageEnabled) {
        setStatus("generating_image");
        const finalImageUrl = await generateImage(llmResult.image_prompt);
        setResult(prev => ({
          ...prev,
          imageUrl: finalImageUrl || "/uk_university_ad.png"
        }));
      }

      if (generateVideoEnabled) {
        setStatus("generating_video");

        // 2. Generate Video via Luma Ray Flash 2
        const finalVideoUrl = await generateVideo(llmResult.video_prompt);

        setResult(prev => ({
          ...prev,
          videoUrl: finalVideoUrl || "/uk_university_ad.png" // Fallback if no URL returned somehow
        }));
      }

      setStatus("completed");

    } catch (error) {
      console.error(error);
      alert("An error occurred during generation. Please check your API keys or network connection.");
      setStatus("idle");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStatus = () => {
    if (status === "idle") return null;

    return (
      <div className="glass-panel mt-8 animate-fade-in flex-col items-center flex">
        <h3 className="card-title text-center mb-8">
          <h1-gradient>{t.statusTitle}</h1-gradient>
        </h3>

        <div className="flex-col gap-6 w-full" style={{ maxWidth: '400px' }}>
          {/* Text Generation Step */}
          {generateTextEnabled && (
            <div className={`status-card ${status === 'generating_text' ? 'active-text' : 'active'}`}>
              <div className={`status-icon ${status === 'generating_text' ? 'spin' : status !== 'idle' ? 'success' : ''}`}>
                {status === 'generating_text' ? <Sparkles size={20} color="white" /> : <CheckCircle2 size={20} color="white" />}
              </div>
              <div className="status-text">
                <h4>{status === 'generating_text' ? t.statusTextActive : t.statusTextDone}</h4>
                <p>{t.statusTextDesc}</p>
              </div>
            </div>
          )}

          {/* Image Generation Step */}
          {generateImageEnabled && (
            <div className={`status-card ${status === 'generating_image' ? 'active-video' : (status === 'generating_video' || status === 'completed') ? 'active' : 'inactive'}`}>
              <div className={`status-icon ${(status === 'generating_video' || status === 'completed') ? 'success' : status === 'generating_image' ? 'pulse' : ''}`}>
                {(status === 'generating_video' || status === 'completed') ? <CheckCircle2 size={20} color="white" /> : <Image size={20} color="white" />}
              </div>
              <div className="status-text">
                <h4>{status === 'generating_image' ? t.statusImgActive : (status === 'generating_video' || status === 'completed') ? t.statusImgDone : t.statusImgWait}</h4>
                <p>{t.statusImgDesc}</p>
              </div>
            </div>
          )}

          {/* Video Generation Step */}
          {generateVideoEnabled && (
            <div className={`status-card ${status === 'generating_video' ? 'active-video' : status === 'completed' ? 'active' : 'inactive'}`}>
              <div className={`status-icon ${status === 'generating_video' ? 'pulse' : status === 'completed' ? 'success' : ''}`}>
                {status === 'completed' ? <CheckCircle2 size={20} color="white" /> : <Video size={20} color="white" />}
              </div>
              <div className="status-text">
                <h4>{status === 'generating_video' ? t.statusVidActive : status === 'completed' ? t.statusVidDone : t.statusVidWait}</h4>
                <p>{t.statusVidDesc}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getGridCols = () => {
    let count = 0;
    if (generateTextEnabled) count++;
    if (generateImageEnabled) count++;
    if (generateVideoEnabled) count++;
    if (count <= 1) return 'single-col';
    if (count === 3) return 'triple-col';
    return '';
  };

  const renderResult = () => {
    if (!result || status === "idle" || status === "generating_text") return null;

    return (
      <div className={`result-grid animate-fade-in mt-12 ${getGridCols()}`}>
        {/* Text Result */}
        {generateTextEnabled && (
          <div className="glass-panel flex-col flex">
            <div className="flex justify-between items-center mb-6">
              <h3 className="card-title m-0">
                <Sparkles style={{ color: 'var(--accent-primary)' }} />
                {t.resultTextTitle}
              </h3>
              <button
                onClick={copyToClipboard}
                className="btn-secondary"
              >
                {copied ? <CheckCircle2 size={16} style={{ color: '#10B981' }} /> : <Copy size={16} />}
                {copied ? t.copiedBtn : t.copyBtn}
              </button>
            </div>
            <div className="result-card-content">
              {result.text}
            </div>
          </div>
        )}

        {/* Image Result */}
        {generateImageEnabled && (
          <div className="glass-panel flex-col flex animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="card-title m-0">
                <Image style={{ color: 'var(--accent-primary)' }} />
                {t.resultImgTitle}
              </h3>
              <button className="btn-secondary text-sm">
                <FastForward size={16} />
                {t.downloadBtn}
              </button>
            </div>
            <div className="video-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {result.imageUrl ? (
                <img
                  src={result.imageUrl}
                  alt="Generated Image"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, borderRadius: '8px' }}
                />
              ) : (
                <div className="pulse" style={{ color: 'var(--text-secondary)' }}>Rendering Image from Cloud...</div>
              )}
            </div>
          </div>
        )}

        {/* Video Result */}
        {generateVideoEnabled && (
          <div className="glass-panel flex-col flex">
            <div className="flex justify-between items-center mb-6">
              <h3 className="card-title m-0">
                <Video style={{ color: 'var(--accent-secondary)' }} />
                {t.resultVidTitle}
              </h3>
              <button className="btn-secondary text-sm">
                <FastForward size={16} />
                {t.downloadBtn}
              </button>
            </div>
            <div className="video-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {result.videoUrl ? (
                result.videoUrl.endsWith('.mp4') ? (
                  <video
                    src={result.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
                  />
                ) : (
                  <>
                    <img
                      src={result.videoUrl}
                      alt="Generated Animation Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, opacity: 0.8 }}
                    />
                    <div style={{ position: 'relative', zIndex: 10, background: 'rgba(255,255,255,0.2)', padding: '1.5rem', borderRadius: '50%', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      <Play size={40} color="white" style={{ fill: 'white', marginLeft: '5px' }} />
                    </div>
                  </>
                )
              ) : (
                <div className="pulse" style={{ color: 'var(--text-secondary)' }}>Rendering Video from Cloud...</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'hidden' }}>
        <video
          src="https://cdn.pixabay.com/video/2019/11/04/28830-372993874_large.mp4"
          autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, filter: pipelineMode ? 'blur(30px)' : 'blur(0px)', transition: 'filter 0.8s ease' }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(5,5,5,0.2), rgba(5,5,5,0.8))' }} />
      </div>

      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
        {/* Navbar */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-icon">
              <Wand2 size={24} color="white" />
            </div>
            EasyMake
          </div>
          <div className="flex gap-4 items-center">
            <button
              className="btn-secondary"
              onClick={toggleLanguage}
              title={t.switchLang}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Globe size={16} />
              <span style={{ fontFamily: 'Inter', fontWeight: 600 }}>{t.langCode}</span>
            </button>
            <button className="btn-secondary hide-on-mobile">{t.dashboard}</button>
            <div className="avatar">EM</div>
          </div>
        </nav>

        <main className="app-main">
          {!appStarted ? (
            <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '4rem', paddingBottom: '4rem', textAlign: 'center' }}>
              <h1 style={{ fontSize: '3.8rem', fontWeight: 800, marginBottom: '1.5rem', background: 'linear-gradient(135deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
                {lang === 'zh' ? '用 AI 引爆下一篇内容。' : 'Ignite Your Content with AI.'}
              </h1>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '4rem', maxWidth: '600px', margin: '0 auto' }}>
                {lang === 'zh' ? '极简设计搭配强大的 Luma 视频底部引擎。不仅是排版，首先挑选您所在的行业，我们将为您定制专用的核心指令。' : 'Minimalist design powered by the ultimate Luma engine. First, select your industry.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
                {Object.values(IND_CONFIG).map(ind => (
                  <div
                    key={ind.id}
                    onClick={() => { setIndustry(ind.id); setAppStarted(true); window.scrollTo(0, 0); }}
                    className="glass-panel"
                    style={{
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1.25rem',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.75rem',
                      background: 'rgba(255,255,255,0.03)', borderRadius: '20px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(139,92,246,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', color: 'white', flexShrink: 0 }}>
                      {ind.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: 'var(--text-primary)' }}>{ind[`label_${lang}`]}</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {lang === 'zh' ? '一键生成专属图文/视频' : 'Tailored texts & videos'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {status === 'idle' && (
                <div className="hero-section">
                  {/* Back button */}
                  <button
                    onClick={() => setAppStarted(false)}
                    style={{ position: 'absolute', top: 0, left: 0, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  >
                    ← {lang === 'zh' ? '返回首页' : 'Home'}
                  </button>
                  <div className="hero-badge" style={{ marginTop: '2rem' }}>
                    {IND_CONFIG[industry][`badge_${lang}`]}
                  </div>
                  <h1 className="hero-title pt-4">
                    {t.heroTitle} <br />
                    <div className="gradient-text gradient-glow" style={{ display: 'inline' }}>{t.heroHighlight}</div>
                  </h1>
                  <p className="hero-subtitle">
                    {IND_CONFIG[industry][`heroSubtitle_${lang}`]}
                  </p>
                </div>
              )}

              {status === 'idle' && (
                <div className="glass-panel mx-auto relative z-10">
                  <h2 className="card-title mb-4 pt-4">{t.ideaTitle}</h2>
                  <textarea
                    className="magic-input"
                    style={{ minHeight: '150px' }}
                    placeholder={IND_CONFIG[industry][`ideaPlaceholder_${lang}`]}
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                  />

                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500, background: 'rgba(255,255,255,0.03)', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="checkbox"
                        checked={generateTextEnabled}
                        onChange={(e) => setGenerateTextEnabled(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      {t.genTextLabel}
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500, background: 'rgba(255,255,255,0.03)', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="checkbox"
                        checked={generateImageEnabled}
                        onChange={(e) => setGenerateImageEnabled(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      {t.genImageLabel}
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500, background: 'rgba(255,255,255,0.03)', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="checkbox"
                        checked={generateVideoEnabled}
                        onChange={(e) => setGenerateVideoEnabled(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      {t.genVideoLabel}
                    </label>
                  </div>

                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="btn-secondary"
                      style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}
                    >
                      <Settings2 size={16} />
                      {t.advancedSettings}
                      {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showAdvanced && (
                      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
                        <div className="grid-2-col">
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.tones}</label>
                            <input className="magic-input" style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }} placeholder={t.tonesPlaceholder} value={advancedArgs.tones} onChange={e => setAdvancedArgs({ ...advancedArgs, tones: e.target.value })} />
                          </div>
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.animPref}</label>
                            <select
                              className="magic-input"
                              style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}
                              value={advancedArgs.animPref}
                              onChange={e => setAdvancedArgs({ ...advancedArgs, animPref: e.target.value })}
                            >
                              <option value="" style={{ color: 'black' }}>{t.animPrefOption1}</option>
                              <option value="Mixed Media Collage Style, Stop-motion" style={{ color: 'black' }}>{t.animPrefOption2}</option>
                              <option value="Cinematic Photorealism, High Fidelity" style={{ color: 'black' }}>{t.animPrefOption3}</option>
                              <option value="3D Pixar Cartoon Style" style={{ color: 'black' }}>{t.animPrefOption4}</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid-2-col">
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.bgInfo}</label>
                            <input className="magic-input" style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }} placeholder={IND_CONFIG[industry][`adv_bgInfo_${lang}`]} value={advancedArgs.bgInfo} onChange={e => setAdvancedArgs({ ...advancedArgs, bgInfo: e.target.value })} />
                          </div>
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.audience}</label>
                            <input className="magic-input" style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }} placeholder={IND_CONFIG[industry][`adv_audience_${lang}`]} value={advancedArgs.audience} onChange={e => setAdvancedArgs({ ...advancedArgs, audience: e.target.value })} />
                          </div>
                        </div>

                        <div className="grid-2-col">
                          {/* Feature 4: Target University Lexicon */}
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.targetUniv}</label>
                            <select
                              className="magic-input"
                              style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}
                              value={advancedArgs.targetUniv}
                              onChange={e => setAdvancedArgs({ ...advancedArgs, targetUniv: e.target.value })}
                            >
                              <option value="" style={{ color: 'black' }}>{t.targetUnivOption1}</option>
                              <option value="g5" style={{ color: 'black' }}>{t.targetUnivOption2}</option>
                              <option value="kmwe" style={{ color: 'black' }}>{t.targetUnivOption3}</option>
                              <option value="go8" style={{ color: 'black' }}>{t.targetUnivOption4}</option>
                              <option value="ivy" style={{ color: 'black' }}>{t.targetUnivOption5}</option>
                              <option value="qs50" style={{ color: 'black' }}>{t.targetUnivOption6}</option>
                              <option value="business" style={{ color: 'black' }}>{t.targetUnivOption7}</option>
                              <option value="art" style={{ color: 'black' }}>{t.targetUnivOption8}</option>
                              <option value="hksg" style={{ color: 'black' }}>{t.targetUnivOption9}</option>
                            </select>
                          </div>

                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.response}</label>
                            <input className="magic-input" style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }} placeholder={t.responsePlaceholder} value={advancedArgs.response} onChange={e => setAdvancedArgs({ ...advancedArgs, response: e.target.value })} />
                          </div>
                        </div>

                        <div className="grid-2-col">
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.cameraMove}</label>
                            <select
                              className="magic-input"
                              style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}
                              value={advancedArgs.cameraMove}
                              onChange={e => setAdvancedArgs({ ...advancedArgs, cameraMove: e.target.value })}
                            >
                              <option value="" style={{ color: 'black' }}>{t.cameraMoveOption1}</option>
                              <option value="Smooth Tracking camera shot" style={{ color: 'black' }}>{t.cameraMoveOption2}</option>
                              <option value="Fast FPV Drone flythrough shot" style={{ color: 'black' }}>{t.cameraMoveOption3}</option>
                              <option value="Cinematic slow Zoom In/Out" style={{ color: 'black' }}>{t.cameraMoveOption4}</option>
                            </select>
                          </div>
                          <div className="flex-col flex gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t.lighting}</label>
                            <select
                              className="magic-input"
                              style={{ fontSize: '0.95rem', padding: '0.8rem', minHeight: 'auto', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}
                              value={advancedArgs.lighting}
                              onChange={e => setAdvancedArgs({ ...advancedArgs, lighting: e.target.value })}
                            >
                              <option value="" style={{ color: 'black' }}>{t.lightingOption1}</option>
                              <option value="Volumetric Golden Hour lighting, hazy sunrise" style={{ color: 'black' }}>{t.lightingOption2}</option>
                              <option value="Dark Moody Cinematic lighting, soft shadows" style={{ color: 'black' }}>{t.lightingOption3}</option>
                              <option value="Cyberpunk Neon glowing accents, highly saturated" style={{ color: 'black' }}>{t.lightingOption4}</option>
                            </select>
                          </div>
                        </div>

                        {/* Features 2 & 3: Urgency Hooks & CTAs */}
                        <div className="grid-2-col" style={{ marginTop: '0.5rem' }}>
                          <div className="flex-col flex gap-1 p-3" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}>
                              <input type="checkbox" checked={advancedArgs.urgencyHook} onChange={(e) => setAdvancedArgs({ ...advancedArgs, urgencyHook: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }} />
                              {t.urgencyHook}
                            </label>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0 24px', lineHeight: 1.2 }}>{t.urgencyHookDesc}</p>
                          </div>

                          <div className="flex-col flex gap-1 p-3" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500 }}>
                              <input type="checkbox" checked={advancedArgs.cta} onChange={(e) => setAdvancedArgs({ ...advancedArgs, cta: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }} />
                              {t.cta}
                            </label>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0 24px', lineHeight: 1.2 }}>{t.ctaDesc}</p>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Director Mode Banner */}
                    <div
                      onClick={() => idea.trim() && setPipelineMode(true)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                        padding: '1rem 1.25rem', borderRadius: '14px', cursor: idea.trim() ? 'pointer' : 'not-allowed',
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.08))',
                        border: '1px solid rgba(139,92,246,0.25)', opacity: idea.trim() ? 1 : 0.4,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => { if (idea.trim()) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(59,130,246,0.15))'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.08))'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)', padding: '0.6rem', borderRadius: '10px', display: 'flex' }}>
                          <Film size={18} color="white" />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>{t.directorModeBtn}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '1px' }}>{t.directorModeDesc}</div>
                        </div>
                      </div>
                      <ArrowRight size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-6 flex-mobile-col">
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {t.ideaFooter} • {t.generationsLeft} <strong style={{ color: generationsUsed >= 99 ? '#ef4444' : '#10b981' }}>{99 - generationsUsed}/99</strong>
                    </span>
                    <button
                      className="btn-primary"
                      onClick={handleGenerate}
                      disabled={!idea.trim() || generationsUsed >= 99}
                      style={{ opacity: (!idea.trim() || generationsUsed >= 99) ? 0.5 : 1, cursor: (!idea.trim() || generationsUsed >= 99) ? 'not-allowed' : 'pointer' }}
                    >
                      <Wand2 size={20} />
                      {t.generateBtn}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {renderStatus()}
              {renderResult()}

            </>
          )}

          {/* Video Pipeline Director Mode */}
          {pipelineMode && (
            <div className="mt-8">
              <VideoPipeline
                idea={idea}
                advanced={{ ...advancedArgs, industry: IND_CONFIG[industry][`label_${lang}`] }}
                lang={lang}
                onClose={() => {
                  setPipelineMode(false);
                  setStatus('idle');
                }}
              />
            </div>
          )}

          {status === 'completed' && (
            <div className="flex justify-center mt-12 mb-8 animate-fade-in">
              <button
                className="btn-primary"
                onClick={() => {
                  setIdea("");
                  setStatus("idle");
                  setResult(null);
                }}
              >
                <Sparkles size={20} />
                {t.createAnotherBtn}
              </button>
            </div>
          )}

        </main>
      </div>
    </>
  );
}

export default App;
