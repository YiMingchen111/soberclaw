"""
AI 分析服务：使用 Whisper 转录 + Claude 识别精彩片段
"""
import asyncio
import json
import os
import re
from pathlib import Path
from typing import List, Optional

import anthropic

from models.schemas import HighlightSegment, CreatorPreferences


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


async def transcribe_audio(audio_path: str, language: str = "zh") -> List[dict]:
    """
    使用 Whisper 转录音频，返回带时间戳的片段列表
    返回格式: [{"start": 0.0, "end": 3.2, "text": "..."}, ...]
    """
    import whisper

    loop = asyncio.get_event_loop()
    model = await loop.run_in_executor(None, lambda: whisper.load_model("base"))

    result = await loop.run_in_executor(
        None,
        lambda: model.transcribe(
            audio_path,
            language=language,
            word_timestamps=False,
            verbose=False,
        )
    )

    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": round(seg["start"], 2),
            "end":   round(seg["end"], 2),
            "text":  seg["text"].strip(),
        })

    return segments


async def analyze_highlights(
    transcript_segments: List[dict],
    total_duration: float,
    preferences: Optional[CreatorPreferences],
    min_clip_duration: float = 15.0,
    max_clip_duration: float = 60.0,
    max_highlights: int = 5,
) -> List[HighlightSegment]:
    """
    使用 Claude 分析转录文本，识别精彩片段
    """
    if not ANTHROPIC_API_KEY:
        return _fallback_segment_split(
            transcript_segments, total_duration,
            min_clip_duration, max_clip_duration, max_highlights
        )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # 构建转录文本（附带时间戳）
    transcript_text = "\n".join(
        f"[{seg['start']:.1f}s - {seg['end']:.1f}s] {seg['text']}"
        for seg in transcript_segments
    )

    # 构建偏好上下文
    pref_context = ""
    if preferences:
        keywords = "、".join(preferences.highlight_keywords) if preferences.highlight_keywords else "无"
        pref_context = f"""
创作偏好：
- 内容类型：{preferences.category.value}
- 目标平台：{', '.join(preferences.target_platform)}
- 关键词重点关注：{keywords}
- 精彩度阈值：{preferences.min_highlight_score}
"""

    prompt = f"""你是一位专业的短视频剪辑师，请分析以下视频转录文字，识别出最精彩、最适合做短视频的片段。

视频总时长：{total_duration:.1f}秒
{pref_context}

转录内容（格式：[开始时间 - 结束时间] 文字）：
{transcript_text}

请选取 {max_highlights} 个最精彩的片段，每个片段时长应在 {min_clip_duration} 到 {max_clip_duration} 秒之间。

选片标准（按优先级排序）：
1. 情感爆发点（笑声、惊叹、感动、冲突）
2. 信息密度高的干货内容
3. 故事完整性（有起承转合）
4. 视觉冲击力（动作密集）
5. 语言表达精彩（金句、段子）

请以 JSON 格式返回，格式如下：
{{
  "highlights": [
    {{
      "start": 开始时间(秒，数字),
      "end": 结束时间(秒，数字),
      "score": 精彩度评分(0.0-1.0),
      "reason": "选取原因（中文，15字以内）",
      "transcript": "该片段的主要文字内容"
    }}
  ]
}}

重要要求：
- start 和 end 必须是视频中存在的时间戳
- 片段之间尽量不重叠
- score 要根据内容质量客观评分
- 只返回 JSON，不要其他文字"""

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
    )

    raw_text = response.content[0].text.strip()

    # 提取 JSON（可能包含 markdown 代码块）
    json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if not json_match:
        return _fallback_segment_split(
            transcript_segments, total_duration,
            min_clip_duration, max_clip_duration, max_highlights
        )

    data = json.loads(json_match.group())
    highlights = []
    for h in data.get("highlights", []):
        highlights.append(HighlightSegment(
            start=float(h["start"]),
            end=float(h["end"]),
            score=float(h.get("score", 0.7)),
            reason=h.get("reason", "AI推荐"),
            transcript=h.get("transcript", ""),
        ))

    return highlights


def _fallback_segment_split(
    segments: List[dict],
    total_duration: float,
    min_duration: float,
    max_duration: float,
    max_count: int,
) -> List[HighlightSegment]:
    """当没有 API Key 时的兜底方案：均匀切割"""
    if not segments:
        # 完全均匀切割
        step = min(max_duration, total_duration / max_count)
        results = []
        for i in range(max_count):
            start = i * step
            end = min(start + step, total_duration)
            if end - start < min_duration:
                break
            results.append(HighlightSegment(
                start=start, end=end,
                score=0.5,
                reason="均匀切割（无API Key）",
                transcript="",
            ))
        return results

    # 按 transcript segment 切割
    results = []
    current_start = None
    current_texts = []
    current_duration = 0.0

    for seg in segments:
        if current_start is None:
            current_start = seg["start"]

        seg_dur = seg["end"] - seg["start"]
        current_duration += seg_dur
        current_texts.append(seg["text"])

        if current_duration >= min_duration:
            results.append(HighlightSegment(
                start=current_start,
                end=seg["end"],
                score=0.6,
                reason="自动切割",
                transcript=" ".join(current_texts),
            ))
            if len(results) >= max_count:
                break
            current_start = None
            current_texts = []
            current_duration = 0.0

    return results


async def generate_subtitle_text(
    transcript_segments: List[dict],
    clip_start: float,
    clip_end: float,
) -> List[dict]:
    """
    从转录数据中提取指定时间范围内的字幕
    返回相对时间（相对于切片起始点）
    """
    subtitle_segs = []
    for seg in transcript_segments:
        # 找出与切片有交集的 segment
        seg_start = seg["start"]
        seg_end   = seg["end"]

        if seg_end <= clip_start or seg_start >= clip_end:
            continue

        # 裁剪到切片范围，转为相对时间
        rel_start = max(seg_start, clip_start) - clip_start
        rel_end   = min(seg_end, clip_end) - clip_start
        text      = seg["text"].strip()

        if text and rel_end > rel_start:
            subtitle_segs.append({
                "start": round(rel_start, 2),
                "end":   round(rel_end, 2),
                "text":  text,
            })

    return subtitle_segs
