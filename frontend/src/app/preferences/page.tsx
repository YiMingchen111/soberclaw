"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Save, Plus, X, RefreshCw } from "lucide-react";
import {
  getPreferences, updatePreferences,
  getSliceConfig, updateSliceConfig,
  getVoices, getSubtitleStyles,
  type CreatorPreferences, type SliceConfig, type Voice,
} from "@/lib/api";

/* ── static data ─────────────────────────────────────────── */
const CATEGORIES = [
  { id: "vlog",       label: "Vlog 日常" },
  { id: "knowledge",  label: "知识干货" },
  { id: "funny",      label: "搞笑娱乐" },
  { id: "emotional",  label: "情感故事" },
  { id: "product",    label: "产品测评" },
  { id: "news",       label: "新闻资讯" },
  { id: "sport",      label: "运动健身" },
];
const PLATFORMS = [
  { id: "douyin",    label: "抖音" },
  { id: "kuaishou",  label: "快手" },
  { id: "bilibili",  label: "哔哩哔哩" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube",   label: "YouTube" },
  { id: "weibo",     label: "微博" },
];
const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16", sub: "竖屏 · 抖音 / 快手" },
  { id: "1:1",  label: "1:1",  sub: "方形 · 微博 / INS" },
  { id: "16:9", label: "16:9", sub: "横屏 · B站 / YouTube" },
];
const RES_MAP: Record<string, string> = { "9:16": "1080x1920", "1:1": "1080x1080", "16:9": "1920x1080" };
const SUBTITLE_STYLES_LOCAL = [
  { id: "classic",  label: "经典白字",  desc: "白字黑边，通用性最强" },
  { id: "karaoke",  label: "卡拉 OK",   desc: "逐字高亮，适合口播" },
  { id: "gradient", label: "彩色渐变",  desc: "黄色渐变，时尚感强" },
  { id: "minimal",  label: "简约条形",  desc: "白底黑字，简洁专业" },
  { id: "bounce",   label: "弹跳动画",  desc: "缩放弹入，活泼生动" },
  { id: "neon",     label: "霓虹发光",  desc: "发光描边，科技感强" },
];

/* ── helpers ─────────────────────────────────────────────── */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-1.5" style={{ color: "var(--text-3)", fontWeight: 500 }}>{children}</p>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-4 rounded-full" style={{ background: "var(--accent)" }} />
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{children}</h3>
    </div>
  );
}

/* ── default values when API is unreachable ──────────────── */
const DEFAULT_PREFS: CreatorPreferences = {
  nickname: "Creator",
  category: "vlog",
  target_platform: ["douyin", "kuaishou"],
  preferred_aspect_ratio: "9:16",
  default_subtitle_style: "classic",
  default_voice: "zh-CN-XiaoxiaoNeural",
  voice_speed: 1.0,
  voice_pitch: 0.0,
  add_bgm: false,
  bgm_volume: 0.3,
  watermark_text: "",
  highlight_keywords: [],
  min_highlight_score: 0.6,
};
const DEFAULT_CONFIG: SliceConfig = {
  min_duration: 15,
  max_duration: 60,
  max_slices: 5,
  overlap_seconds: 0.5,
  aspect_ratio: "9:16",
  output_resolution: "1080x1920",
  output_fps: 30,
  video_bitrate: "4M",
  add_subtitle: true,
  subtitle_style: "classic",
  subtitle_font_size: 42,
  subtitle_position: "bottom",
  subtitle_language: "zh",
  add_dubbing: false,
  dubbing_voice: "zh-CN-XiaoxiaoNeural",
  dubbing_speed: 1.0,
  keep_original_audio: true,
  original_audio_volume: 0.3,
};
const DEFAULT_VOICES: Voice[] = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓（温柔女声）", gender: "female", lang: "zh-CN" },
  { id: "zh-CN-YunxiNeural",    name: "云希（活力男声）", gender: "male",   lang: "zh-CN" },
  { id: "zh-CN-YunjianNeural",  name: "云健（成熟男声）", gender: "male",   lang: "zh-CN" },
  { id: "zh-CN-XiaohanNeural",  name: "晓涵（知性女声）", gender: "female", lang: "zh-CN" },
];

