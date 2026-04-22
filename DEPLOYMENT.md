# GitSync Deployment Guide

## ✅ Pre-Deployment Checklist

- [x] Backend .env updated with production URLs
- [x] Frontend .env updated with production API URL
- [ ] VM is accessible at 104.248.79.96
- [ ] Domain gitsync.duckdns.org is pointing to the VM
- [ ] SSH access verified
- [ ] Node.js 20+ installed on VM

## 📋 Configuration Summary

### Backend URLs
```
SERVER_URL=http://gitsyncbackend.duckdns.org
CLIENT_URL=http://gitsync.duckdns.org
PORT=3000
NODE_ENV=production
```

### Frontend URLs
```
VITE_API_URL=http://gitsyncbackend.duckdns.org
```

### Domain Configuration
- **Frontend:** gitsync.duckdns.org (React app)
- **Backend API:** gitsyncbackend.duckdns.org (Node.js/Fastify)
- **VM IP:** 104.248.79.96

## 🚀 Deployment Steps

### Option 1: Automated Deployment (Recommended)

On your local machine, make sure you can SSH without password prompts (set up SSH keys):

```bash
# From project root
bash deploy.sh
```

This script will:
1. Rsync the project to the VM (excluding node_modules, .git, dist)
2. Install dependencies
3. Generate Prisma client
4. Build frontend
5. Start services with PM2

### Option 2: Manual Deployment

#### Step 1: Rsync Project to VM

```bash
# From project root on your local machine
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.env.local' \
  ./ root@104.248.79.96:/root/gitsync/
```

#### Step 2: SSH into VM and Run Setup

```bash
ssh root@104.248.79.96

# Run the setup script
bash /root/gitsync/vm-setup.sh
```

#### Step 3: Configure Reverse Proxy (Nginx)

```bash
# Install Nginx
apt update && apt install -y nginx

# Create config for gitsync
sudo tee /etc/nginx/sites-available/gitsync > /dev/null <<EOF
# Backend API
server {
    listen 80;
    server_name gitsyncbackend.duckdns.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Frontend
server {
    listen 80;
    server_name gitsync.duckdns.org;
    root /root/gitsync/frontend/dist;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the config
sudo ln -sf /etc/nginx/sites-available/gitsync /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 4: Setup SSL with Certbot (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificates
certbot --nginx -d gitsync.duckdns.org -d gitsyncbackend.duckdns.org

# Auto-renewal is configured automatically
```

## 📊 Verify Deployment

```bash
# Check backend health
curl http://gitsyncbackend.duckdns.org/health

# Check PM2 status
pm2 status

# View logs
pm2 logs gitsync-backend

# Monitor in real-time
pm2 monit
```

## 🔧 Useful Commands

```bash
# SSH into VM
ssh root@104.248.79.96

# View running services
pm2 list

# View logs
pm2 logs

# Restart backend
pm2 restart gitsync-backend

# Stop all
pm2 stop all

# View frontend build
ls -la /root/gitsync/frontend/dist

# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 📝 Environment Variables Reference

### Backend (.env)
- `NODE_ENV`: Set to `production`
- `PORT`: 3000
- `SERVER_URL`: http://gitsyncbackend.duckdns.org
- `CLIENT_URL`: http://gitsync.duckdns.org
- `DATABASE_URL`: PostgreSQL connection string (Supabase)
- `REDIS_URL`: Redis connection string (Upstash)
- `JWT_SECRET`: Your JWT secret key
- OAuth credentials: Google & GitHub

### Frontend (.env)
- `VITE_API_URL`: http://gitsyncbackend.duckdns.org

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### PM2 Issues
```bash
# Flush PM2
pm2 flush

# Restart all services
pm2 restart all

# View error logs
cat ~/.pm2/logs/gitsync-backend-error.log
```

### Nginx Issues
```bash
# Test config
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Reload config
sudo systemctl reload nginx
```

### Database Connection Issues
- Verify `DATABASE_URL` in backend .env
- Verify `REDIS_URL` in backend .env
- Check Supabase and Upstash connections

## 🎯 Post-Deployment

1. **Test the application:**
   - Visit http://gitsync.duckdns.org
   - Login and test features
   - Check API calls in browser DevTools

2. **Monitor services:**
   - Set up PM2 monitoring
   - Configure log rotation
   - Set up alerts for failures

3. **Backup database:**
   - Schedule regular PostgreSQL backups
   - Test restore procedures

4. **Scale if needed:**
   - Monitor CPU/Memory usage
   - Add caching layer (Redis)
   - Implement CDN for frontend

## 📞 Support

For issues, check:
1. PM2 logs: `pm2 logs`
2. Nginx error logs: `/var/log/nginx/error.log`
3. Backend .env configuration
4. Network connectivity to databases
