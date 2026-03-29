"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Film, Download, RefreshCw, Check, Play,
  Mic, Type, Zap, Star, Clock, ChevronDown,
  CheckSquare, Square, X, Settings,
} from "lucide-react";
import {
  getJobStatus, exportSlices, getVoices, getSubtitleStyles,
  formatDuration,
  type SliceJob, type SliceInfo, type Voice,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";

const SUBTITLE_STYLES = [
  { id: "classic",  name: "经典白字",  color: "#ffffff" },
  { id: "karaoke",  name: "卡拉OK",    color: "#ffff00" },
  { id: "gradient", name: "彩色渐变",  color: "#ff88ff" },
  { id: "minimal",  name: "简约条形",  color: "#000000" },
  { id: "bounce",   name: "弹跳动画",  color: "#ffffff" },
  { id: "neon",     name: "霓虹发光",  color: "#00ffff" },
];

const SUBTITLE_POSITIONS = [
  { id: "bottom", label: "底部" },
  { id: "center", label: "居中" },
  { id: "top",    label: "顶部" },
];

function SlicesPageContent() {
  const searchParams = useSearchParams();
  const jobIdFromUrl = searchParams.get("job");

  const {
    currentJob, setCurrentJob,
    selectedSlices, toggleSliceSelection, selectAllSlices, clearSelection,
    exportSubtitleConfig, setExportSubtitleConfig,
    exportDubbing, setExportDubbing,
    exportDubbingVoice, setExportDubbingVoice,
    exportDubbingSpeed, setExportDubbingSpeed,
  } = useAppStore();

  const [job, setJob] = useState<SliceJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [playingSlice, setPlayingSlice] = useState<number | null>(null);

  // Load job
  const loadJob = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const j = await getJobStatus(id);
      setJob(j);
      setCurrentJob(j);
      if (j.status === "processing" || j.status === "pending") {
        setPollingJobId(id);
      } else {
        setPollingJobId(null);
      }
    } catch {
      toast.error("获取任务状态失败");
    } finally {
      setLoading(false);
    }
  }, [setCurrentJob]);

  // Initial load
  useEffect(() => {
    const id = jobIdFromUrl || currentJob?.job_id;
    if (id) loadJob(id);
    getVoices().then(setVoices).catch(() => {});
  }, [jobIdFromUrl, currentJob?.job_id, loadJob]);

  // Polling
  useEffect(() => {
    if (!pollingJobId) return;
    const timer = setInterval(async () => {
      try {
        const j = await getJobStatus(pollingJobId);
        setJob(j);
        setCurrentJob(j);
        if (j.status === "done" || j.status === "failed") {
          setPollingJobId(null);
          if (j.status === "done") {
            toast.success(`切片完成！共 ${j.slices.length} 个片段`);
            selectAllSlices(j.slices.length);
          }
        }
      } catch {
        setPollingJobId(null);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [pollingJobId, setCurrentJob, selectAllSlices]);

  const handleExport = async () => {
    if (!job || selectedSlices.size === 0) return;
    setExporting(true);
    try {
      await exportSlices(
        job.job_id,
        Array.from(selectedSlices),
        exportSubtitleConfig,
        exportDubbing,
        exportDubbingVoice,
        exportDubbingSpeed,
        true,
      );
      toast.success("导出任务已提交！文件将在后台生成");
    } catch {
      toast.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.6) return "text-yellow-400";
    return "text-red-400";
  };

  const scoreLabel = (score: number) => {
    if (score >= 0.8) return "精彩";
    if (score >= 0.6) return "不错";
    return "一般";
  };

  if (!job && !loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: "rgba(204,63,247,.15)" }}>
          <Film size={36} className="text-brand-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3">暂无切片任务</h2>
        <p className="text-[#9090b8] mb-8">请先上传视频并完成 AI 分析</p>
        <a href="/" className="btn-brand inline-flex items-center gap-2 py-3 px-8">
          上传视频
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">切片管理</h1>
          <p className="text-[#9090b8] text-sm mt-1">
            任务 ID: {job?.job_id?.slice(0, 8)}...
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => job && loadJob(job.job_id)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#9090b8] hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,.05)" }}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            刷新
          </button>

          {job?.status === "done" && job.slices.length > 0 && (
            <button
              onClick={() => setShowExportPanel(!showExportPanel)}
              className="btn-brand flex items-center gap-2 py-2">
              <Download size={16} /> 导出切片
              <ChevronDown size={14} className={`transition-transform ${showExportPanel ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      {job && (
        <div className="glass-card p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${
                job.status === "done"       ? "bg-green-400" :
                job.status === "failed"     ? "bg-red-400" :
                job.status === "processing" ? "bg-yellow-400 animate-pulse" :
                "bg-[#9090b8]"
              }`} />
              <span className="font-medium">
                {job.status === "done"       ? "切片完成" :
                 job.status === "failed"     ? "切片失败" :
                 job.status === "processing" ? "切片处理中..." :
                 "等待处理"}
              </span>
              {job.status === "done" && (
                <span className="text-sm text-[#9090b8]">共 {job.slices.length} 个片段</span>
              )}
            </div>

            {(job.status === "processing" || job.status === "pending") && (
              <div className="flex items-center gap-3 flex-1 max-w-xs">
                <div className="progress-bar flex-1">
                  <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                </div>
                <span className="text-sm text-[#9090b8]">{job.progress}%</span>
              </div>
            )}

            {job.status === "failed" && (
              <span className="text-sm text-red-400">{job.error}</span>
            )}
          </div>
        </div>
      )}

      {/* Export panel */}
      {showExportPanel && job?.status === "done" && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <h3 className="font-semibold mb-5 flex items-center gap-2">
            <Settings size={16} className="text-brand-400" /> 导出设置
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Subtitle config */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Type size={14} className="text-brand-400" /> 字幕样式
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {SUBTITLE_STYLES.map(s => (
                  <button key={s.id}
                    onClick={() => setExportSubtitleConfig({ ...exportSubtitleConfig, style: s.id })}
                    className={`p-3 rounded-xl text-xs font-medium text-center transition-all
                      ${exportSubtitleConfig.style === s.id ? "" : "opacity-60 hover:opacity-100"}`}
                    style={{
                      background: exportSubtitleConfig.style === s.id ? "rgba(204,63,247,.25)" : "rgba(255,255,255,.04)",
                      border: `2px solid ${exportSubtitleConfig.style === s.id ? "#cc3ff7" : "rgba(255,255,255,.08)"}`,
                    }}>
                    <div className="w-4 h-4 rounded-full mx-auto mb-1.5" style={{ background: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9090b8] mb-1 block">位置</label>
                  <select className="input-dark text-sm" value={exportSubtitleConfig.position}
                    onChange={e => setExportSubtitleConfig({ ...exportSubtitleConfig, position: e.target.value })}>
                    {SUBTITLE_POSITIONS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#9090b8] mb-1 block">
                    字号 ({exportSubtitleConfig.font_size}px)
                  </label>
                  <input type="range" min="18" max="80" step="2"
                    value={exportSubtitleConfig.font_size}
                    onChange={e => setExportSubtitleConfig({ ...exportSubtitleConfig, font_size: +e.target.value })}
                    className="w-full accent-brand-500 mt-2" />
                </div>
              </div>
            </div>

            {/* Dubbing config */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Mic size={14} className="text-brand-400" /> 配音
                </h4>
                <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${exportDubbing ? "bg-brand-500" : "bg-[#3a3a6a]"}`}
                  onClick={() => setExportDubbing(!exportDubbing)}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${exportDubbing ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </div>

              {exportDubbing && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#9090b8] mb-1 block">音色</label>
                    <select className="input-dark text-sm" value={exportDubbingVoice}
                      onChange={e => setExportDubbingVoice(e.target.value)}>
                      {voices.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#9090b8] mb-1 block">
                      语速 ({exportDubbingSpeed.toFixed(1)}x)
                    </label>
                    <input type="range" min="0.5" max="2" step="0.1"
                      value={exportDubbingSpeed}
                      onChange={e => setExportDubbingSpeed(+e.target.value)}
                      className="w-full accent-brand-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selection summary + export button */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-[#2a2a4a]">
            <div className="flex items-center gap-3">
              <button onClick={() => selectAllSlices(job.slices.length)}
                className="text-sm text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
                <CheckSquare size={14} /> 全选
              </button>
              <button onClick={clearSelection}
                className="text-sm text-[#9090b8] hover:text-white transition-colors flex items-center gap-1">
                <Square size={14} /> 清空
              </button>
              <span className="text-sm text-[#9090b8]">
                已选 {selectedSlices.size} / {job.slices.length} 个
              </span>
            </div>

            <button onClick={handleExport}
              disabled={exporting || selectedSlices.size === 0}
              className="btn-brand flex items-center gap-2">
              <Download size={16} />
              {exporting ? "导出中..." : `导出 ${selectedSlices.size} 个切片`}
            </button>
          </div>
        </div>
      )}

      {/* Slices grid */}
      {job?.status === "done" && job.slices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {job.slices.map((slice, idx) => (
            <SliceCard
              key={idx}
              slice={slice}
              jobId={job.job_id}
              index={idx}
              selected={selectedSlices.has(idx)}
              onToggle={() => toggleSliceSelection(idx)}
              playing={playingSlice === idx}
              onPlayToggle={() => setPlayingSlice(playingSlice === idx ? null : idx)}
              scoreColor={scoreColor}
              scoreLabel={scoreLabel}
            />
          ))}
        </div>
      )}

      {/* Processing skeleton */}
      {(job?.status === "processing" || job?.status === "pending") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="slice-card">
              <div className="aspect-[9/16] bg-[#1a1a3a] animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-[#2a2a4a] rounded animate-pulse" />
                <div className="h-4 bg-[#2a2a4a] rounded w-2/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SliceCard({
  slice, jobId, index, selected, onToggle, playing, onPlayToggle,
  scoreColor, scoreLabel,
}: {
  slice: SliceInfo;
  jobId: string;
  index: number;
  selected: boolean;
  onToggle: () => void;
  playing: boolean;
  onPlayToggle: () => void;
  scoreColor: (s: number) => string;
  scoreLabel: (s: number) => string;
}) {
  const thumbUrl = `/api/slices/thumbnail/${jobId}/${index}`;
  const previewUrl = `/api/slices/preview/${jobId}/${index}`;

  return (
    <div className={`slice-card ${selected ? "selected" : ""}`}
      style={{ cursor: "default" }}>
      {/* Thumbnail / Video */}
      <div className="aspect-video relative overflow-hidden bg-[#111128]"
        style={{ aspectRatio: "9/16", maxHeight: "300px" }}>
        {playing ? (
          <video
            src={previewUrl}
            autoPlay
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="relative group w-full h-full">
            <img
              src={thumbUrl}
              alt={`切片 ${index + 1}`}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,.5)" }}>
              <button onClick={onPlayToggle}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(204,63,247,.8)" }}>
                <Play size={20} className="text-white ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Score badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
          style={{ background: "rgba(0,0,0,.7)" }}>
          <Star size={10} className={scoreColor(slice.score)} />
          <span className={scoreColor(slice.score)}>{scoreLabel(slice.score)}</span>
          <span className="text-[#9090b8]">{(slice.score * 100).toFixed(0)}分</span>
        </div>

        {/* Select checkbox */}
        <button onClick={onToggle}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: selected ? "#cc3ff7" : "rgba(0,0,0,.6)",
            border: `2px solid ${selected ? "#cc3ff7" : "rgba(255,255,255,.3)"}`,
          }}>
          {selected && <Check size={14} className="text-white" />}
        </button>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">片段 {index + 1}</span>
          <span className="text-xs text-[#9090b8] flex items-center gap-1">
            <Clock size={11} /> {formatDuration(slice.duration)}
          </span>
        </div>

        <div className="text-xs text-[#9090b8] flex items-center gap-2">
          <Zap size={11} className="text-brand-400" />
          {slice.reason}
        </div>

        {slice.transcript && (
          <p className="text-xs text-[#9090b8] line-clamp-2 leading-relaxed">
            {slice.transcript}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-[#9090b8]">
          <span>{formatDuration(slice.start)} → {formatDuration(slice.end)}</span>
          <a
            href={`/api/slices/download/slice_${index.toString().padStart(2, "0")}.mp4`}
            download
            className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors"
            onClick={e => e.stopPropagation()}>
            <Download size={11} /> 下载
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SlicesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-[#9090b8]">加载中...</div>}>
      <SlicesPageContent />
    </Suspense>
  );
}
