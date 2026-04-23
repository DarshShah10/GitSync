#!/bin/bash

# GitSync VM Setup Script
# Run this on the VM after rsync completes

set -e

echo "=== GitSync VM Setup Started ==="

PROJECT_DIR="/root/gitsync"
cd "$PROJECT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

echo ""
echo "📦 Installing dependencies..."
echo "Backend dependencies..."
cd backend && npm install
cd ..

echo "Frontend dependencies..."
cd frontend && npm install
cd ..

echo ""
echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

echo ""
echo "🚀 Installing PM2 globally..."
npm install -g pm2

echo ""
echo "📋 Creating PM2 ecosystem config..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'gitsync-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    }
  ]
};
EOF

echo "✅ PM2 ecosystem config created"

echo ""
echo "🚀 Starting services with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup || true

echo ""
echo "✨ Setup completed!"
echo ""
echo "=== Next Steps ==="
echo "1. Set up a reverse proxy (Nginx/Caddy) to serve frontend and backend"
echo "2. Configure SSL certificates (Let's Encrypt)"
echo "3. Test: curl http://gitsyncbackend.duckdns.org/health"
echo "4. View logs: pm2 logs"
echo "5. Monitor: pm2 monit"
