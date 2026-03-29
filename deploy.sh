#!/bin/bash
# ============================================================
# SoberClaw 视频切片系统 - 服务器一键部署脚本
# 适用于 Ubuntu 22.04 LTS
#
# 用法（四选一）：
#   Claude:   bash deploy.sh --claude   sk-ant-xxx
#   豆包:     bash deploy.sh --doubao   "API_KEY" "ep-MODEL_ID"
#   通义千问: bash deploy.sh --qwen     sk-xxx
#   OpenAI:   bash deploy.sh --openai   sk-xxx
# ============================================================
set -e

REPO_URL="https://github.com/yimingchen111/soberclaw"
APP_DIR="/opt/soberclaw"

# 解析参数
PROVIDER="${1:-}"
case "$PROVIDER" in
  --claude)  ANTHROPIC_API_KEY="${2:-}"; shift 2 ;;
  --doubao)  DOUBAO_API_KEY="${2:-}"; DOUBAO_MODEL="${3:-}"; shift 3 ;;
  --qwen)    DASHSCOPE_API_KEY="${2:-}"; shift 2 ;;
  --openai)  OPENAI_API_KEY="${2:-}"; OPENAI_BASE_URL="${3:-}"; shift 2 ;;
  *)         ANTHROPIC_API_KEY="${1:-}"; shift 1 2>/dev/null || true ;;  # 兼容旧用法
esac

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

[ "$(id -u)" -eq 0 ] || err "请使用 root 用户运行（sudo bash deploy.sh）"

step "1/8  更新系统 & 安装基础工具"
apt-get update -qq
apt-get install -y -qq curl git nginx ffmpeg python3 python3-pip python3-venv \
    build-essential libssl-dev pkg-config
log "基础工具安装完成"

step "2/8  安装 Node.js 20"
if ! command -v node &>/dev/null || [[ "$(node -v)" < "v20" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
log "Node.js $(node -v) 已就绪"

step "3/8  克隆项目代码"
if [ -d "$APP_DIR" ]; then
    warn "目录已存在，拉取最新代码..."
    cd "$APP_DIR" && git pull
else
    git clone "$REPO_URL" "$APP_DIR"
fi
log "代码已准备：$APP_DIR"

step "4/8  配置环境变量"
cat > "$APP_DIR/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
DOUBAO_API_KEY=${DOUBAO_API_KEY:-}
DOUBAO_MODEL=${DOUBAO_MODEL:-}
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY:-}
DASHSCOPE_MODEL=${DASHSCOPE_MODEL:-qwen-plus}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_BASE_URL=${OPENAI_BASE_URL:-}
OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
log "环境变量已写入 .env"

step "5/8  安装后端依赖"
cd "$APP_DIR/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q fastapi uvicorn[standard] python-multipart pydantic pydantic-settings \
    anthropic aiofiles httpx edge-tts ffmpeg-python
mkdir -p "$APP_DIR/uploads" "$APP_DIR/outputs" "$APP_DIR/temp"
log "后端依赖安装完成"

step "6/8  安装前端依赖并构建"
cd "$APP_DIR/frontend"
npm install -q
npm run build
log "前端构建完成"

step "7/8  配置 Systemd 服务"

# 后端服务
cat > /etc/systemd/system/soberclaw-backend.service <<EOF
[Unit]
Description=SoberClaw Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/.env
ExecStart=${APP_DIR}/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 前端服务
cat > /etc/systemd/system/soberclaw-frontend.service <<EOF
[Unit]
Description=SoberClaw Frontend (Next.js)
After=network.target soberclaw-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/frontend
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=http://localhost:8000
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable soberclaw-backend soberclaw-frontend
systemctl restart soberclaw-backend soberclaw-frontend
log "Systemd 服务已启动"

step "8/8  配置 Nginx 反向代理"

# 获取公网 IP
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com || hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/soberclaw <<EOF
server {
    listen 80;
    server_name ${PUBLIC_IP} _;

    # 上传文件大小限制（视频可能很大）
    client_max_body_size 2048m;
    client_body_timeout 600s;
    send_timeout 600s;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # 视频文件（大文件直接静态服务）
    location /outputs/ {
        alias ${APP_DIR}/outputs/;
        add_header Content-Disposition 'attachment';
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/soberclaw /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
log "Nginx 配置完成"

# ── 完成 ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      🎉  SoberClaw 部署成功！               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 访问地址：${YELLOW}http://${PUBLIC_IP}${NC}"
echo -e "  📖 API 文档：${YELLOW}http://${PUBLIC_IP}/api/docs${NC}"
echo ""
if [ -z "$API_KEY" ]; then
    echo -e "  ${YELLOW}⚠️  未设置 ANTHROPIC_API_KEY，AI 分析功能将使用均匀切割兜底方案${NC}"
    echo -e "  设置方法：编辑 ${APP_DIR}/.env 填入 API Key 后重启服务："
    echo -e "    ${BLUE}nano ${APP_DIR}/.env${NC}"
    echo -e "    ${BLUE}systemctl restart soberclaw-backend${NC}"
else
    echo -e "  ${GREEN}✅  Claude AI 已配置，精彩识别功能已启用${NC}"
fi
echo ""
echo -e "  服务管理命令："
echo -e "    查看状态: ${BLUE}systemctl status soberclaw-backend soberclaw-frontend${NC}"
echo -e "    查看日志: ${BLUE}journalctl -u soberclaw-backend -f${NC}"
echo -e "    重启服务: ${BLUE}systemctl restart soberclaw-backend soberclaw-frontend${NC}"
echo ""
