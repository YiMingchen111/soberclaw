"""
轻量级环形日志缓冲区
后端各服务调用 log() 写入，前端通过 /api/logs 轮询读取
"""
from collections import deque
from datetime import datetime, timezone
from typing import List

_BUFFER: deque = deque(maxlen=200)


def log(level: str, message: str) -> None:
    """写入一条日志（level: info / warn / error）"""
    entry = {
        "ts":      datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "level":   level,
        "message": message,
    }
    _BUFFER.append(entry)


def get_logs(since: int = 0) -> List[dict]:
    """返回索引 >= since 的日志条目列表"""
    all_logs = list(_BUFFER)
    return all_logs[since:]


def clear_logs() -> None:
    _BUFFER.clear()
