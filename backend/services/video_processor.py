"""
视频处理服务：使用 FFmpeg 进行视频切片、字幕合成、音频混合
"""
import asyncio
import subprocess
import json
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import List, Tuple, Optional

from models.schemas import SubtitleStyle, SubtitleStyleConfig, AspectRatio


UPLOADS_DIR = Path("uploads")
OUTPUTS_DIR = Path("outputs")
TEMP_DIR    = Path("temp")

for d in [UPLOADS_DIR, OUTPUTS_DIR, TEMP_DIR]:
    d.mkdir(exist_ok=True)


def run_ffmpeg(cmd: List[str], timeout: int = 300) -> Tuple[str, str]:
    """运行 ffmpeg 命令"""
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg error:\n{result.stderr}")
    return result.stdout, result.stderr


async def get_video_info(video_path: str) -> dict:
    """获取视频元信息"""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)

    duration = float(data["format"]["duration"])
    size_bytes = int(data["format"]["size"])

    width = height = 0
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = stream.get("width", 0)
            height = stream.get("height", 0)
            break

    return {
        "duration": duration,
        "size_mb": round(size_bytes / 1024 / 1024, 2),
        "width": width,
        "height": height,
        "format": data["format"].get("format_name", ""),
    }


async def extract_audio(video_path: str, output_path: str) -> str:
    """从视频中提取音频（WAV格式，用于转录）"""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le",
        "-ar", "16000", "-ac", "1",
        output_path
    ]
    await asyncio.get_event_loop().run_in_executor(
        None, lambda: run_ffmpeg(cmd)
    )
    return output_path


async def cut_video_segment(
    input_path: str,
    output_path: str,
    start: float,
    end: float,
    aspect_ratio: AspectRatio = AspectRatio.RATIO_9_16,
    resolution: str = "1080x1920",
    fps: int = 30,
    bitrate: str = "4M",
) -> str:
    """裁剪视频片段并转换分辨率"""
    duration = end - start
    w, h = resolution.split("x")
    w, h = int(w), int(h)

    # 根据比例计算 crop/scale/pad 滤镜
    vf = _build_resize_filter(aspect_ratio, w, h)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start),
        "-i", input_path,
        "-t", str(duration),
        "-vf", vf,
        "-r", str(fps),
        "-c:v", "libx264",
        "-b:v", bitrate,
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        output_path
    ]
    await asyncio.get_event_loop().run_in_executor(
        None, lambda: run_ffmpeg(cmd, timeout=600)
    )
    return output_path


def _build_resize_filter(aspect_ratio: AspectRatio, w: int, h: int) -> str:
    """构建 FFmpeg 视频缩放滤镜（保持原始内容，添加黑边）"""
    return (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
    )


def _subtitle_style_to_ass_tags(cfg: SubtitleStyleConfig) -> dict:
    """将字幕样式配置转换为 ASS 样式参数"""
    color_map = {
        "white":  "&H00FFFFFF",
        "yellow": "&H0000FFFF",
        "black":  "&H00000000",
        "red":    "&H000000FF",
        "blue":   "&H00FF0000",
        "green":  "&H0000FF00",
        "cyan":   "&H00FFFF00",
        "pink":   "&H00FF00FF",
    }

    primary = color_map.get(cfg.primary_color, "&H00FFFFFF")
    outline  = color_map.get(cfg.outline_color, "&H00000000")
    back     = color_map.get(cfg.bg_color, "&H80000000") if cfg.bg_color else "&H00000000"

    style_params = {
        "classic": {
            "PrimaryColour": primary,
            "OutlineColour": outline,
            "BackColour":   "&H80000000",
            "Outline":      "2",
            "Shadow":       "1",
            "BorderStyle":  "1",
        },
        "karaoke": {
            "PrimaryColour":   "&H0000FFFF",  # 黄色激活
            "SecondaryColour": "&H00FFFFFF",  # 白色待激活
            "OutlineColour":   "&H00000000",
            "BackColour":      "&HA0000000",
            "Outline": "2",
            "Shadow": "0",
            "BorderStyle": "1",
        },
        "gradient": {
            "PrimaryColour": "&H0000FFFF",
            "OutlineColour": "&H00FF00FF",
            "BackColour":    "&H40000000",
            "Outline": "3",
            "Shadow": "2",
            "BorderStyle": "1",
        },
        "minimal": {
            "PrimaryColour": "&H00000000",  # 黑字
            "OutlineColour": "&H00FFFFFF",
            "BackColour":    "&HCOFFFFFF",
            "Outline": "0",
            "Shadow": "0",
            "BorderStyle": "4",  # 不透明背景框
        },
        "neon": {
            "PrimaryColour": "&H0000FFFF",
            "OutlineColour": "&H00FF00FF",
            "BackColour":    "&H00000000",
            "Outline": "4",
            "Shadow": "3",
            "BorderStyle": "1",
        },
        "bounce": {
            "PrimaryColour": "&H00FFFFFF",
            "OutlineColour": "&H00000000",
            "BackColour":    "&H80000000",
            "Outline": "2",
            "Shadow": "2",
            "BorderStyle": "1",
        },
    }

    return style_params.get(cfg.style.value, style_params["classic"])


