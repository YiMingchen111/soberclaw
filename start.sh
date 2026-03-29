#!/bin/bash
set -e

echo "======================================"
echo "   SoberClaw 视频切片系统 启动脚本"
echo "======================================"

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ 未找到 ffmpeg，请先安装："
    echo "   Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "   macOS: brew install ffmpeg"
    exit 1
fi

# Create dirs
mkdir -p uploads outputs temp

# Start backend
start_backend() {
    echo ""
    echo "▶ 启动后端服务..."
    cd backend

    if [ ! -d ".venv" ]; then
        echo "  创建虚拟环境..."
        python3 -m venv .venv
    fi

    source .venv/bin/activate

    echo "  安装依赖..."
    pip install -q -r requirements.txt

    echo "  启动 FastAPI (端口 8000)..."
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    echo "  后端 PID: $BACKEND_PID"
    cd ..
}

# Start frontend
start_frontend() {
    echo ""
    echo "▶ 启动前端服务..."
    cd frontend

    if [ ! -d "node_modules" ]; then
        echo "  安装 npm 依赖..."
        npm install
    fi

    echo "  启动 Next.js (端口 3000)..."
    npm run dev &
    FRONTEND_PID=$!
    echo "  前端 PID: $FRONTEND_PID"
    cd ..
}

start_backend
start_frontend

echo ""
echo "======================================"
echo "✅ 服务已启动："
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:8000"
echo "   API文档: http://localhost:8000/api/docs"
echo ""
echo "💡 提示: 设置 ANTHROPIC_API_KEY 环境变量以启用 Claude AI"
echo "   export ANTHROPIC_API_KEY=sk-ant-..."
echo "======================================"

# Wait
wait
