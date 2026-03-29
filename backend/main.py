"""
视频批量切片系统 - FastAPI 后端入口
"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import videos, slices, preferences

# 创建必要目录
for d in ["uploads", "outputs", "temp"]:
    Path(d).mkdir(exist_ok=True)

app = FastAPI(
    title="视频批量切片系统",
    description="使用 AI 自动识别精彩内容，生成短视频切片，支持多样式字幕和配音",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(videos.router, prefix="/api")
app.include_router(slices.router, prefix="/api")
app.include_router(preferences.router, prefix="/api")

# 静态文件（切片输出）
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/health")
async def health():
    from services.ai_analyzer import get_active_provider
    provider = get_active_provider()
    return {
        "status": "ok",
        "version": "1.0.0",
        "ai_provider": provider,
        "features": {
            "whisper":  True,
            "ai":       provider != "none",
            "edge_tts": True,
            "ffmpeg":   True,
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
