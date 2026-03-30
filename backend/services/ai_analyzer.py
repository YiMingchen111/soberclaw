"""
AI 分析服务：使用 Whisper 转录 + 多种 AI 大模型识别精彩片段

支持的 AI 提供商（通过环境变量配置）：
  - Claude (Anthropic):  ANTHROPIC_API_KEY=sk-ant-...
  - 豆包 (火山引擎):      DOUBAO_API_KEY=xxx  +  DOUBAO_MODEL=ep-xxx（端点ID）
  - OpenAI / 兼容接口:   OPENAI_API_KEY=sk-...  +  OPENAI_BASE_URL（可选）
  - 通义千问 (阿里云):    DASHSCOPE_API_KEY=sk-...
  - 文心一言 (百度):      QIANFAN_API_KEY=...  +  QIANFAN_SECRET_KEY=...（暂通过 OpenAI 兼容）
"""
import asyncio
import json
import os
import re
from typing import List, Optional

from models.schemas import HighlightSegment, CreatorPreferences

# ── 读取环境变量 ────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

DOUBAO_API_KEY    = os.getenv("DOUBAO_API_KEY", "bdd9d222-bd02-4165-bf3f-b364a8671cb9")
DOUBAO_MODEL      = os.getenv("DOUBAO_MODEL", "ep-20260329153141-vnw6w")
DOUBAO_BASE_URL   = "https://ark.cn-beijing.volces.com/api/v3"

OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL   = os.getenv("OPENAI_BASE_URL", "")        # 自定义时填写，否则用官方
OPENAI_MODEL      = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")      # 通义千问
DASHSCOPE_MODEL   = os.getenv("DASHSCOPE_MODEL", "qwen-plus")


def get_active_provider() -> str:
    """返回当前激活的 AI 提供商名称（豆包优先）"""
    if DOUBAO_API_KEY and DOUBAO_MODEL:
        return "doubao"
    if ANTHROPIC_API_KEY:
        return "claude"
    if DASHSCOPE_API_KEY:
        return "qwen"
    if OPENAI_API_KEY:
        return "openai"
    return "none"


# ── 转录 ────────────────────────────────────────────────────────────────────

async def transcribe_audio(audio_path: str, language: str = "zh") -> List[dict]:
    """使用 Whisper 转录音频，返回带时间戳的片段列表"""
    import whisper

    loop = asyncio.get_event_loop()
    model = await loop.run_in_executor(None, lambda: whisper.load_model("base"))
    result = await loop.run_in_executor(
        None,
        lambda: model.transcribe(audio_path, language=language,
                                  word_timestamps=False, verbose=False)
    )
    return [
        {"start": round(s["start"], 2), "end": round(s["end"], 2), "text": s["text"].strip()}
        for s in result.get("segments", [])
    ]


# ── 精彩片段分析 ─────────────────────────────────────────────────────────────

async def analyze_highlights(
    transcript_segments: List[dict],
    total_duration: float,
    preferences: Optional[CreatorPreferences],
    min_clip_duration: float = 15.0,
    max_clip_duration: float = 60.0,
    max_highlights: int = 5,
) -> List[HighlightSegment]:
    """调用 AI 分析转录文本，识别精彩片段"""

    provider = get_active_provider()

    if provider == "none":
        return _fallback_segment_split(
            transcript_segments, total_duration,
            min_clip_duration, max_clip_duration, max_highlights
        )

    prompt = _build_prompt(
        transcript_segments, total_duration, preferences,
        min_clip_duration, max_clip_duration, max_highlights
    )

    try:
        if provider == "claude":
            raw = await _call_claude(prompt)
        elif provider == "doubao":
            raw = await _call_openai_compatible(
                prompt,
                api_key=DOUBAO_API_KEY,
                base_url=DOUBAO_BASE_URL,
                model=DOUBAO_MODEL,
            )
        elif provider == "qwen":
            raw = await _call_openai_compatible(
                prompt,
                api_key=DASHSCOPE_API_KEY,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                model=DASHSCOPE_MODEL,
            )
        elif provider == "openai":
            raw = await _call_openai_compatible(
                prompt,
                api_key=OPENAI_API_KEY,
                base_url=OPENAI_BASE_URL or None,
                model=OPENAI_MODEL,
            )
        else:
            raw = ""
    except Exception as e:
        print(f"[AI] {provider} 调用失败: {e}，降级为均匀切割")
        return _fallback_segment_split(
            transcript_segments, total_duration,
            min_clip_duration, max_clip_duration, max_highlights
        )

    return _parse_highlights(raw) or _fallback_segment_split(
        transcript_segments, total_duration,
        min_clip_duration, max_clip_duration, max_highlights
    )


