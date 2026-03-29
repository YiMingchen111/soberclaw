# SoberClaw - AI 视频批量切片系统

使用 AI 自动识别视频中的精彩内容，批量生成短视频切片，支持多样式字幕和配音合成。

## 功能特性

- **视频上传**：支持 MP4/MOV/AVI/MKV/WebM 等格式
- **AI 精彩识别**：Whisper 语音转录 + Claude AI 分析精彩片段
- **智能切片**：根据精彩度评分自动提取片段，支持按平台比例输出
- **多样式字幕**：6 种字幕样式（经典白字/卡拉OK/彩色渐变/简约条形/弹跳动画/霓虹发光）
- **配音合成**：集成 edge-tts，10+ 中英文音色，可调语速/音调
- **创作偏好**：支持预设目标平台、关键词、内容类型等偏好

## 技术栈

| 层      | 技术                                        |
|--------|---------------------------------------------|
| 后端    | Python 3.11 + FastAPI + Uvicorn             |
| AI 转录 | OpenAI Whisper (base model)                 |
| AI 分析 | Anthropic Claude claude-opus-4-6                  |
| 视频处理 | FFmpeg                                     |
| TTS 配音 | Microsoft Edge TTS (edge-tts)              |
| 前端    | Next.js 14 + React 18 + TypeScript          |
| 样式    | Tailwind CSS + Framer Motion                |

## 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- FFmpeg（[安装指南](https://ffmpeg.org/download.html)）
- Anthropic API Key（[获取地址](https://console.anthropic.com/)）

### 本地启动

```bash
# 1. 克隆项目
git clone https://github.com/yimingchen111/soberclaw
cd soberclaw

# 2. 设置 API Key
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# 3. 一键启动
./start.sh
```

访问 http://localhost:3000

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env 填入 ANTHROPIC_API_KEY

docker-compose up -d
```

## 使用流程

```
上传视频 → AI 转录 + 分析 → 生成切片 → 选择导出
                                ↓
                    设置字幕样式 + 配音
```

1. **上传视频**：拖拽或点击上传，系统自动开始 AI 分析
2. **查看切片**：在「切片管理」页面查看所有精彩片段，可预览播放
3. **导出成片**：选择片段，配置字幕样式和配音后导出

## 配置偏好

在「创作偏好」页面可以配置：

- 内容类型（Vlog/知识/搞笑/情感等）
- 目标平台（抖音/快手/B站/Instagram等）
- 默认画幅比例
- AI 分析关键词
- 默认配音音色和语速

## 字幕样式说明

| 样式     | 效果说明                      |
|---------|-------------------------------|
| 经典白字 | 白色文字 + 黑色描边，通用性最强   |
| 卡拉OK   | 逐字高亮，适合歌词/口播朗读       |
| 彩色渐变 | 黄色渐变字体，时尚感强            |
| 简约条形 | 白底黑字，简洁专业                |
| 弹跳动画 | 字幕出现带弹跳缩放效果            |
| 霓虹发光 | 发光描边效果，适合科技/夜景内容    |

## API 文档

后端启动后访问：http://localhost:8000/api/docs
