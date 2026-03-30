"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Download, RefreshCw, Play, Check,
  Star, Clock, Zap, Upload, CheckSquare,
  Square, ChevronDown, X,
} from "lucide-react";
import {
  getJobStatus, exportSlices, getVoices, getLogs, getVoicePreviewUrl, formatDuration,
  type SliceJob, type SliceInfo, type Voice, type SubtitleStyleConfig, type LogEntry,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";

/* ── constants ───────────────────────────────────────────── */
const SUBTITLE_OPTIONS = [
  { id: "classic",  label: "经典白字" },
  { id: "karaoke",  label: "卡拉 OK" },
  { id: "gradient", label: "彩色渐变" },
  { id: "minimal",  label: "简约条形" },
  { id: "bounce",   label: "弹跳动画" },
  { id: "neon",     label: "霓虹发光" },
];

/* ── score helper ────────────────────────────────────────── */
function scoreStyle(s: number) {
  if (s >= 0.8) return { color: "var(--green)" };
  if (s >= 0.6) return { color: "var(--yellow)" };
  return { color: "var(--red)" };
}
function scoreLabel(s: number) {
  if (s >= 0.8) return "精彩";
  if (s >= 0.6) return "不错";
  return "一般";
}

/* ── Voice preview button ────────────────────────────────── */
function VoicePreviewBtn({ voiceId }: { voiceId: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggle = () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); }
    else {
      const a = new Audio(getVoicePreviewUrl(voiceId));
      audioRef.current = a;
      a.play().catch(() => toast.error("音色预览失败"));
      a.onended = () => setPlaying(false);
      a.onerror = () => { setPlaying(false); };
      setPlaying(true);
    }
  };
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  useEffect(() => { audioRef.current?.pause(); setPlaying(false); }, [voiceId]);
  return (
    <button onClick={toggle}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all flex-shrink-0"
      style={{
        background: playing ? "var(--accent-dim)" : "var(--bg-2)",
        color:      playing ? "var(--accent)"     : "var(--text-3)",
        border:     `1px solid ${playing ? "var(--accent)" : "var(--border)"}`,
      }}>
      {playing ? <Square size={9} /> : <Play size={9} />}
      {playing ? "停止" : "试听"}
    </button>
  );
}

