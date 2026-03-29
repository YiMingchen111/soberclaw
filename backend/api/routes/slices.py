"""
切片处理路由：AI分析、切片生成、导出
"""
import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from models.schemas import (
    AnalyzeRequest, AnalyzeResponse, ExportRequest,
    SliceJob, SliceStatus, SubtitleStyleConfig, SubtitleStyle,
)
from services import job_manager
from services.video_processor import (
    extract_audio, cut_video_segment, burn_subtitles,
    mix_dubbing, generate_thumbnail, OUTPUTS_DIR, TEMP_DIR,
)
from services.ai_analyzer import transcribe_audio, analyze_highlights, generate_subtitle_text
from services.tts_service import synthesize_segments

router = APIRouter(prefix="/slices", tags=["slices"])

# 存储分析结果
_analysis_cache: dict = {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(req: AnalyzeRequest):
    """
    Step 1: 分析视频，识别精彩片段
    使用 Whisper 转录 + Claude 分析
    """
    from api.routes.videos import get_video_path, get_video_store
    video_path = get_video_path(req.video_id)
    video_info = get_video_store()[req.video_id]
    total_duration = video_info["duration"]

    # 提取音频
    audio_path = str(TEMP_DIR / f"{req.video_id}_audio.wav")
    try:
        await extract_audio(video_path, audio_path)
    except Exception as e:
        raise HTTPException(500, f"音频提取失败: {e}")

    # 转录
    try:
        lang = req.slice_config.subtitle_language or "zh"
        segments = await transcribe_audio(audio_path, language=lang)
    except Exception as e:
        raise HTTPException(500, f"语音转录失败: {e}")
    finally:
        Path(audio_path).unlink(missing_ok=True)

    full_transcript = " ".join(s["text"] for s in segments)

    # AI 分析精彩片段
    try:
        highlights = await analyze_highlights(
            transcript_segments=segments,
            total_duration=total_duration,
            preferences=req.preferences,
            min_clip_duration=req.slice_config.min_duration,
            max_clip_duration=req.slice_config.max_duration,
            max_highlights=req.slice_config.max_slices,
        )
    except Exception as e:
        raise HTTPException(500, f"AI分析失败: {e}")

    # 过滤低分片段
    min_score = req.preferences.min_highlight_score if req.preferences else 0.0
    highlights = [h for h in highlights if h.score >= min_score]

    # 缓存分析结果
    _analysis_cache[req.video_id] = {
        "segments":   segments,
        "highlights": highlights,
        "config":     req.slice_config,
    }

    return AnalyzeResponse(
        video_id=req.video_id,
        total_duration=total_duration,
        highlights=highlights,
        full_transcript=full_transcript,
    )


@router.post("/create-job")
async def create_slice_job(
    video_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Step 2: 创建切片任务（基于已分析的结果）
    """
    if video_id not in _analysis_cache:
        raise HTTPException(400, "请先进行视频分析")

    job = await job_manager.create_job(video_id)
    cache = _analysis_cache[video_id]

    background_tasks.add_task(
        _process_slices,
        job.job_id,
        video_id,
        cache["segments"],
        cache["highlights"],
        cache["config"],
    )

    return {"job_id": job.job_id, "message": "切片任务已创建"}


@router.get("/jobs/{job_id}", response_model=SliceJob)
async def get_job_status(job_id: str):
    """查询任务状态"""
    job = await job_manager.get_job(job_id)
    if not job:
        raise HTTPException(404, "任务不存在")
    return job


@router.get("/jobs")
async def list_jobs(video_id: str = None):
    """列出所有任务"""
    return await job_manager.list_jobs(video_id)


@router.post("/export")
async def export_slices(req: ExportRequest, background_tasks: BackgroundTasks):
    """
    Step 3: 导出切片（添加字幕、配音、水印）
    """
    job = await job_manager.get_job(req.job_id)
    if not job:
        raise HTTPException(404, "任务不存在")
    if job.status != SliceStatus.DONE:
        raise HTTPException(400, f"任务尚未完成，当前状态：{job.status}")

    export_id = str(uuid.uuid4())[:8]
    results   = []

    for idx in req.slice_indices:
        if idx >= len(job.slices):
            continue
        slc = job.slices[idx]

        output_path = OUTPUTS_DIR / f"export_{export_id}_{idx}.mp4"

        # 字幕配置
        sub_cfg = req.subtitle_config or SubtitleStyleConfig(style=SubtitleStyle.CLASSIC)

        # 配音
        dubbing_path = None
        if req.add_dubbing and slc.get("subtitle_segments"):
            try:
                dubbing_path = await synthesize_segments(
                    segments=slc["subtitle_segments"],
                    voice=req.dubbing_voice,
                    speed=req.dubbing_speed,
                )
            except Exception:
                pass

        background_tasks.add_task(
            _export_single_slice,
            slc["path"],
            str(output_path),
            slc.get("subtitle_segments", []),
            sub_cfg,
            dubbing_path,
            req.keep_original_audio,
        )

        results.append({
            "index":       idx,
            "export_path": str(output_path),
            "export_id":   export_id,
        })

    return {"export_id": export_id, "results": results, "message": "导出任务已提交"}


@router.get("/download/{filename}")
async def download_slice(filename: str):
    """下载切片文件"""
    file_path = OUTPUTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(
        str(file_path),
        media_type="video/mp4",
        filename=filename,
    )


@router.get("/preview/{job_id}/{slice_index}")
async def preview_slice(job_id: str, slice_index: int):
    """预览切片"""
    job = await job_manager.get_job(job_id)
    if not job or slice_index >= len(job.slices):
        raise HTTPException(404, "切片不存在")
    slc_path = job.slices[slice_index].get("path")
    if not slc_path or not Path(slc_path).exists():
        raise HTTPException(404, "切片文件不存在")
    return FileResponse(slc_path, media_type="video/mp4")


@router.get("/thumbnail/{job_id}/{slice_index}")
async def slice_thumbnail(job_id: str, slice_index: int):
    """获取切片缩略图"""
    job = await job_manager.get_job(job_id)
    if not job or slice_index >= len(job.slices):
        raise HTTPException(404, "切片不存在")
    thumb_path = job.slices[slice_index].get("thumbnail")
    if not thumb_path or not Path(thumb_path).exists():
        raise HTTPException(404, "缩略图不存在")
    return FileResponse(thumb_path, media_type="image/jpeg")


# ── 后台处理函数 ────────────────────────────────────────────────────────────

async def _process_slices(
    job_id: str,
    video_id: str,
    transcript_segments: list,
    highlights: list,
    config,
):
    """后台切片处理"""
    from api.routes.videos import get_video_store
    video_path = get_video_store()[video_id]["path"]
    video_info = get_video_store()[video_id]

    await job_manager.update_job(job_id, status=SliceStatus.PROCESSING, progress=0)

    slices   = []
    total    = len(highlights)
    job_dir  = OUTPUTS_DIR / job_id
    job_dir.mkdir(exist_ok=True)

    for i, highlight in enumerate(highlights):
        try:
            start = max(0, highlight.start - config.overlap_seconds)
            end   = min(video_info["duration"], highlight.end + config.overlap_seconds)

            # 切片输出路径
            slice_path = job_dir / f"slice_{i:02d}.mp4"
            thumb_path = job_dir / f"thumb_{i:02d}.jpg"

            # 切割视频
            await cut_video_segment(
                input_path=video_path,
                output_path=str(slice_path),
                start=start,
                end=end,
                aspect_ratio=config.aspect_ratio,
                resolution=config.output_resolution,
                fps=config.output_fps,
                bitrate=config.video_bitrate,
            )

            # 生成缩略图
            try:
                await generate_thumbnail(str(slice_path), str(thumb_path))
            except Exception:
                pass

            # 提取字幕片段
            subtitle_segs = await generate_subtitle_text(
                transcript_segments, start, end
            )

            slices.append({
                "index":             i,
                "path":              str(slice_path),
                "thumbnail":         str(thumb_path) if thumb_path.exists() else None,
                "start":             start,
                "end":               end,
                "duration":          round(end - start, 2),
                "score":             highlight.score,
                "reason":            highlight.reason,
                "transcript":        highlight.transcript,
                "subtitle_segments": subtitle_segs,
            })

            progress = int((i + 1) / total * 100)
            await job_manager.update_job(job_id, progress=progress, slices=slices)

        except Exception as e:
            await job_manager.update_job(
                job_id,
                status=SliceStatus.FAILED,
                error=f"切片 {i} 处理失败: {e}",
            )
            return

    await job_manager.update_job(
        job_id,
        status=SliceStatus.DONE,
        progress=100,
        slices=slices,
    )


async def _export_single_slice(
    input_path: str,
    output_path: str,
    subtitle_segments: list,
    sub_cfg: SubtitleStyleConfig,
    dubbing_path: str | None,
    keep_original_audio: bool,
):
    """后台导出单个切片（烧录字幕 + 混音）"""
    current = input_path
    temp_files = []

    try:
        # Step 1: 烧录字幕
        if subtitle_segments and sub_cfg:
            sub_out = output_path.replace(".mp4", "_sub.mp4")
            await burn_subtitles(
                input_video=current,
                output_video=sub_out,
                subtitle_segments=subtitle_segments,
                cfg=sub_cfg,
            )
            temp_files.append(sub_out)
            current = sub_out

        # Step 2: 混入配音
        if dubbing_path and Path(dubbing_path).exists():
            dub_out = output_path.replace(".mp4", "_dub.mp4")
            await mix_dubbing(
                input_video=current,
                output_video=dub_out,
                dubbing_audio=dubbing_path,
                keep_original=keep_original_audio,
            )
            temp_files.append(dub_out)
            current = dub_out

        # 最终输出
        import shutil
        shutil.copy2(current, output_path)

    finally:
        # 清理中间文件（保留最终输出）
        for f in temp_files:
            if f != output_path:
                Path(f).unlink(missing_ok=True)
        if dubbing_path:
            Path(dubbing_path).unlink(missing_ok=True)
