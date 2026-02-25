#!/bin/bash

# Lesson Flow - Simple AWS EC2 Direct Deployment
# For AWS Linux 2023
# Run on your local machine to deploy to EC2
# 
# Usage: bash scripts/deploy.sh <ec2-ip> <github-repo-url>
# Example: bash scripts/deploy.sh 54.123.45.67 https://github.com/user/lesson-flow.git

set -e

if [ $# -lt 2 ]; then
    echo "Usage: bash scripts/deploy.sh <ec2-ip> <github-repo>"
    echo ""
    echo "Example: bash scripts/deploy.sh 54.123.45.67 https://github.com/user/lesson-flow.git"
    exit 1
fi

EC2_IP=$1
REPO=$2

echo "=========================================="
echo "Deploying to EC2: $EC2_IP"
echo "Repository: $REPO"
echo "=========================================="

# SSH into EC2 and run deployment
ssh -o StrictHostKeyChecking=no ec2-user@$EC2_IP << 'DEPLOY_SCRIPT'

set -e
echo "Starting deployment..."

# Navigate to app directory
cd /app

# Clone or pull repository
if [ -d ".git" ]; then
    echo "✓ Pulling latest code..."
    git pull origin main
else
    echo "✓ Cloning repository..."
    git clone $REPO .
fi

# Deploy Backend
echo "✓ Installing backend dependencies..."
cd server
npm install --production

# Generate Prisma client
npm run generate

# Start/restart backend with PM2
echo "✓ Starting backend service..."
pm2 delete lessonflow-api || true
pm2 start api/index.js --name lessonflow-api
pm2 save

# Deploy Frontend
echo "✓ Building frontend..."
cd ../client
npm install --production
npm run build

# Setup Nginx
echo "✓ Configuring Nginx..."
sudo tee /etc/nginx/conf.d/lesson-flow.conf > /dev/null << 'NGINX_CONF'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 50M;

    # Serve React static files
    location / {
        root /app/client/dist;
        try_files $uri /index.html;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Proxy API to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONF

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "=========================================="
echo "✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "Your app is live at: http://$1"
echo "API health: http://$1/api/health"
echo ""
echo "Check status: pm2 logs lessonflow-api"
echo "Restart: pm2 restart lessonflow-api"
echo ""

DEPLOY_SCRIPT

echo "✓ Deployment finished successfully!"
