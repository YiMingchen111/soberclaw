"""
AI 分析服务：使用 Whisper 转录 + 多种 AI 大模型识别精彩片段
Whisper 为可选依赖，未安装时自动跳过转录直接用 AI 分段
"""
import asyncio
import json
import logging
import os
import re
from typing import List, Optional

import httpx

from models.schemas import HighlightSegment, CreatorPreferences
from utils.log_buffer import log

logger = logging.getLogger(__name__)

# ── 环境变量 ────────────────────────────────────────────────
DOUBAO_API_KEY  = os.getenv("DOUBAO_API_KEY",  "bdd9d222-bd02-4165-bf3f-b364a8671cb9")
DOUBAO_MODEL    = os.getenv("DOUBAO_MODEL",    "ep-20260329153141-vnw6w")
DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY",    "")
OPENAI_BASE_URL   = os.getenv("OPENAI_BASE_URL",   "")
OPENAI_MODEL      = os.getenv("OPENAI_MODEL",      "gpt-4o-mini")
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_MODEL   = os.getenv("DASHSCOPE_MODEL",   "qwen-plus")


def get_active_provider() -> str:
    if DOUBAO_API_KEY and DOUBAO_MODEL:
        return "doubao"
    if ANTHROPIC_API_KEY:
        return "claude"
    if DASHSCOPE_API_KEY:
        return "qwen"
    if OPENAI_API_KEY:
        return "openai"
    return "none"


# ── 转录（Whisper 可选）──────────────────────────────────────

async def transcribe_audio(audio_path: str, language: str = "zh") -> List[dict]:
    """Whisper 转录，未安装则返回空列表（AI 将基于时长均匀分析）"""
    try:
        import whisper  # noqa: PLC0415
    except ImportError:
        log("warn", "Whisper 未安装，跳过语音转录，将使用 AI 均匀分段")
        logger.warning("openai-whisper not installed, skipping transcription")
        return []

    log("info", f"Whisper 开始转录（语言: {language}）...")
    loop = asyncio.get_event_loop()
    try:
        model = await loop.run_in_executor(None, lambda: whisper.load_model("base"))
        result = await loop.run_in_executor(
            None,
            lambda: model.transcribe(audio_path, language=language,
                                     word_timestamps=False, verbose=False)
        )
        segments = [
            {"start": round(s["start"], 2), "end": round(s["end"], 2),
             "text": s["text"].strip()}
            for s in result.get("segments", [])
        ]
        log("info", f"转录完成，共 {len(segments)} 个片段")
        return segments
    except Exception as e:
        log("error", f"Whisper 转录出错: {e}")
        logger.exception("Whisper transcription failed")
        return []


# ── 精彩片段分析 ─────────────────────────────────────────────

async def analyze_highlights(
    transcript_segments: List[dict],
    total_duration: float,
    preferences: Optional[CreatorPreferences],
    min_clip_duration: float = 15.0,
    max_clip_duration: float = 60.0,
    max_highlights: int = 5,
) -> List[HighlightSegment]:
    provider = get_active_provider()
    log("info", f"AI 提供商: {provider}，视频时长: {total_duration:.1f}s")

    if provider == "none":
        log("warn", "未配置 AI API Key，使用均匀切割")
        return _fallback_segment_split(transcript_segments, total_duration,
                                       min_clip_duration, max_clip_duration, max_highlights)

    prompt = _build_prompt(transcript_segments, total_duration, preferences,
                           min_clip_duration, max_clip_duration, max_highlights)
    try:
        log("info", f"调用 {provider} 分析精彩片段...")
        if provider == "doubao":
            raw = await _call_openai_compat(prompt, DOUBAO_API_KEY, DOUBAO_BASE_URL, DOUBAO_MODEL)
        elif provider == "claude":
            raw = await _call_claude(prompt)
        elif provider == "qwen":
            raw = await _call_openai_compat(
                prompt, DASHSCOPE_API_KEY,
                "https://dashscope.aliyuncs.com/compatible-mode/v1", DASHSCOPE_MODEL)
        else:
            raw = await _call_openai_compat(
                prompt, OPENAI_API_KEY, OPENAI_BASE_URL or None, OPENAI_MODEL)

        highlights = _parse_highlights(raw)
        log("info", f"AI 识别出 {len(highlights)} 个精彩片段")
        return highlights or _fallback_segment_split(
            transcript_segments, total_duration,
            min_clip_duration, max_clip_duration, max_highlights)

    except Exception as e:
        log("error", f"{provider} 调用失败: {e}")
        logger.exception(f"{provider} API call failed")
        return _fallback_segment_split(transcript_segments, total_duration,
                                       min_clip_duration, max_clip_duration, max_highlights)