/* ── Export panel ────────────────────────────────────────── */
function ExportPanel({
  job, voices, selected, onSelectAll, onClearAll,
  onClose,
}: {
  job: SliceJob;
  voices: Voice[];
  selected: Set<number>;
  onSelectAll: () => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const { exportSubtitleConfig, setExportSubtitleConfig,
          exportDubbing, setExportDubbing,
          exportDubbingVoice, setExportDubbingVoice,
          exportDubbingSpeed, setExportDubbingSpeed } = useAppStore();
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    if (selected.size === 0) { toast.error("请先选择切片"); return; }
    setExporting(true);
    try {
      await exportSlices(
        job.job_id, Array.from(selected), exportSubtitleConfig,
        exportDubbing, exportDubbingVoice, exportDubbingSpeed, true,
      );
      toast.success("导出任务已提交，文件在后台生成");
    } catch { toast.error("导出失败"); }
    finally { setExporting(false); }
  };

  return (
    <div className="card p-5 mb-5 slide-up" style={{ borderColor: "rgba(251,146,60,.2)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>导出设置</h3>
        <button onClick={onClose}><X size={15} style={{ color: "var(--text-3)" }} /></button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* subtitle */}
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-3)", fontWeight: 500 }}>字幕样式</p>
          <div className="grid grid-cols-3 gap-1.5">
            {SUBTITLE_OPTIONS.map(s => (
              <button key={s.id}
                onClick={() => setExportSubtitleConfig({ ...exportSubtitleConfig, style: s.id })}
                className="py-1.5 px-2 rounded-lg text-xs transition-all"
                style={{
                  background: exportSubtitleConfig.style === s.id ? "var(--accent-dim)" : "var(--bg-2)",
                  color:      exportSubtitleConfig.style === s.id ? "var(--accent)" : "var(--text-2)",
                  border:     `1px solid ${exportSubtitleConfig.style === s.id ? "var(--accent)" : "var(--border)"}`,
                }}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>位置</p>
              <select className="input" style={{ fontSize: "13px", padding: "7px 10px" }}
                value={exportSubtitleConfig.position}
                onChange={e => setExportSubtitleConfig({ ...exportSubtitleConfig, position: e.target.value })}>
                <option value="bottom">底部</option>
                <option value="center">居中</option>
                <option value="top">顶部</option>
              </select>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>字号 {exportSubtitleConfig.font_size}px</p>
              <input type="range" min="18" max="80" step="2" className="w-full mt-2"
                value={exportSubtitleConfig.font_size}
                onChange={e => setExportSubtitleConfig({ ...exportSubtitleConfig, font_size: +e.target.value })} />
            </div>
          </div>
        </div>

        {/* dubbing */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: "var(--text-3)", fontWeight: 500 }}>配音</p>
            <div className={`toggle ${exportDubbing ? "on" : ""}`} onClick={() => setExportDubbing(!exportDubbing)} />
          </div>
          {exportDubbing && (
            <div className="space-y-3">
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>音色</p>
                <div className="flex gap-2 items-center">
                  <select className="input flex-1" style={{ fontSize: "13px", padding: "7px 10px" }}
                    value={exportDubbingVoice}
                    onChange={e => setExportDubbingVoice(e.target.value)}>
                    {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <VoicePreviewBtn voiceId={exportDubbingVoice} />
                </div>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text-3)" }}>语速 {exportDubbingSpeed.toFixed(1)}x</p>
                <input type="range" min="0.5" max="2" step="0.1" className="w-full"
                  value={exportDubbingSpeed}
                  onChange={e => setExportDubbingSpeed(+e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* bottom bar */}
      <div className="divider mt-5 mb-4" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onSelectAll} className="flex items-center gap-1 text-xs" style={{ color: "var(--accent)" }}>
            <CheckSquare size={13} /> 全选
          </button>
          <button onClick={onClearAll} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}>
            <Square size={13} /> 清空
          </button>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            已选 {selected.size} / {job.slices.length}
          </span>
        </div>
        <button onClick={doExport} disabled={exporting || selected.size === 0}
          className="btn btn-primary text-sm py-2">
          <Download size={14} />
          {exporting ? "导出中..." : `导出 ${selected.size} 个切片`}
        </button>
      </div>
    </div>
  );
}

/* ── Slice card ──────────────────────────────────────────── */
function SliceCard({ slice, jobId, index, selected, onToggle }: {
  slice: SliceInfo; jobId: string; index: number;
  selected: boolean; onToggle: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const previewUrl = `/api/slices/preview/${jobId}/${index}`;
  const thumbUrl   = `/api/slices/thumbnail/${jobId}/${index}`;

  return (
    <div className={`slice-card ${selected ? "selected" : ""}`}>
      {/* media */}
      <div className="relative overflow-hidden bg-[#111]" style={{ aspectRatio: "9/16", maxHeight: "280px" }}>
        {playing
          ? <video src={previewUrl} autoPlay controls className="w-full h-full object-cover" />
          : (
            <div className="relative w-full h-full group">
              <img src={thumbUrl} alt="" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
              {/* play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,.5)" }}>
                <button onClick={() => setPlaying(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "var(--accent)" }}>
                  <Play size={16} className="text-black ml-0.5" />
                </button>
              </div>
            </div>
          )
        }

        {/* score badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: "rgba(0,0,0,.75)" }}>
          <Star size={9} style={scoreStyle(slice.score)} />
          <span style={scoreStyle(slice.score)}>{scoreLabel(slice.score)}</span>
          <span style={{ color: "var(--text-3)" }}>{Math.round(slice.score * 100)}</span>
        </div>

        {/* select */}
        <button onClick={onToggle}
          className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center transition-all"
          style={{
            background: selected ? "var(--accent)" : "rgba(0,0,0,.6)",
            border: `1.5px solid ${selected ? "var(--accent)" : "rgba(255,255,255,.3)"}`,
          }}>
          {selected && <Check size={12} className="text-black font-bold" />}
        </button>
      </div>

      {/* info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>片段 {index + 1}</span>
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-3)" }}>
            <Clock size={10} />{formatDuration(slice.duration)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-3)" }}>
          <Zap size={10} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span className="truncate">{slice.reason}</span>
        </div>
        {slice.transcript && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-3)" }}>
            {slice.transcript}
          </p>
        )}
        <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {formatDuration(slice.start)} → {formatDuration(slice.end)}
          </span>
          <a href={previewUrl} download
            className="flex items-center gap-1 text-xs no-underline"
            style={{ color: "var(--accent)" }}>
            <Download size={10} /> 下载
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Main content ─────────────────────────────────────────── */
function SlicesContent() {
  const params     = useSearchParams();
  const jobIdParam = params.get("job");

  const {
    currentJob, setCurrentJob,
    selectedSlices, toggleSliceSelection, selectAllSlices, clearSelection,
    exportSubtitleConfig,
  } = useAppStore();

  const [job,         setJob]         = useState<SliceJob | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [voices,      setVoices]      = useState<Voice[]>([]);
  const [showExport,  setShowExport]  = useState(false);
  const [polling,     setPolling]     = useState(false);
  const [logs,        setLogs]        = useState<LogEntry[]>([]);
  const [showLogs,    setShowLogs]    = useState(false);
  const logSinceRef                   = useRef(0);
  const logEndRef                     = useRef<HTMLDivElement>(null);

  const loadJob = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const j = await getJobStatus(id);
      setJob(j);
      setCurrentJob(j);
      if (j.status === "processing" || j.status === "pending") setPolling(true);
      else setPolling(false);
    } catch {
      toast.error("获取任务状态失败，请检查后端是否运行");
    } finally {
      setLoading(false);
    }
  }, [setCurrentJob]);

  // initial load
  useEffect(() => {
    const id = jobIdParam ?? currentJob?.job_id;
    if (id) loadJob(id);
    getVoices().then(setVoices).catch(() => {});
  }, [jobIdParam, currentJob?.job_id, loadJob]);

  // log polling while processing
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(async () => {
      try {
        const res = await getLogs(logSinceRef.current);
        if (res.logs.length > 0) {
          setLogs(prev => [...prev, ...res.logs]);
          logSinceRef.current = res.total;
          setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      } catch { /* ignore */ }
    }, 1200);
    return () => clearInterval(t);
  }, [polling]);

  // polling
  useEffect(() => {
    if (!polling || !job) return;
    const t = setInterval(async () => {
      try {
        const j = await getJobStatus(job.job_id);
        setJob(j); setCurrentJob(j);
        if (j.status === "done") {
          setPolling(false);
          toast.success(`✅ 切片完成，共 ${j.slices.length} 个片段`);
          selectAllSlices(j.slices.length);
        } else if (j.status === "failed") {
          setPolling(false);
          toast.error("切片处理失败：" + j.error);
        }
      } catch { setPolling(false); }
    }, 2500);
    return () => clearInterval(t);
  }, [polling, job, setCurrentJob, selectAllSlices]);

  /* empty state */
  if (!job && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "var(--bg-2)" }}
        >
          <Upload size={28} style={{ color: "var(--text-3)" }} />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-1)" }}>暂无切片任务</h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-3)" }}>请先上传视频，AI 分析后自动跳转到此页面</p>
        <a href="/" className="btn btn-primary no-underline">上传视频</a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>切片管理</h1>
          {job && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              任务 {job.job_id.slice(0, 8)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => job && loadJob(job.job_id)} disabled={loading}
            className="btn btn-secondary text-xs">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> 刷新
          </button>
          {job?.status === "done" && job.slices.length > 0 && (
            <button
              onClick={() => setShowExport(!showExport)}
              className="btn btn-primary text-xs"
            >
              <Download size={13} /> 导出切片
              <ChevronDown size={12} className={`transition-transform ${showExport ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {job && (
        <div className="card p-4 mb-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              job.status === "done"       ? "bg-green-400" :
              job.status === "failed"     ? "bg-red-400" :
              job.status === "processing" ? "bg-yellow-400 animate-pulse" : "bg-stone-500"
            }`} />
            <span className="text-sm font-medium" style={{ color: "var(--text-1)" }}>
              {job.status === "done"       ? `切片完成 · ${job.slices.length} 个片段` :
               job.status === "failed"     ? "切片失败" :
               job.status === "processing" ? "处理中..." : "等待处理"}
            </span>
          </div>
          {(job.status === "processing" || job.status === "pending") && (
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <div className="progress-track flex-1">
                <div className="progress-fill" style={{ width: `${job.progress}%` }} />
              </div>
              <span className="text-xs" style={{ color: "var(--text-3)" }}>{job.progress}%</span>
            </div>
          )}
          {job.status === "failed" && (
            <span className="text-xs" style={{ color: "var(--red)" }}>{job.error}</span>
          )}
        </div>
      )}

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="card mb-5 overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs"
            style={{ color: "var(--text-3)" }}
          >
            <span>处理日志 ({logs.length} 条)</span>
            <ChevronDown size={12} className={`transition-transform ${showLogs ? "rotate-180" : ""}`} />
          </button>
          {showLogs && (
            <div
              className="px-4 pb-3 overflow-y-auto"
              style={{ maxHeight: "180px", fontFamily: "monospace", fontSize: "11px" }}
            >
              {logs.map((l, i) => (
                <div key={i} style={{
                  color: l.level === "error" ? "var(--red)" : l.level === "warn" ? "var(--yellow)" : "var(--text-3)",
                  lineHeight: "1.7",
                }}>
                  <span style={{ color: "var(--text-3)", marginRight: 6 }}>{l.ts}</span>
                  {l.message}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Export panel */}
      {showExport && job?.status === "done" && (
        <ExportPanel
          job={job} voices={voices}
          selected={selectedSlices}
          onSelectAll={() => selectAllSlices(job.slices.length)}
          onClearAll={clearSelection}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Slices grid */}
      {job?.status === "done" && job.slices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {job.slices.map((slice, i) => (
            <SliceCard key={i} slice={slice} jobId={job.job_id}
              index={i} selected={selectedSlices.has(i)}
              onToggle={() => toggleSliceSelection(i)} />
          ))}
        </div>
      )}

      {/* Skeleton while processing */}
      {(job?.status === "processing" || job?.status === "pending") && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton" style={{ aspectRatio: "9/16", maxHeight: "280px" }} />
              <div className="p-3 space-y-2">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SlicesPage() {
  return (
    <div className="min-h-screen pt-14">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-3)" }} />
        </div>
      }>
        <SlicesContent />
      </Suspense>
    </div>
  );
}
