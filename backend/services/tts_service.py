"""
TTS 配音服务：使用 edge-tts 生成语音
"""
import asyncio
import uuid
from pathlib import Path
from typing import Optional

import edge_tts

TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)


async def synthesize_speech(
    text: str,
    voice: str = "zh-CN-XiaoxiaoNeural",
    speed: float = 1.0,
    pitch: float = 0.0,
    output_path: Optional[str] = None,
) -> str:
    """
    生成语音文件
    :param text: 要合成的文字
    :param voice: 音色 ID（来自 edge-tts）
    :param speed: 语速，1.0 = 正常，>1 更快
    :param pitch: 音调调整（Hz），0 = 不变
    :param output_path: 输出路径，不指定则自动生成临时文件
    :return: 生成的音频文件路径
    """
    if not output_path:
        output_path = str(TEMP_DIR / f"tts_{uuid.uuid4()}.mp3")

    # edge-tts 使用百分比格式的语速/音调
    speed_str = f"+{int((speed - 1) * 100)}%" if speed >= 1 else f"{int((speed - 1) * 100)}%"
    pitch_str = f"+{int(pitch)}Hz" if pitch >= 0 else f"{int(pitch)}Hz"

    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=speed_str,
        pitch=pitch_str,
    )

    await communicate.save(output_path)
    return output_path


async def synthesize_segments(
    segments: list[dict],
    voice: str = "zh-CN-XiaoxiaoNeural",
    speed: float = 1.0,
    pitch: float = 0.0,
) -> str:
    """
    对多个字幕段落生成配音，并拼接为单个音频文件
    segments 格式：[{"start": 0.0, "end": 3.2, "text": "..."}, ...]
    """
    import subprocess
    import json

    if not segments:
        raise ValueError("No segments provided")

    full_text = " ".join(seg["text"] for seg in segments if seg.get("text"))
    output_path = str(TEMP_DIR / f"dubbing_{uuid.uuid4()}.mp3")

    return await synthesize_speech(
        text=full_text,
        voice=voice,
        speed=speed,
        pitch=pitch,
        output_path=output_path,
    )


async def list_voices(language: Optional[str] = None) -> list[dict]:
    """列出可用音色"""
    voices_manager = await edge_tts.VoicesManager.create()
    voices = voices_manager.voices

    if language:
        voices = [v for v in voices if v["Locale"].startswith(language)]

    return [
        {
            "id":     v["ShortName"],
            "name":   v["FriendlyName"],
            "gender": v["Gender"],
            "locale": v["Locale"],
        }
        for v in voices
    ]
