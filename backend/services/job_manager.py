"""
任务管理器：内存中存储切片任务状态
（生产环境可替换为 Redis/数据库）
"""
import asyncio
import uuid
from typing import Dict, Optional
from models.schemas import SliceJob, SliceStatus


_jobs: Dict[str, SliceJob] = {}
_lock = asyncio.Lock()


async def create_job(video_id: str) -> SliceJob:
    job = SliceJob(
        job_id=str(uuid.uuid4()),
        video_id=video_id,
        status=SliceStatus.PENDING,
    )
    async with _lock:
        _jobs[job.job_id] = job
    return job


async def get_job(job_id: str) -> Optional[SliceJob]:
    return _jobs.get(job_id)


async def update_job(job_id: str, **kwargs) -> Optional[SliceJob]:
    async with _lock:
        job = _jobs.get(job_id)
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
    return job


async def list_jobs(video_id: Optional[str] = None) -> list[SliceJob]:
    jobs = list(_jobs.values())
    if video_id:
        jobs = [j for j in jobs if j.video_id == video_id]
    return jobs


async def delete_job(job_id: str) -> bool:
    async with _lock:
        if job_id in _jobs:
            del _jobs[job_id]
            return True
    return False
