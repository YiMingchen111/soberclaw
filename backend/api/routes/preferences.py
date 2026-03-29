"""
用户偏好设置路由
"""
from fastapi import APIRouter
from models.schemas import CreatorPreferences, SliceConfig, AVAILABLE_VOICES

router = APIRouter(prefix="/preferences", tags=["preferences"])

# 内存存储（生产环境用数据库/用户系统）
_preferences = CreatorPreferences()
_slice_config = SliceConfig()


@router.get("/creator", response_model=CreatorPreferences)
async def get_creator_preferences():
    """获取创作偏好"""
    return _preferences


@router.put("/creator", response_model=CreatorPreferences)
async def update_creator_preferences(prefs: CreatorPreferences):
    """更新创作偏好"""
    global _preferences
    _preferences = prefs
    return _preferences


@router.get("/slice-config", response_model=SliceConfig)
async def get_slice_config():
    """获取切片参数"""
    return _slice_config


@router.put("/slice-config", response_model=SliceConfig)
async def update_slice_config(config: SliceConfig):
    """更新切片参数"""
    global _slice_config
    _slice_config = config
    return _slice_config


@router.get("/voices")
async def list_voices():
    """获取可用音色列表"""
    return AVAILABLE_VOICES


@router.get("/subtitle-styles")
async def list_subtitle_styles():
    """获取字幕样式列表"""
    return [
        {
            "id":      "classic",
            "name":    "经典白字",
            "desc":    "白色文字 + 黑色描边，最通用的样式",
            "preview": "classic",
        },
        {
            "id":      "karaoke",
            "name":    "卡拉OK",
            "desc":    "逐字高亮显示，适合歌词/朗读",
            "preview": "karaoke",
        },
        {
            "id":      "gradient",
            "name":    "彩色渐变",
            "desc":    "黄色渐变字体，时尚感强",
            "preview": "gradient",
        },
        {
            "id":      "minimal",
            "name":    "简约条形",
            "desc":    "白色背景条 + 黑字，简洁专业",
            "preview": "minimal",
        },
        {
            "id":      "bounce",
            "name":    "弹跳动画",
            "desc":    "字幕出现时有缩放弹跳效果",
            "preview": "bounce",
        },
        {
            "id":      "neon",
            "name":    "霓虹发光",
            "desc":    "带发光效果，适合夜景/科技感视频",
            "preview": "neon",
        },
    ]


@router.get("/platforms")
async def list_platforms():
    """获取支持的平台及推荐参数"""
    return [
        {
            "id":          "douyin",
            "name":        "抖音",
            "aspect_ratio": "9:16",
            "resolution":  "1080x1920",
            "fps":         30,
            "duration":    "15-60",
        },
        {
            "id":          "kuaishou",
            "name":        "快手",
            "aspect_ratio": "9:16",
            "resolution":  "1080x1920",
            "fps":         30,
            "duration":    "15-60",
        },
        {
            "id":          "bilibili",
            "name":        "哔哩哔哩",
            "aspect_ratio": "16:9",
            "resolution":  "1920x1080",
            "fps":         30,
            "duration":    "60-300",
        },
        {
            "id":          "instagram",
            "name":        "Instagram Reels",
            "aspect_ratio": "9:16",
            "resolution":  "1080x1920",
            "fps":         30,
            "duration":    "15-90",
        },
        {
            "id":          "youtube",
            "name":        "YouTube Shorts",
            "aspect_ratio": "9:16",
            "resolution":  "1080x1920",
            "fps":         30,
            "duration":    "15-60",
        },
        {
            "id":          "weibo",
            "name":        "微博",
            "aspect_ratio": "1:1",
            "resolution":  "1080x1080",
            "fps":         30,
            "duration":    "15-120",
        },
    ]
