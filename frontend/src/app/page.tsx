"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Upload, Film, CheckCircle, AlertCircle,
  Clock, HardDrive, Zap, Settings, ChevronRight,
} from "lucide-react";
import { uploadVideo, analyzeVideo, createSliceJob, getPreferences, getSliceConfig } from "@/lib/api";
import { useAppStore } from "@/lib/store";

type Step = "upload" | "uploading" | "analyze" | "analyzing" | "done";

export default function UploadPage() {
  const router = useRouter();
  const { setUploadedVideo, setAnalyzeResult, setCurrentJob } = useAppStore();

  const [step, setStep]       = useState<Step>("upload");
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;

    setFileInfo({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(1) + " MB",
    });
    setStep("uploading");
    setProgress(0);

    try {
      // 1. Upload
      const videoInfo = await uploadVideo(file, pct => setProgress(pct));
      setUploadedVideo(videoInfo);
      toast.success("视频上传成功！");
      setStep("analyze");

      // 2. Auto-analyze
      setStep("analyzing");
      const [prefs, config] = await Promise.all([getPreferences(), getSliceConfig()]);
      const analysis = await analyzeVideo(videoInfo.video_id, config, prefs);
      setAnalyzeResult(analysis);
      toast.success(`发现 ${analysis.highlights.length} 个精彩片段！`);

      // 3. Create slice job
      const { job_id } = await createSliceJob(videoInfo.video_id);
      setCurrentJob({ job_id, video_id: videoInfo.video_id, status: "pending", progress: 0, slices: [] });
      setStep("done");

      // Navigate to slices page
      setTimeout(() => router.push(`/slices?job=${job_id}`), 1000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast.error(msg);
      setStep("upload");
    }
  }, [router, setUploadedVideo, setAnalyzeResult, setCurrentJob]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"],
    },
    maxFiles: 1,
    disabled: step !== "upload",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          <span className="gradient-text">AI 视频切片系统</span>
        </h1>
        <p className="text-[#9090b8] text-lg">
          上传视频，AI 自动识别精彩内容，一键生成多样式字幕短视频
        </p>
      </div>

      {/* Feature badges */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {[
          { icon: Zap,       label: "AI 精彩识别" },
          { icon: Film,      label: "多平台适配" },
          { icon: Settings,  label: "多样式字幕" },
          { icon: CheckCircle, label: "配音合成" },
        ].map(({ icon: Icon, label }) => (
          <div key={label}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-[#9090b8]"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon size={14} className="text-brand-400" />
            {label}
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <div className="glass-card p-2 mb-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all
            ${isDragActive ? "border-brand-400 bg-brand-500/10" : "border-[#3a3a6a] hover:border-brand-500/50"}
            ${step !== "upload" ? "cursor-default opacity-80" : ""}
          `}
        >
          <input {...getInputProps()} />

          {step === "upload" && (
            <>
              <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(204,63,247,.2) 0%,rgba(99,102,241,.2) 100%)" }}>
                <Upload size={36} className="text-brand-400" />
              </div>
              <p className="text-xl font-semibold mb-2">
                {isDragActive ? "放开以上传" : "拖拽或点击上传视频"}
              </p>
              <p className="text-[#9090b8] text-sm">支持 MP4, MOV, AVI, MKV, WebM · 无大小限制</p>
            </>
          )}

          {step === "uploading" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgba(204,63,247,.2)" }}>
                <HardDrive size={28} className="text-brand-400 animate-pulse" />
              </div>
              <p className="text-lg font-semibold">正在上传 {fileInfo?.name}</p>
              <p className="text-[#9090b8] text-sm">{fileInfo?.size}</p>
              <div className="max-w-xs mx-auto">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm text-[#9090b8] mt-2">{progress}%</p>
              </div>
            </div>
          )}

          {step === "analyze" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgba(204,63,247,.2)" }}>
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <p className="text-lg font-semibold">上传成功！</p>
              <p className="text-[#9090b8]">准备开始 AI 分析...</p>
            </div>
          )}

          {step === "analyzing" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center animate-pulse-slow"
                style={{ background: "linear-gradient(135deg,rgba(204,63,247,.3) 0%,rgba(99,102,241,.3) 100%)" }}>
                <Zap size={28} className="text-brand-400" />
              </div>
              <p className="text-lg font-semibold">AI 正在分析精彩内容...</p>
              <p className="text-[#9090b8] text-sm">使用 Whisper 转录 + Claude AI 识别精彩片段</p>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgba(74,222,128,.2)" }}>
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <p className="text-lg font-semibold text-green-400">分析完成！</p>
              <p className="text-[#9090b8]">正在跳转到切片管理页面...</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a href="/preferences" className="glass-card p-5 flex items-center gap-4 hover:border-brand-500/30 transition-colors cursor-pointer no-underline">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(204,63,247,.15)" }}>
            <Settings size={22} className="text-brand-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">创作偏好设置</p>
            <p className="text-xs text-[#9090b8] mt-1">设置目标平台、内容类型、关键词</p>
          </div>
          <ChevronRight size={16} className="text-[#9090b8] ml-auto" />
        </a>
        <a href="/slices" className="glass-card p-5 flex items-center gap-4 hover:border-brand-500/30 transition-colors cursor-pointer no-underline">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(99,102,241,.15)" }}>
            <Film size={22} className="text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">切片管理</p>
            <p className="text-xs text-[#9090b8] mt-1">查看、编辑、导出已生成的切片</p>
          </div>
          <ChevronRight size={16} className="text-[#9090b8] ml-auto" />
        </a>
      </div>

      {/* How it works */}
      <div className="mt-16">
        <h2 className="text-center text-xl font-bold mb-8 text-[#9090b8]">使用流程</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { step: "01", title: "上传视频",     desc: "支持所有常见格式" },
            { step: "02", title: "AI 识别精彩",  desc: "Whisper + Claude 分析" },
            { step: "03", title: "自动切片",     desc: "按平台比例裁剪" },
            { step: "04", title: "导出成片",     desc: "字幕 + 配音一键添加" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="text-3xl font-bold gradient-text mb-2">{step}</div>
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-[#9090b8]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
