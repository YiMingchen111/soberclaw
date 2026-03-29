"""
视频管理路由：上传、查询、删除
"""
import asyncio
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from services.video_processor import get_video_info, generate_thumbnail, UPLOADS_DIR, OUTPUTS_DIR
from models.schemas import VideoUploadResponse

router = APIRouter(prefix="/videos", tags=["videos"])

# 内存存储视频元信息（生产环境用数据库）
_video_store: dict = {}

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv"}


@router.post("/upload", response_model=VideoUploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """上传视频文件"""
    suffix = Path(file.filename or "video.mp4").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的格式: {suffix}，支持：{ALLOWED_EXTENSIONS}")

    video_id  = str(uuid.uuid4())
    save_path = UPLOADS_DIR / f"{video_id}{suffix}"

    # 保存文件
    with open(save_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            f.write(chunk)

    # 获取视频信息
    try:
        info = await get_video_info(str(save_path))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(400, f"无法读取视频信息: {e}")

    # 生成缩略图
    thumb_path = UPLOADS_DIR / f"{video_id}_thumb.jpg"
    try:
        await generate_thumbnail(str(save_path), str(thumb_path))
    except Exception:
        pass  # 缩略图失败不影响上传

    _video_store[video_id] = {
        "video_id":  video_id,
        "filename":  file.filename,
        "path":      str(save_path),
        "thumb":     str(thumb_path) if thumb_path.exists() else None,
        **info,
    }

    return VideoUploadResponse(
        video_id=video_id,
        filename=file.filename or "video",
        duration=info["duration"],
        size_mb=info["size_mb"],
        message="上传成功",
    )


@router.get("/")
async def list_videos():
    """列出所有已上传的视频"""
    return list(_video_store.values())


@router.get("/{video_id}")
async def get_video(video_id: str):
    """获取视频元信息"""
    if video_id not in _video_store:
        raise HTTPException(404, "视频不存在")
    return _video_store[video_id]


@router.get("/{video_id}/thumbnail")
async def get_thumbnail(video_id: str):
    """获取视频缩略图"""
    if video_id not in _video_store:
        raise HTTPException(404, "视频不存在")
    thumb = _video_store[video_id].get("thumb")
    if not thumb or not Path(thumb).exists():
        raise HTTPException(404, "缩略图不存在")
    return FileResponse(thumb, media_type="image/jpeg")


@router.get("/{video_id}/stream")
async def stream_video(video_id: str):
    """流式播放视频"""
    if video_id not in _video_store:
        raise HTTPException(404, "视频不存在")
    video_path = _video_store[video_id]["path"]
    if not Path(video_path).exists():
        raise HTTPException(404, "视频文件不存在")
    return FileResponse(video_path, media_type="video/mp4")


@router.delete("/{video_id}")
async def delete_video(video_id: str):
    """删除视频"""
    if video_id not in _video_store:
        raise HTTPException(404, "视频不存在")
    info = _video_store.pop(video_id)
    Path(info["path"]).unlink(missing_ok=True)
    if info.get("thumb"):
        Path(info["thumb"]).unlink(missing_ok=True)
    return {"message": "已删除"}


def get_video_path(video_id: str) -> str:
    """内部使用：获取视频文件路径"""
    info = _video_store.get(video_id)
    if not info:
        raise HTTPException(404, "视频不存在")
    return info["path"]


def get_video_store():
    return _video_store
