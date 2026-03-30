import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 300_000, // 5 min for long operations
});

// Types
export interface CreatorPreferences {
  nickname: string;
  category: string;
  target_platform: string[];
  preferred_aspect_ratio: string;
  default_subtitle_style: string;
  default_voice: string;
  voice_speed: number;
  voice_pitch: number;
  add_bgm: boolean;
  bgm_volume: number;
  watermark_text: string;
  highlight_keywords: string[];
  min_highlight_score: number;
}

export interface SliceConfig {
  min_duration: number;
  max_duration: number;
  max_slices: number;
  overlap_seconds: number;
  aspect_ratio: string;
  output_resolution: string;
  output_fps: number;
  video_bitrate: string;
  add_subtitle: boolean;
  subtitle_style: string;
  subtitle_font_size: number;
  subtitle_position: string;
  subtitle_language: string;
  add_dubbing: boolean;
  dubbing_voice: string;
  dubbing_speed: number;
  keep_original_audio: boolean;
  original_audio_volume: number;
}

export interface VideoInfo {
  video_id: string;
  filename: string;
  duration: number;
  size_mb: number;
  width: number;
  height: number;
}

export interface HighlightSegment {
  start: number;
  end: number;
  score: number;
  reason: string;
  transcript: string;
}

export interface AnalyzeResponse {
  video_id: string;
  total_duration: number;
  highlights: HighlightSegment[];
  full_transcript: string;
}

export interface SliceJob {
  job_id: string;
  video_id: string;
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  slices: SliceInfo[];
  error?: string;
}

export interface SliceInfo {
  index: number;
  path: string;
  thumbnail: string | null;
  start: number;
  end: number;
  duration: number;
  score: number;
  reason: string;
  transcript: string;
  subtitle_segments: SubtitleSegment[];
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface SubtitleStyleConfig {
  style: string;
  font_size: number;
  position: string;
  primary_color: string;
  outline_color: string;
  bg_color?: string;
}

export interface Voice {
  id: string;
  name: string;
  gender: string;
  lang: string;
}

// API Functions

export const getPreferences = () =>
  apiClient.get<CreatorPreferences>("/preferences/creator").then(r => r.data);

export const updatePreferences = (data: CreatorPreferences) =>
  apiClient.put<CreatorPreferences>("/preferences/creator", data).then(r => r.data);

export const getSliceConfig = () =>
  apiClient.get<SliceConfig>("/preferences/slice-config").then(r => r.data);

export const updateSliceConfig = (data: SliceConfig) =>
  apiClient.put<SliceConfig>("/preferences/slice-config", data).then(r => r.data);

export const getVoices = () =>
  apiClient.get<Voice[]>("/preferences/voices").then(r => r.data);

export const getSubtitleStyles = () =>
  apiClient.get<{ id: string; name: string; desc: string }[]>("/preferences/subtitle-styles").then(r => r.data);

export const getPlatforms = () =>
  apiClient.get("/preferences/platforms").then(r => r.data);

export const uploadVideo = (file: File, onProgress?: (pct: number) => void) => {
  const form = new FormData();
  form.append("file", file);
  return apiClient.post<VideoInfo>("/videos/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: e => {
      if (onProgress && e.total) onProgress(Math.round(e.loaded / e.total * 100));
    },
  }).then(r => r.data);
};

export const listVideos = () =>
  apiClient.get<VideoInfo[]>("/videos/").then(r => r.data);

export const analyzeVideo = (
  video_id: string,
  slice_config: SliceConfig,
  preferences?: CreatorPreferences,
) =>
  apiClient.post<AnalyzeResponse>("/slices/analyze", {
    video_id,
    slice_config,
    preferences,
  }).then(r => r.data);

export const createSliceJob = (video_id: string) =>
  apiClient.post<{ job_id: string }>(`/slices/create-job?video_id=${video_id}`).then(r => r.data);

export const getJobStatus = (job_id: string) =>
  apiClient.get<SliceJob>(`/slices/jobs/${job_id}`).then(r => r.data);

export const exportSlices = (
  job_id: string,
  slice_indices: number[],
  subtitle_config: SubtitleStyleConfig,
  add_dubbing: boolean,
  dubbing_voice: string,
  dubbing_speed: number,
  keep_original_audio: boolean,
) =>
  apiClient.post("/slices/export", {
    job_id,
    slice_indices,
    subtitle_config,
    add_dubbing,
    dubbing_voice,
    dubbing_speed,
    keep_original_audio,
  }).then(r => r.data);

export interface LogEntry {
  ts: string;
  level: string;
  message: string;
}

export const getLogs = (since = 0) =>
  apiClient.get<{ logs: LogEntry[]; total: number }>(`/preferences/logs?since=${since}`).then(r => r.data);

export const getVoicePreviewUrl = (voiceId: string) =>
  `/api/preferences/voice-preview/${encodeURIComponent(voiceId)}`;

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};