# ── Provider 实现（统一用 httpx，避免 SDK 兼容问题）────────────

async def _call_openai_compat(
    prompt: str, api_key: str, base_url: str | None, model: str
) -> str:
    """通用 OpenAI 兼容接口（豆包/通义/DeepSeek 等）"""
    url = (base_url.rstrip("/") if base_url else "https://api.openai.com") + "/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        log("info", f"POST {url}  model={model}")
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            log("error", f"API 返回 {resp.status_code}: {resp.text[:300]}")
            raise RuntimeError(f"API {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def _call_claude(prompt: str) -> str:
    import anthropic  # noqa: PLC0415
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-opus-4-6", max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
    )
    return response.content[0].text.strip()


# ── Prompt ───────────────────────────────────────────────────

def _build_prompt(
    segments: List[dict], duration: float,
    prefs: Optional[CreatorPreferences],
    min_dur: float, max_dur: float, max_n: int,
) -> str:
    transcript = "\n".join(
        f"[{s['start']:.1f}s-{s['end']:.1f}s] {s['text']}" for s in segments
    ) or f"（无转录文本，视频总时长 {duration:.1f} 秒，请按时间均匀选取片段）"

    pref_ctx = ""
    if prefs:
        kws = "、".join(prefs.highlight_keywords) if prefs.highlight_keywords else "无"
        pref_ctx = (f"\n创作偏好: 类型={prefs.category.value}"
                    f" 平台={','.join(prefs.target_platform)} 关键词={kws}")

    return f"""你是专业短视频剪辑师，分析以下视频内容，选出最精彩的片段。
视频时长: {duration:.1f}秒{pref_ctx}

转录内容:
{transcript}

请选 {max_n} 个精彩片段，每段时长 {min_dur}~{max_dur} 秒。
选片优先级: 情感爆发点 > 干货密集 > 故事完整 > 金句段子

只返回 JSON，格式:
{{"highlights":[{{"start":0.0,"end":30.0,"score":0.9,"reason":"原因15字内","transcript":"片段文字"}}]}}"""


def _parse_highlights(raw: str) -> List[HighlightSegment]:
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if not m:
        return []
    try:
        data = json.loads(m.group())
        return [
            HighlightSegment(
                start=float(h["start"]), end=float(h["end"]),
                score=float(h.get("score", 0.7)),
                reason=h.get("reason", "AI推荐"),
                transcript=h.get("transcript", ""),
            )
            for h in data.get("highlights", [])
        ]
    except Exception:
        return []


# ── 兜底均匀切割 ──────────────────────────────────────────────

def _fallback_segment_split(
    segments: List[dict], duration: float,
    min_dur: float, max_dur: float, max_n: int,
) -> List[HighlightSegment]:
    if not segments:
        step = min(max_dur, duration / max(max_n, 1))
        results = []
        for i in range(max_n):
            s, e = i * step, min((i + 1) * step, duration)
            if e - s >= min_dur:
                results.append(HighlightSegment(
                    start=s, end=e, score=0.5,
                    reason="均匀切割", transcript=""))
        return results

    results, cur_start, cur_texts, cur_dur = [], None, [], 0.0
    for seg in segments:
        if cur_start is None:
            cur_start = seg["start"]
        cur_dur += seg["end"] - seg["start"]
        cur_texts.append(seg["text"])
        if cur_dur >= min_dur:
            results.append(HighlightSegment(
                start=cur_start, end=seg["end"], score=0.6,
                reason="自动切割", transcript=" ".join(cur_texts)))
            if len(results) >= max_n:
                break
            cur_start, cur_texts, cur_dur = None, [], 0.0
    return results


# ── 字幕提取 ──────────────────────────────────────────────────

async def generate_subtitle_text(
    transcript_segments: List[dict], clip_start: float, clip_end: float,
) -> List[dict]:
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