/* ── component ───────────────────────────────────────────── */
export default function PreferencesPage() {
  const [tab,     setTab]     = useState<"creator" | "slice">("creator");
  const [prefs,   setPrefs]   = useState<CreatorPreferences>(DEFAULT_PREFS);
  const [config,  setConfig]  = useState<SliceConfig>(DEFAULT_CONFIG);
  const [voices,  setVoices]  = useState<Voice[]>(DEFAULT_VOICES);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [kw,      setKw]      = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([getPreferences(), getSliceConfig(), getVoices()])
      .then(([p, c, v]) => {
        if (p.status === "fulfilled") setPrefs(p.value);
        if (c.status === "fulfilled") setConfig(c.value);
        if (v.status === "fulfilled" && v.value.length > 0) setVoices(v.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const savePrefs = async () => {
    setSaving(true);
    try { await updatePreferences(prefs); toast.success("创作偏好已保存"); }
    catch { toast.error("保存失败，请检查后端连接"); }
    finally { setSaving(false); }
  };

  const saveConfig = async () => {
    setSaving(true);
    try { await updateSliceConfig(config); toast.success("切片参数已保存"); }
    catch { toast.error("保存失败，请检查后端连接"); }
    finally { setSaving(false); }
  };

  const togglePlatform = (id: string) => {
    const arr = prefs.target_platform.includes(id)
      ? prefs.target_platform.filter(x => x !== id)
      : [...prefs.target_platform, id];
    setPrefs({ ...prefs, target_platform: arr });
  };

  const addKw = () => {
    if (!kw.trim() || prefs.highlight_keywords.includes(kw.trim())) return;
    setPrefs({ ...prefs, highlight_keywords: [...prefs.highlight_keywords, kw.trim()] });
    setKw("");
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-xl font-bold mb-0.5" style={{ color: "var(--text-1)" }}>偏好设置</h1>
            <p className="text-sm" style={{ color: "var(--text-3)" }}>配置创作习惯和切片默认参数</p>
          </div>
          {loading && <RefreshCw size={16} className="animate-spin" style={{ color: "var(--text-3)" }} />}
        </div>

        {/* Tabs */}
        <div className="tab-bar mb-6">
          {(["creator", "slice"] as const).map(t => (
            <button key={t} className={`tab-item ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "creator" ? "创作偏好" : "切片参数"}
            </button>
          ))}
        </div>

        {/* ── CREATOR TAB ─────────────────────────────────── */}
        {tab === "creator" && (
          <div className="space-y-4 fade-in">

            {/* Basic */}
            <div className="section-card p-5">
              <SectionTitle>基本信息</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>创作者昵称</Label>
                  <input className="input" value={prefs.nickname}
                    onChange={e => setPrefs({ ...prefs, nickname: e.target.value })}
                    placeholder="你的昵称" />
                </div>
                <div>
                  <Label>内容类型</Label>
                  <select className="input" value={prefs.category}
                    onChange={e => setPrefs({ ...prefs, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>水印文字（留空则不添加）</Label>
                  <input className="input" value={prefs.watermark_text}
                    onChange={e => setPrefs({ ...prefs, watermark_text: e.target.value })}
                    placeholder="@你的账号名" />
                </div>
              </div>
            </div>

            {/* Platforms */}
            <div className="section-card p-5">
              <SectionTitle>目标平台</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`platform-chip ${prefs.target_platform.includes(p.id) ? "active" : ""}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect ratio */}
            <div className="section-card p-5">
              <SectionTitle>默认画幅比例</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                {ASPECT_RATIOS.map(r => (
                  <button key={r.id}
                    onClick={() => setPrefs({ ...prefs, preferred_aspect_ratio: r.id })}
                    className="card p-4 text-center transition-all"
                    style={{
                      borderColor: prefs.preferred_aspect_ratio === r.id ? "var(--accent)" : "var(--border)",
                      background: prefs.preferred_aspect_ratio === r.id ? "var(--accent-dim)" : "var(--card)",
                    }}>
                    <p className="text-lg font-bold mb-1" style={{ color: prefs.preferred_aspect_ratio === r.id ? "var(--accent)" : "var(--text-1)" }}>{r.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-3)" }}>{r.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* AI params */}
            <div className="section-card p-5">
              <SectionTitle>AI 分析参数</SectionTitle>
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <Label>精彩度阈值</Label>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--accent)" }}>
                    {prefs.min_highlight_score.toFixed(1)}
                  </span>
                </div>
                <input type="range" min="0" max="1" step="0.1"
                  className="w-full"
                  value={prefs.min_highlight_score}
                  onChange={e => setPrefs({ ...prefs, min_highlight_score: +e.target.value })} />
                <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-3)" }}>
                  <span>0.0 宽松</span><span>1.0 严格</span>
                </div>
              </div>
              <div>
                <Label>关键词（AI 重点关注）</Label>
                <div className="flex gap-2 mb-3">
                  <input className="input" value={kw}
                    onChange={e => setKw(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addKw()}
                    placeholder="输入关键词，回车添加" />
                  <button onClick={addKw} className="btn btn-primary px-3">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[28px]">
                  {prefs.highlight_keywords.length === 0
                    ? <span className="text-xs" style={{ color: "var(--text-3)" }}>暂无，AI 将自动判断精彩内容</span>
                    : prefs.highlight_keywords.map(k => (
                      <span key={k} className="kw-tag">
                        {k}
                        <button onClick={() => setPrefs({ ...prefs, highlight_keywords: prefs.highlight_keywords.filter(x => x !== k) })}>
                          <X size={11} />
                        </button>
                      </span>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* Voice */}
            <div className="section-card p-5">
              <SectionTitle>默认配音</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>音色</Label>
                  <select className="input" value={prefs.default_voice}
                    onChange={e => setPrefs({ ...prefs, default_voice: e.target.value })}>
                    {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <Label>语速</Label>
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--accent)" }}>
                      {prefs.voice_speed.toFixed(1)}x
                    </span>
                  </div>
                  <input type="range" min="0.5" max="2" step="0.1" className="w-full"
                    value={prefs.voice_speed}
                    onChange={e => setPrefs({ ...prefs, voice_speed: +e.target.value })} />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-3)" }}>
                    <span>0.5x</span><span>2.0x</span>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={savePrefs} disabled={saving} className="btn btn-primary w-full justify-center py-2.5 text-sm">
              <Save size={15} />{saving ? "保存中..." : "保存创作偏好"}
            </button>
          </div>
        )}

        {/* ── SLICE TAB ────────────────────────────────────── */}
        {tab === "slice" && (
          <div className="space-y-4 fade-in">

            {/* Duration */}
            <div className="section-card p-5">
              <SectionTitle>切片时长</SectionTitle>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "最短时长（秒）", key: "min_duration", min: 3,  max: 300 },
                  { label: "最长时长（秒）", key: "max_duration", min: 5,  max: 600 },
                  { label: "最多切片数",     key: "max_slices",   min: 1,  max: 20  },
                ].map(({ label, key, min, max }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <input type="number" className="input" min={min} max={max}
                      value={config[key as keyof SliceConfig] as number}
                      onChange={e => setConfig({ ...config, [key]: +e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Label>前后扩展时间</Label>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--accent)" }}>
                    {config.overlap_seconds}s
                  </span>
                </div>
                <input type="range" min="0" max="5" step="0.5" className="w-full"
                  value={config.overlap_seconds}
                  onChange={e => setConfig({ ...config, overlap_seconds: +e.target.value })} />
              </div>
            </div>

            {/* Video */}
            <div className="section-card p-5">
              <SectionTitle>视频参数</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>画幅比例</Label>
                  <select className="input" value={config.aspect_ratio}
                    onChange={e => setConfig({ ...config, aspect_ratio: e.target.value, output_resolution: RES_MAP[e.target.value] ?? config.output_resolution })}>
                    {ASPECT_RATIOS.map(r => <option key={r.id} value={r.id}>{r.label} {r.sub}</option>)}
                  </select>
                </div>
                <div>
                  <Label>输出分辨率</Label>
                  <input className="input" value={config.output_resolution}
                    onChange={e => setConfig({ ...config, output_resolution: e.target.value })} />
                </div>
                <div>
                  <Label>帧率</Label>
                  <select className="input" value={config.output_fps}
                    onChange={e => setConfig({ ...config, output_fps: +e.target.value })}>
                    {[15, 24, 30, 60].map(f => <option key={f} value={f}>{f} FPS</option>)}
                  </select>
                </div>
                <div>
                  <Label>视频码率</Label>
                  <select className="input" value={config.video_bitrate}
                    onChange={e => setConfig({ ...config, video_bitrate: e.target.value })}>
                    {["2M","4M","6M","8M","12M"].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Subtitle */}
            <div className="section-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ background: "var(--accent)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>字幕</h3>
                </div>
                <div className={`toggle ${config.add_subtitle ? "on" : ""}`}
                  onClick={() => setConfig({ ...config, add_subtitle: !config.add_subtitle })} />
              </div>
              {config.add_subtitle && (
                <div className="space-y-4">
                  <div>
                    <Label>字幕样式</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {SUBTITLE_STYLES_LOCAL.map(s => (
                        <button key={s.id}
                          onClick={() => setConfig({ ...config, subtitle_style: s.id })}
                          className="card p-3 text-left transition-all"
                          style={{
                            borderColor: config.subtitle_style === s.id ? "var(--accent)" : "var(--border)",
                            background: config.subtitle_style === s.id ? "var(--accent-dim)" : "var(--card)",
                          }}>
                          <p className="text-xs font-medium mb-0.5" style={{ color: config.subtitle_style === s.id ? "var(--accent)" : "var(--text-1)" }}>{s.label}</p>
                          <p className="text-xs" style={{ color: "var(--text-3)", fontSize: "11px" }}>{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>字幕位置</Label>
                      <select className="input" value={config.subtitle_position}
                        onChange={e => setConfig({ ...config, subtitle_position: e.target.value })}>
                        <option value="bottom">底部</option>
                        <option value="center">居中</option>
                        <option value="top">顶部</option>
                      </select>
                    </div>
                    <div>
                      <Label>字体大小 ({config.subtitle_font_size}px)</Label>
                      <input type="range" min="18" max="80" step="2" className="w-full mt-3"
                        value={config.subtitle_font_size}
                        onChange={e => setConfig({ ...config, subtitle_font_size: +e.target.value })} />
                    </div>
                    <div>
                      <Label>字幕语言</Label>
                      <select className="input" value={config.subtitle_language}
                        onChange={e => setConfig({ ...config, subtitle_language: e.target.value })}>
                        <option value="zh">中文</option>
                        <option value="en">英文</option>
                        <option value="ja">日文</option>
                        <option value="ko">韩文</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dubbing */}
            <div className="section-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ background: "var(--accent)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>配音</h3>
                </div>
                <div className={`toggle ${config.add_dubbing ? "on" : ""}`}
                  onClick={() => setConfig({ ...config, add_dubbing: !config.add_dubbing })} />
              </div>
              {config.add_dubbing && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>音色</Label>
                      <select className="input" value={config.dubbing_voice}
                        onChange={e => setConfig({ ...config, dubbing_voice: e.target.value })}>
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <Label>语速</Label>
                        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--accent)" }}>
                          {config.dubbing_speed.toFixed(1)}x
                        </span>
                      </div>
                      <input type="range" min="0.5" max="2" step="0.1" className="w-full"
                        value={config.dubbing_speed}
                        onChange={e => setConfig({ ...config, dubbing_speed: +e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`toggle ${config.keep_original_audio ? "on" : ""}`}
                      onClick={() => setConfig({ ...config, keep_original_audio: !config.keep_original_audio })} />
                    <span className="text-sm" style={{ color: "var(--text-2)" }}>保留原声</span>
                    {config.keep_original_audio && (
                      <div className="flex items-center gap-2 ml-2 flex-1">
                        <span className="text-xs" style={{ color: "var(--text-3)" }}>
                          原声音量 {Math.round(config.original_audio_volume * 100)}%
                        </span>
                        <input type="range" min="0" max="1" step="0.1" className="flex-1"
                          value={config.original_audio_volume}
                          onChange={e => setConfig({ ...config, original_audio_volume: +e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveConfig} disabled={saving} className="btn btn-primary w-full justify-center py-2.5 text-sm">
              <Save size={15} />{saving ? "保存中..." : "保存切片参数"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
