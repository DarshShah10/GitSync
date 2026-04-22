#!/bin/bash

# GitSync Deployment Script
# This script deploys the GitSync project to the VM

set -e

echo "=== GitSync Deployment Started ==="

# Configuration
VM_USER="root"
VM_HOST="104.248.79.96"
VM_PATH="/root/gitsync"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 Step 1: Syncing project to VM..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.env.local' \
  "${PROJECT_DIR}/" "${VM_USER}@${VM_HOST}:${VM_PATH}/"

echo "✅ Project synced successfully!"

echo "📝 Step 2: Running setup on VM..."
ssh "${VM_USER}@${VM_HOST}" << 'REMOTE_COMMANDS'
cd /root/gitsync

echo "Installing backend dependencies..."
cd backend && npm install && cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "Building frontend..."
cd frontend && npm run build && cd ..

echo "✅ Setup completed!"
REMOTE_COMMANDS

echo "🚀 Step 3: Starting services..."
ssh "${VM_USER}@${VM_HOST}" << 'REMOTE_COMMANDS'
cd /root/gitsync

# Install PM2 globally if not already installed
npm install -g pm2

# Stop any existing processes
pm2 delete all 2>/dev/null || true

# Start backend
cd backend
pm2 start "npm start" --name "gitsync-backend"
cd ..

# Save PM2 config
pm2 save
pm2 startup

echo "✅ Services started!"
echo ""
echo "=== Deployment Complete ==="
echo "Frontend: http://gitsync.duckdns.org"
echo "Backend API: http://gitsyncbackend.duckdns.org"
REMOTE_COMMANDS

echo "✨ Deployment finished successfully!"
