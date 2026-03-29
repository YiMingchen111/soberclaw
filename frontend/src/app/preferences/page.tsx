"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Settings, Save, RotateCcw, Plus, X,
  Mic, Type, Monitor, Sliders,
} from "lucide-react";
import {
  getPreferences, updatePreferences, getSliceConfig, updateSliceConfig,
  getVoices, getSubtitleStyles, getPlatforms,
  type CreatorPreferences, type SliceConfig, type Voice,
} from "@/lib/api";

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
  "douyin", "kuaishou", "bilibili", "instagram", "youtube", "weibo",
];

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音", kuaishou: "快手", bilibili: "哔哩哔哩",
  instagram: "Instagram", youtube: "YouTube", weibo: "微博",
};

const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16 竖屏（抖音/快手）" },
  { id: "1:1",  label: "1:1  方形（微博/INS）" },
  { id: "16:9", label: "16:9 横屏（B站/YouTube）" },
];

const RESOLUTIONS: Record<string, string> = {
  "9:16": "1080x1920",
  "1:1":  "1080x1080",
  "16:9": "1920x1080",
};

export default function PreferencesPage() {
  const [tab, setTab] = useState<"creator" | "slice">("creator");
  const [prefs, setPrefs] = useState<CreatorPreferences | null>(null);
  const [config, setConfig] = useState<SliceConfig | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [subtitleStyles, setSubtitleStyles] = useState<{ id: string; name: string; desc: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    Promise.all([getPreferences(), getSliceConfig(), getVoices(), getSubtitleStyles()])
      .then(([p, c, v, s]) => {
        setPrefs(p);
        setConfig(c);
        setVoices(v);
        setSubtitleStyles(s);
      })
      .catch(() => toast.error("加载设置失败"));
  }, []);

  const savePrefs = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      await updatePreferences(prefs);
      toast.success("创作偏好已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateSliceConfig(config);
      toast.success("切片参数已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim() || !prefs) return;
    setPrefs({ ...prefs, highlight_keywords: [...prefs.highlight_keywords, newKeyword.trim()] });
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    if (!prefs) return;
    setPrefs({ ...prefs, highlight_keywords: prefs.highlight_keywords.filter(k => k !== kw) });
  };

  const togglePlatform = (p: string) => {
    if (!prefs) return;
    const arr = prefs.target_platform.includes(p)
      ? prefs.target_platform.filter(x => x !== p)
      : [...prefs.target_platform, p];
    setPrefs({ ...prefs, target_platform: arr });
  };

  if (!prefs || !config) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[#9090b8]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(204,63,247,.2)" }}>
          <Settings size={20} className="text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">偏好设置</h1>
          <p className="text-[#9090b8] text-sm">配置创作偏好和切片参数</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "rgba(255,255,255,.04)" }}>
        {[
          { id: "creator", label: "创作偏好", icon: Monitor },
          { id: "slice",   label: "切片参数", icon: Sliders },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id}
            onClick={() => setTab(id as "creator" | "slice")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
              ${tab === id ? "text-white shadow-lg" : "text-[#9090b8] hover:text-white"}`}
            style={tab === id ? { background: "linear-gradient(135deg,#cc3ff7 0%,#6366f1 100%)" } : {}}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Creator Preferences Tab */}
      {tab === "creator" && (
        <div className="space-y-6 animate-fade-in">
          {/* Basic info */}
          <div className="glass-card p-6 space-y-5">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Monitor size={18} className="text-brand-400" /> 基本信息
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">创作者昵称</label>
                <input className="input-dark" value={prefs.nickname}
                  onChange={e => setPrefs({ ...prefs, nickname: e.target.value })}
                  placeholder="你的昵称" />
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">内容类型</label>
                <select className="input-dark" value={prefs.category}
                  onChange={e => setPrefs({ ...prefs, category: e.target.value })}>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-[#9090b8] mb-1.5 block">水印文字（留空则不添加）</label>
              <input className="input-dark" value={prefs.watermark_text}
                onChange={e => setPrefs({ ...prefs, watermark_text: e.target.value })}
                placeholder="@你的账号名" />
            </div>
          </div>

          {/* Target platforms */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-lg">目标平台</h2>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map(p => (
                <button key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${prefs.target_platform.includes(p)
                      ? "text-white shadow"
                      : "text-[#9090b8] hover:text-white"}`}
                  style={prefs.target_platform.includes(p)
                    ? { background: "linear-gradient(135deg,#cc3ff7 0%,#6366f1 100%)" }
                    : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-lg">默认画幅比例</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ASPECT_RATIOS.map(r => (
                <button key={r.id}
                  onClick={() => setPrefs({ ...prefs, preferred_aspect_ratio: r.id })}
                  className={`p-4 rounded-xl text-sm font-medium text-left transition-all
                    ${prefs.preferred_aspect_ratio === r.id ? "border-brand-500" : "border-[#2a2a4a] hover:border-brand-500/30"}`}
                  style={{
                    background: prefs.preferred_aspect_ratio === r.id
                      ? "rgba(204,63,247,.15)"
                      : "rgba(255,255,255,.03)",
                    border: `1px solid ${prefs.preferred_aspect_ratio === r.id ? "#cc3ff7" : "#2a2a4a"}`,
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI highlights */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Type size={18} className="text-brand-400" /> AI 分析参数
            </h2>

            <div>
              <label className="text-sm text-[#9090b8] mb-2 block">
                精彩度阈值（{prefs.min_highlight_score.toFixed(1)}）
                <span className="ml-2 text-xs">— 越高筛选越严格</span>
              </label>
              <input type="range" min="0" max="1" step="0.1"
                value={prefs.min_highlight_score}
                onChange={e => setPrefs({ ...prefs, min_highlight_score: parseFloat(e.target.value) })}
                className="w-full accent-brand-500" />
              <div className="flex justify-between text-xs text-[#9090b8] mt-1">
                <span>0.0 宽松</span><span>1.0 严格</span>
              </div>
            </div>

            <div>
              <label className="text-sm text-[#9090b8] mb-2 block">关键词（AI 重点关注这些内容）</label>
              <div className="flex gap-2 mb-3">
                <input className="input-dark flex-1" value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addKeyword()}
                  placeholder="添加关键词，回车确认" />
                <button onClick={addKeyword} className="btn-brand px-3">
                  <Plus size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {prefs.highlight_keywords.map(kw => (
                  <span key={kw}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                    style={{ background: "rgba(204,63,247,.2)", border: "1px solid rgba(204,63,247,.4)" }}>
                    {kw}
                    <button onClick={() => removeKeyword(kw)}
                      className="text-[#9090b8] hover:text-white transition-colors">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {prefs.highlight_keywords.length === 0 && (
                  <span className="text-xs text-[#9090b8]">暂无关键词，AI 将自动识别精彩内容</span>
                )}
              </div>
            </div>
          </div>

          {/* Default voice */}
          <div className="glass-card p-6 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Mic size={18} className="text-brand-400" /> 默认配音
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">默认音色</label>
                <select className="input-dark" value={prefs.default_voice}
                  onChange={e => setPrefs({ ...prefs, default_voice: e.target.value })}>
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">
                  语速 ({prefs.voice_speed.toFixed(1)}x)
                </label>
                <input type="range" min="0.5" max="2" step="0.1"
                  value={prefs.voice_speed}
                  onChange={e => setPrefs({ ...prefs, voice_speed: parseFloat(e.target.value) })}
                  className="w-full accent-brand-500" />
                <div className="flex justify-between text-xs text-[#9090b8] mt-1">
                  <span>0.5x 慢</span><span>2.0x 快</span>
                </div>
              </div>
            </div>
          </div>

          <button onClick={savePrefs} disabled={saving}
            className="btn-brand w-full py-3 flex items-center justify-center gap-2 text-base">
            <Save size={18} /> {saving ? "保存中..." : "保存创作偏好"}
          </button>
        </div>
      )}

      {/* Slice Config Tab */}
      {tab === "slice" && (
        <div className="space-y-6 animate-fade-in">
          {/* Duration */}
          <div className="glass-card p-6 space-y-5">
            <h2 className="font-semibold text-lg">切片时长</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">最短时长（秒）</label>
                <input type="number" className="input-dark" min={3} max={300}
                  value={config.min_duration}
                  onChange={e => setConfig({ ...config, min_duration: +e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">最长时长（秒）</label>
                <input type="number" className="input-dark" min={5} max={600}
                  value={config.max_duration}
                  onChange={e => setConfig({ ...config, max_duration: +e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">最多切片数</label>
                <input type="number" className="input-dark" min={1} max={20}
                  value={config.max_slices}
                  onChange={e => setConfig({ ...config, max_slices: +e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm text-[#9090b8] mb-1.5 block">
                前后扩展时间（{config.overlap_seconds}秒）— 切片前后各延伸一点
              </label>
              <input type="range" min="0" max="5" step="0.5"
                value={config.overlap_seconds}
                onChange={e => setConfig({ ...config, overlap_seconds: +e.target.value })}
                className="w-full accent-brand-500" />
            </div>
          </div>

          {/* Video settings */}
          <div className="glass-card p-6 space-y-5">
            <h2 className="font-semibold text-lg">视频参数</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">画幅比例</label>
                <select className="input-dark" value={config.aspect_ratio}
                  onChange={e => {
                    const ar = e.target.value;
                    setConfig({
                      ...config,
                      aspect_ratio: ar,
                      output_resolution: RESOLUTIONS[ar] || config.output_resolution,
                    });
                  }}>
                  {ASPECT_RATIOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">输出分辨率</label>
                <input className="input-dark" value={config.output_resolution}
                  onChange={e => setConfig({ ...config, output_resolution: e.target.value })}
                  placeholder="1080x1920" />
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">帧率 (FPS)</label>
                <select className="input-dark" value={config.output_fps}
                  onChange={e => setConfig({ ...config, output_fps: +e.target.value })}>
                  {[15, 24, 30, 60].map(f => <option key={f} value={f}>{f} FPS</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-[#9090b8] mb-1.5 block">视频码率</label>
                <select className="input-dark" value={config.video_bitrate}
                  onChange={e => setConfig({ ...config, video_bitrate: e.target.value })}>
                  {["2M", "4M", "6M", "8M", "12M"].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Subtitle settings */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Type size={18} className="text-brand-400" /> 字幕设置
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-[#9090b8]">启用字幕</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${config.add_subtitle ? "bg-brand-500" : "bg-[#3a3a6a]"}`}
                  onClick={() => setConfig({ ...config, add_subtitle: !config.add_subtitle })}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${config.add_subtitle ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </label>
            </div>

            {config.add_subtitle && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#9090b8] mb-1.5 block">字幕样式</label>
                    <select className="input-dark" value={config.subtitle_style}
                      onChange={e => setConfig({ ...config, subtitle_style: e.target.value })}>
                      {subtitleStyles.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {s.desc}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-[#9090b8] mb-1.5 block">字幕位置</label>
                    <select className="input-dark" value={config.subtitle_position}
                      onChange={e => setConfig({ ...config, subtitle_position: e.target.value })}>
                      <option value="bottom">底部</option>
                      <option value="center">居中</option>
                      <option value="top">顶部</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#9090b8] mb-1.5 block">
                    字体大小 ({config.subtitle_font_size}px)
                  </label>
                  <input type="range" min="18" max="80" step="2"
                    value={config.subtitle_font_size}
                    onChange={e => setConfig({ ...config, subtitle_font_size: +e.target.value })}
                    className="w-full accent-brand-500" />
                </div>
                <div>
                  <label className="text-sm text-[#9090b8] mb-1.5 block">字幕语言</label>
                  <select className="input-dark" value={config.subtitle_language}
                    onChange={e => setConfig({ ...config, subtitle_language: e.target.value })}>
                    <option value="zh">中文</option>
                    <option value="en">英文</option>
                    <option value="ja">日文</option>
                    <option value="ko">韩文</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Dubbing settings */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Mic size={18} className="text-brand-400" /> 配音设置
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-[#9090b8]">启用配音</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${config.add_dubbing ? "bg-brand-500" : "bg-[#3a3a6a]"}`}
                  onClick={() => setConfig({ ...config, add_dubbing: !config.add_dubbing })}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${config.add_dubbing ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </label>
            </div>

            {config.add_dubbing && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#9090b8] mb-1.5 block">配音音色</label>
                    <select className="input-dark" value={config.dubbing_voice}
                      onChange={e => setConfig({ ...config, dubbing_voice: e.target.value })}>
                      {voices.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-[#9090b8] mb-1.5 block">
                      配音语速 ({config.dubbing_speed.toFixed(1)}x)
                    </label>
                    <input type="range" min="0.5" max="2" step="0.1"
                      value={config.dubbing_speed}
                      onChange={e => setConfig({ ...config, dubbing_speed: +e.target.value })}
                      className="w-full accent-brand-500" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${config.keep_original_audio ? "bg-brand-500" : "bg-[#3a3a6a]"}`}
                    onClick={() => setConfig({ ...config, keep_original_audio: !config.keep_original_audio })}>
                    <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${config.keep_original_audio ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                  <span className="text-sm">保留原声</span>
                  {config.keep_original_audio && (
                    <div className="flex-1">
                      <span className="text-xs text-[#9090b8] mr-2">
                        原声音量 ({Math.round(config.original_audio_volume * 100)}%)
                      </span>
                      <input type="range" min="0" max="1" step="0.1"
                        value={config.original_audio_volume}
                        onChange={e => setConfig({ ...config, original_audio_volume: +e.target.value })}
                        className="w-32 accent-brand-500" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={saveConfig} disabled={saving}
            className="btn-brand w-full py-3 flex items-center justify-center gap-2 text-base">
            <Save size={18} /> {saving ? "保存中..." : "保存切片参数"}
          </button>
        </div>
      )}
    </div>
  );
}