# ── 各 Provider 调用实现 ─────────────────────────────────────────────────────

async def _call_claude(prompt: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
    )
    return response.content[0].text.strip()


async def _call_openai_compatible(
    prompt: str,
    api_key: str,
    model: str,
    base_url: str | None = None,
) -> str:
    """
    通用 OpenAI 兼容接口调用
    豆包、通义千问、DeepSeek、Kimi 等都支持此格式
    """
    from openai import AsyncOpenAI

    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url

    client = AsyncOpenAI(**kwargs)
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
    )
    return response.choices[0].message.content.strip()


# ── Prompt 构建 ──────────────────────────────────────────────────────────────

def _build_prompt(
    transcript_segments: List[dict],
    total_duration: float,
    preferences: Optional[CreatorPreferences],
    min_clip_duration: float,
    max_clip_duration: float,
    max_highlights: int,
) -> str:
    transcript_text = "\n".join(
        f"[{s['start']:.1f}s - {s['end']:.1f}s] {s['text']}"
        for s in transcript_segments
    )

    pref_context = ""
    if preferences:
        keywords = "、".join(preferences.highlight_keywords) if preferences.highlight_keywords else "无"
        pref_context = (
            f"\n创作偏好：\n"
            f"- 内容类型：{preferences.category.value}\n"
            f"- 目标平台：{', '.join(preferences.target_platform)}\n"
            f"- 关键词重点关注：{keywords}\n"
            f"- 精彩度阈值：{preferences.min_highlight_score}\n"
        )

    return f"""你是一位专业的短视频剪辑师，请分析以下视频转录文字，识别出最精彩、最适合做短视频的片段。

视频总时长：{total_duration:.1f}秒{pref_context}

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


def _parse_highlights(raw: str) -> List[HighlightSegment]:
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        return []
    try:
        data = json.loads(json_match.group())
        return [
            HighlightSegment(
                start=float(h["start"]),
                end=float(h["end"]),
                score=float(h.get("score", 0.7)),
                reason=h.get("reason", "AI推荐"),
                transcript=h.get("transcript", ""),
            )
            for h in data.get("highlights", [])
        ]
    except Exception:
        return []


# ── 兜底方案 ─────────────────────────────────────────────────────────────────

def _fallback_segment_split(
    segments: List[dict],
    total_duration: float,
    min_duration: float,
    max_duration: float,
    max_count: int,
) -> List[HighlightSegment]:
    """未配置任何 API Key 时的兜底：按语音段落均匀切割"""
    if not segments:
        step = min(max_duration, total_duration / max(max_count, 1))
        results = []
        for i in range(max_count):
            start = i * step
            end = min(start + step, total_duration)
            if end - start < min_duration:
                break
            results.append(HighlightSegment(
                start=start, end=end, score=0.5,
                reason="均匀切割（未配置AI）", transcript="",
            ))
        return results

    results, current_start, current_texts, current_dur = [], None, [], 0.0
    for seg in segments:
        if current_start is None:
            current_start = seg["start"]
        current_dur += seg["end"] - seg["start"]
        current_texts.append(seg["text"])
        if current_dur >= min_duration:
            results.append(HighlightSegment(
                start=current_start, end=seg["end"], score=0.6,
                reason="自动切割", transcript=" ".join(current_texts),
            ))
            if len(results) >= max_count:
                break
            current_start, current_texts, current_dur = None, [], 0.0
    return results


# ── 字幕提取 ─────────────────────────────────────────────────────────────────

async def generate_subtitle_text(
    transcript_segments: List[dict],
    clip_start: float,
    clip_end: float,
) -> List[dict]:
    """从转录数据中提取指定时间范围内的字幕（转为相对时间）"""
    result = []
    for seg in transcript_segments:
        if seg["end"] <= clip_start or seg["start"] >= clip_end:
            continue
        rel_start = round(max(seg["start"], clip_start) - clip_start, 2)
        rel_end   = round(min(seg["end"],   clip_end)   - clip_start, 2)
        text = seg["text"].strip()
        if text and rel_end > rel_start:
            result.append({"start": rel_start, "end": rel_end, "text": text})
    return result
