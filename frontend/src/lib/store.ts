import { create } from "zustand";
import type {
  CreatorPreferences, SliceConfig, VideoInfo,
  AnalyzeResponse, SliceJob, SubtitleStyleConfig,
} from "./api";

interface AppState {
  // Upload
  uploadedVideo: VideoInfo | null;
  setUploadedVideo: (v: VideoInfo | null) => void;

  // Analysis
  analyzeResult: AnalyzeResponse | null;
  setAnalyzeResult: (r: AnalyzeResponse | null) => void;

  // Job
  currentJob: SliceJob | null;
  setCurrentJob: (j: SliceJob | null) => void;

  // Selected slices for export
  selectedSlices: Set<number>;
  toggleSliceSelection: (idx: number) => void;
  selectAllSlices: (count: number) => void;
  clearSelection: () => void;

  // Export subtitle config
  exportSubtitleConfig: SubtitleStyleConfig;
  setExportSubtitleConfig: (c: SubtitleStyleConfig) => void;

  // Export dubbing
  exportDubbing: boolean;
  setExportDubbing: (v: boolean) => void;
  exportDubbingVoice: string;
  setExportDubbingVoice: (v: string) => void;
  exportDubbingSpeed: number;
  setExportDubbingSpeed: (v: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  uploadedVideo: null,
  setUploadedVideo: v => set({ uploadedVideo: v }),

  analyzeResult: null,
  setAnalyzeResult: r => set({ analyzeResult: r }),

  currentJob: null,
  setCurrentJob: j => set({ currentJob: j }),

  selectedSlices: new Set(),
  toggleSliceSelection: idx => {
    const s = new Set(get().selectedSlices);
    s.has(idx) ? s.delete(idx) : s.add(idx);
    set({ selectedSlices: s });
  },
  selectAllSlices: count => {
    set({ selectedSlices: new Set(Array.from({ length: count }, (_, i) => i)) });
  },
  clearSelection: () => set({ selectedSlices: new Set() }),

  exportSubtitleConfig: {
    style: "classic",
    font_size: 42,
    position: "bottom",
    primary_color: "white",
    outline_color: "black",
  },
  setExportSubtitleConfig: c => set({ exportSubtitleConfig: c }),

  exportDubbing: false,
  setExportDubbing: v => set({ exportDubbing: v }),
  exportDubbingVoice: "zh-CN-XiaoxiaoNeural",
  setExportDubbingVoice: v => set({ exportDubbingVoice: v }),
  exportDubbingSpeed: 1.0,
  setExportDubbingSpeed: v => set({ exportDubbingSpeed: v }),
}));
