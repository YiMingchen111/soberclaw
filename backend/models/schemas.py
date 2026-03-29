from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────

class SubtitleStyle(str, Enum):
    CLASSIC   = "classic"    # 白字黑边
    KARAOKE   = "karaoke"   # 逐字高亮
    GRADIENT  = "gradient"  # 彩色渐变
    MINIMAL   = "minimal"   # 顶部简约条
    BOUNCE    = "bounce"    # 弹跳动画
    NEON      = "neon"      # 霓虹发光


class VideoCategory(str, Enum):
    VLOG      = "vlog"
    KNOWLEDGE = "knowledge"
    FUNNY     = "funny"
    EMOTIONAL = "emotional"
    PRODUCT   = "product"
    NEWS      = "news"
    SPORT     = "sport"


class AspectRatio(str, Enum):
    RATIO_9_16 = "9:16"   # 竖屏（抖音/快手/Reels）
    RATIO_1_1  = "1:1"    # 方形（Instagram）
    RATIO_16_9 = "16:9"   # 横屏（B站/YouTube）


class VoiceGender(str, Enum):
    MALE   = "male"
    FEMALE = "female"


class SliceStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    DONE       = "done"
    FAILED     = "failed"


# ── Preferences ────────────────────────────────────────────────────────────

class CreatorPreferences(BaseModel):
    """用户的短视频创作偏好"""
    nickname: str = Field(default="Creator", description="创作者昵称")
    category: VideoCategory = Field(default=VideoCategory.VLOG, description="内容类型")
    target_platform: List[str] = Field(
        default=["douyin", "kuaishou"],
        description="目标平台：douyin/kuaishou/bilibili/instagram/youtube"
    )
    preferred_aspect_ratio: AspectRatio = Field(default=AspectRatio.RATIO_9_16)
    default_subtitle_style: SubtitleStyle = Field(default=SubtitleStyle.CLASSIC)
    default_voice: str = Field(default="zh-CN-XiaoxiaoNeural", description="默认配音音色")
    voice_speed: float = Field(default=1.0, ge=0.5, le=2.0, description="配音语速")
    voice_pitch: float = Field(default=0.0, ge=-50.0, le=50.0, description="音调调整(Hz)")
    add_bgm: bool = Field(default=False, description="是否自动添加背景音乐")
    bgm_volume: float = Field(default=0.3, ge=0.0, le=1.0, description="背景音乐音量")
    watermark_text: str = Field(default="", description="水印文字")
    highlight_keywords: List[str] = Field(
        default=[],
        description="精彩内容关键词（AI分析时重点关注）"
    )
    min_highlight_score: float = Field(
        default=0.6, ge=0.0, le=1.0,
        description="精彩度阈值，高于此分数的片段才会被选取"
    )


# ── Slice Config ───────────────────────────────────────────────────────────

class SliceConfig(BaseModel):
    """切片参数配置"""
    min_duration: float = Field(default=15.0, ge=3.0, le=300.0, description="最短切片时长(秒)")
    max_duration: float = Field(default=60.0, ge=5.0, le=600.0, description="最长切片时长(秒)")
    max_slices: int = Field(default=5, ge=1, le=20, description="最多提取切片数量")
    overlap_seconds: float = Field(default=0.5, ge=0.0, le=5.0, description="切片前后延伸(秒)")
    aspect_ratio: AspectRatio = Field(default=AspectRatio.RATIO_9_16)
    output_resolution: str = Field(default="1080x1920", description="输出分辨率（竖屏默认）")
    output_fps: int = Field(default=30, ge=15, le=60)
    video_bitrate: str = Field(default="4M", description="视频码率")

    # 字幕配置
    add_subtitle: bool = Field(default=True)
    subtitle_style: SubtitleStyle = Field(default=SubtitleStyle.CLASSIC)
    subtitle_font_size: int = Field(default=42, ge=18, le=80)
    subtitle_position: str = Field(default="bottom", description="top/center/bottom")
    subtitle_language: str = Field(default="zh", description="字幕语言")

    # 配音配置
    add_dubbing: bool = Field(default=False)
    dubbing_voice: str = Field(default="zh-CN-XiaoxiaoNeural")
    dubbing_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    keep_original_audio: bool = Field(default=True, description="是否保留原声")
    original_audio_volume: float = Field(default=0.3, ge=0.0, le=1.0)


# ── Video Upload ────────────────────────────────────────────────────────────

class VideoUploadResponse(BaseModel):
    video_id: str
    filename: str
    duration: float
    size_mb: float
    message: str


class AnalyzeRequest(BaseModel):
    video_id: str
    slice_config: SliceConfig
    preferences: Optional[CreatorPreferences] = None


class HighlightSegment(BaseModel):
    start: float
    end: float
    score: float
    reason: str
    transcript: str


class AnalyzeResponse(BaseModel):
    video_id: str
    total_duration: float
    highlights: List[HighlightSegment]
    full_transcript: str


class SliceJob(BaseModel):
    job_id: str
    video_id: str
    status: SliceStatus
    progress: int = 0
    slices: List[dict] = []
    error: Optional[str] = None


class SubtitleStyleConfig(BaseModel):
    style: SubtitleStyle
    font_size: int = 42
    position: str = "bottom"
    primary_color: str = "white"
    outline_color: str = "black"
    bg_color: Optional[str] = None
    animation: Optional[str] = None


class ExportRequest(BaseModel):
    job_id: str
    slice_indices: List[int]
    subtitle_config: Optional[SubtitleStyleConfig] = None
    add_dubbing: bool = False
    dubbing_voice: str = "zh-CN-XiaoxiaoNeural"
    dubbing_speed: float = 1.0
    keep_original_audio: bool = True


# ── Voice List ─────────────────────────────────────────────────────────────

AVAILABLE_VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓（温柔女声）", "gender": "female", "lang": "zh-CN"},
    {"id": "zh-CN-YunxiNeural", "name": "云希（活力男声）", "gender": "male", "lang": "zh-CN"},
    {"id": "zh-CN-YunjianNeural", "name": "云健（成熟男声）", "gender": "male", "lang": "zh-CN"},
    {"id": "zh-CN-XiaohanNeural", "name": "晓涵（知性女声）", "gender": "female", "lang": "zh-CN"},
    {"id": "zh-CN-XiaomengNeural", "name": "晓梦（甜美女声）", "gender": "female", "lang": "zh-CN"},
    {"id": "zh-CN-XiaomoNeural", "name": "晓墨（稳重女声）", "gender": "female", "lang": "zh-CN"},
    {"id": "zh-TW-HsiaoChenNeural", "name": "曉臻（台湾女声）", "gender": "female", "lang": "zh-TW"},
    {"id": "zh-TW-YunJheNeural", "name": "雲哲（台湾男声）", "gender": "male", "lang": "zh-TW"},
    {"id": "en-US-JennyNeural", "name": "Jenny（英文女声）", "gender": "female", "lang": "en-US"},
    {"id": "en-US-GuyNeural", "name": "Guy（英文男声）", "gender": "male", "lang": "en-US"},
]
