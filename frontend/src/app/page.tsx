"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Upload, CheckCircle, Loader2, Sparkles,
  ArrowRight, Film, Type, Mic,
} from "lucide-react";
import { uploadVideo, analyzeVideo, createSliceJob, getPreferences, getSliceConfig, getLogs, type LogEntry } from "@/lib/api";
import { useAppStore } from "@/lib/store";

type Step = "idle" | "uploading" | "transcribing" | "analyzing" | "done";

const STEP_LABEL: Record<Step, string> = {
  idle:         "",
  uploading:    "正在上传...",
  transcribing: "Whisper 语音转录中...",
  analyzing:    "豆包 AI 分析精彩片段...",
  done:         "完成！跳转中...",
};

export default function HomePage() {
  const router = useRouter();
  const { setUploadedVideo, setAnalyzeResult, setCurrentJob } = useAppStore();
  const [step, setStep]         = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const logSinceRef             = useRef(0);
  const logEndRef               = useRef<HTMLDivElement>(null);

  // Poll logs while transcribing/analyzing
  useEffect(() => {
    if (step !== "transcribing" && step !== "analyzing") return;
    const t = setInterval(async () => {
      try {
        const res = await getLogs(logSinceRef.current);
        if (res.logs.length > 0) {
          setLogs(prev => [...prev, ...res.logs]);
          logSinceRef.current = res.total;
          setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);

    try {
      // reset logs
      setLogs([]);
      logSinceRef.current = 0;

      // 1. Upload
      setStep("uploading");
      const video = await uploadVideo(file, pct => setProgress(pct));
      setUploadedVideo(video);

      // 2. Transcribe + Analyze
      setStep("transcribing");
      const [prefs, config] = await Promise.all([getPreferences(), getSliceConfig()]);

      setStep("analyzing");
      const analysis = await analyzeVideo(video.video_id, config, prefs);
      setAnalyzeResult(analysis);
      toast.success(`发现 ${analysis.highlights.length} 个精彩片段`);

      // 3. Create job
      const { job_id } = await createSliceJob(video.video_id);
      setCurrentJob({ job_id, video_id: video.video_id, status: "pending", progress: 0, slices: [] });

      setStep("done");
      setTimeout(() => router.push(`/slices?job=${job_id}`), 800);

    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败，请重试");
      setStep("idle");
    }
  }, [router, setUploadedVideo, setAnalyzeResult, setCurrentJob]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"] },
    maxFiles: 1,
    disabled: step !== "idle",
  });

  const busy = step !== "idle";
  const done = step === "done";

  return (
    <div className="min-h-screen pt-14 flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 flex flex-col">

        {/* Hero text */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(251,146,60,.25)" }}
          >
            <Sparkles size={11} />
            豆包 AI · 自动识别精彩片段
          </div>
          <h1
            className="text-4xl font-bold mb-3 leading-tight"
            style={{ color: "var(--text-1)" }}
          >
            视频批量切片系统
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "15px" }}>
            上传视频，AI 自动提取精彩内容，一键生成多平台短视频
          </p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className="card flex flex-col items-center justify-center text-center cursor-pointer transition-all"
          style={{
            padding: "60px 40px",
            borderStyle: "dashed",
            borderColor: isDragActive ? "var(--accent)" : busy ? "var(--border)" : "rgba(255,255,255,0.1)",
            background: isDragActive ? "var(--accent-glow)" : "var(--card)",
            cursor: busy ? "default" : "pointer",
          }}
        >
          <input {...getInputProps()} />

          {!busy && (
            <>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "var(--accent-dim)" }}
              >
                <Upload size={28} style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-base font-medium mb-1" style={{ color: "var(--text-1)" }}>
                {isDragActive ? "松开以上传" : "拖拽视频到此处，或点击选择"}
              </p>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                支持 MP4 · MOV · AVI · MKV · WebM
              </p>
              <p className="text-xs mt-2 px-3 py-1.5 rounded-lg" style={{ color: "var(--accent)", background: "var(--accent-dim)" }}>
                推荐视频大小 500MB 以内 · 时长建议 3~30 分钟
              </p>
            </>
          )}

          {busy && !done && (
            <div className="space-y-4 w-full max-w-xs">
              <Loader2 size={32} className="mx-auto animate-spin" style={{ color: "var(--accent)" }} />
              <p className="font-medium" style={{ color: "var(--text-1)" }}>{STEP_LABEL[step]}</p>
              {step === "uploading" && (
                <>
                  <p className="text-sm truncate" style={{ color: "var(--text-3)" }}>{fileName}</p>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-3)" }}>{progress}%</p>
                </>
              )}
              {(step === "transcribing" || step === "analyzing") && (
                <>
                  <div className="dot-loader flex justify-center">
                    <span /><span /><span />
                  </div>
                  {logs.length > 0 && (
                    <div
                      className="w-full text-left rounded-lg p-3 mt-2 overflow-y-auto"
                      style={{
                        background: "var(--bg-2)", border: "1px solid var(--border)",
                        maxHeight: "120px", fontSize: "11px", fontFamily: "monospace",
                      }}
                    >
                      {logs.map((l, i) => (
                        <div key={i} style={{
                          color: l.level === "error" ? "var(--red)" : l.level === "warn" ? "var(--yellow)" : "var(--text-3)",
                          lineHeight: "1.6",
                        }}>
                          <span style={{ color: "var(--text-3)", marginRight: 6 }}>{l.ts}</span>
                          {l.message}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {done && (
            <div className="space-y-3">
              <CheckCircle size={36} className="mx-auto" style={{ color: "var(--green)" }} />
              <p className="font-medium" style={{ color: "var(--green)" }}>分析完成！</p>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-3 gap-3 mt-8">
          {[
            { icon: Sparkles, title: "AI 精彩识别", desc: "豆包大模型分析内容" },
            { icon: Type,     title: "6 种字幕",    desc: "经典 / 卡拉OK / 霓虹" },
            { icon: Mic,      title: "配音合成",    desc: "10+ 中英文音色可选" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-4 text-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                style={{ background: "var(--accent-dim)" }}
              >
                <Icon size={16} style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-sm font-medium mb-0.5" style={{ color: "var(--text-1)" }}>{title}</p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {[
            { href: "/slices",      icon: Film,     label: "切片管理", sub: "查看 & 导出已生成的切片" },
            { href: "/preferences", icon: Settings2, label: "创作偏好", sub: "配置平台、字幕、配音默认值" },
          ].map(({ href, icon: Icon, label, sub }) => (
            <a
              key={href}
              href={href}
              className="card flex items-center gap-3 p-4 no-underline group"
              style={{ color: "inherit" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--bg-2)" }}
              >
                <Icon size={16} style={{ color: "var(--text-2)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-1)" }}>{label}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{sub}</p>
              </div>
              <ArrowRight size={14} style={{ color: "var(--text-3)" }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// inline to avoid extra file
function Settings2({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