def _build_ass_content(
    segments: List[dict],
    cfg: SubtitleStyleConfig,
    video_width: int = 1080,
    video_height: int = 1920,
) -> str:
    """生成 ASS 字幕文件内容"""
    font_size = cfg.font_size
    style_tags = _subtitle_style_to_ass_tags(cfg)

    # 字幕垂直位置
    margin_v = {
        "top":    50,
        "center": video_height // 2,
        "bottom": 120,
    }.get(cfg.position, 120)

    alignment = {"top": 8, "center": 5, "bottom": 2}.get(cfg.position, 2)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Source Han Sans CN,{font_size},{style_tags.get('PrimaryColour','&H00FFFFFF')},&H000000FF,{style_tags.get('OutlineColour','&H00000000')},{style_tags.get('BackColour','&H80000000')},0,0,0,0,100,100,0,0,{style_tags.get('BorderStyle','1')},{style_tags.get('Outline','2')},{style_tags.get('Shadow','1')},{alignment},10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    for seg in segments:
        start_ts = _seconds_to_ass_time(seg["start"])
        end_ts   = _seconds_to_ass_time(seg["end"])
        text = seg["text"].replace("\n", "\\N")

        # Karaoke 模式：逐字高亮
        if cfg.style == SubtitleStyle.KARAOKE:
            words = text.split()
            total_dur = seg["end"] - seg["start"]
            per_word  = (total_dur / max(len(words), 1)) * 100  # centiseconds
            kar_text  = "".join(f"{{\\k{int(per_word)}}}{w} " for w in words)
            text = kar_text.strip()

        # Bounce 动画
        elif cfg.style == SubtitleStyle.BOUNCE:
            text = f"{{\\t(0,200,\\fscx120\\fscy120)}}{{\\t(200,400,\\fscx100\\fscy100)}}{text}"

        # Neon 发光效果（通过模糊模拟）
        elif cfg.style == SubtitleStyle.NEON:
            text = f"{{\\blur8}}{text}"

        events.append(f"Dialogue: 0,{start_ts},{end_ts},Default,,0,0,0,,{text}")

    return header + "\n".join(events) + "\n"


def _seconds_to_ass_time(seconds: float) -> str:
    """转换秒数为 ASS 时间格式 H:MM:SS.cc"""
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


async def burn_subtitles(
    input_video: str,
    output_video: str,
    subtitle_segments: List[dict],
    cfg: SubtitleStyleConfig,
    video_width: int = 1080,
    video_height: int = 1920,
) -> str:
    """将字幕烧录到视频"""
    ass_path = TEMP_DIR / f"{uuid.uuid4()}.ass"
    ass_content = _build_ass_content(subtitle_segments, cfg, video_width, video_height)
    ass_path.write_text(ass_content, encoding="utf-8")

    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", input_video,
            "-vf", f"ass={ass_path}",
            "-c:v", "libx264",
            "-crf", "18",
            "-c:a", "copy",
            "-movflags", "+faststart",
            output_video
        ]
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: run_ffmpeg(cmd, timeout=600)
        )
    finally:
        if ass_path.exists():
            ass_path.unlink()

    return output_video


async def mix_dubbing(
    input_video: str,
    output_video: str,
    dubbing_audio: str,
    keep_original: bool = True,
    original_volume: float = 0.3,
) -> str:
    """将配音音频混入视频"""
    if keep_original:
        filter_complex = (
            f"[0:a]volume={original_volume}[orig];"
            f"[1:a]volume=1.0[dub];"
            f"[orig][dub]amix=inputs=2:duration=first[aout]"
        )
        cmd = [
            "ffmpeg", "-y",
            "-i", input_video,
            "-i", dubbing_audio,
            "-filter_complex", filter_complex,
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            output_video
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-i", input_video,
            "-i", dubbing_audio,
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            output_video
        ]

    await asyncio.get_event_loop().run_in_executor(
        None, lambda: run_ffmpeg(cmd, timeout=600)
    )
    return output_video


async def add_watermark(
    input_video: str,
    output_video: str,
    text: str,
    position: str = "bottom-right",
) -> str:
    """添加文字水印"""
    pos_map = {
        "top-left":     "(w*0.02):(h*0.02)",
        "top-right":    "(w*0.98-tw):(h*0.02)",
        "bottom-left":  "(w*0.02):(h*0.95-th)",
        "bottom-right": "(w*0.98-tw):(h*0.95-th)",
    }
    xy = pos_map.get(position, pos_map["bottom-right"])

    vf = (
        f"drawtext=text='{text}':"
        f"fontsize=28:fontcolor=white@0.7:"
        f"x={xy.split(':')[0]}:y={xy.split(':')[1]}:"
        "shadowcolor=black@0.5:shadowx=2:shadowy=2"
    )
    cmd = [
        "ffmpeg", "-y",
        "-i", input_video,
        "-vf", vf,
        "-c:v", "libx264", "-crf", "18",
        "-c:a", "copy",
        output_video
    ]
    await asyncio.get_event_loop().run_in_executor(
        None, lambda: run_ffmpeg(cmd, timeout=600)
    )
    return output_video


async def generate_thumbnail(video_path: str, output_path: str, time_offset: float = 1.0) -> str:
    """生成视频缩略图"""
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(time_offset),
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        output_path
    ]
    await asyncio.get_event_loop().run_in_executor(
        None, lambda: run_ffmpeg(cmd, timeout=30)
    )
    return output_path
