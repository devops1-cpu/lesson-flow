# Complete AWS Deployment Guide - Lesson Flow

## Prerequisites

✓ AWS Account (free tier eligible)  
✓ EC2 instance created (Amazon Linux 2023, t2.micro)  
✓ EC2 key pair (.pem file) downloaded  
✓ EC2 Public IP address saved  

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Domain                           │
│                   (e.g., yourdomain.com)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ EC2 Instance│
                    │  (Nginx)    │
                    │  (Node.js)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌─────▼──────┐    ┌────▼────┐
   │ Frontend │       │  API       │    │ PM2     │
   │  (React) │       │ (Express)  │    │ Manager │
   │  /dist   │       │ (Port 3001)│    │         │
   └──────────┘       └─────┬──────┘    └─────────┘
                            │
                     ┌──────▼──────┐
                     │ RDS         │
                     │ PostgreSQL  │
                     │ (Database)  │
                     └─────────────┘
```

---

# STEP 1: Create RDS PostgreSQL Database

## 1.1 Create Database

1. Go to **AWS Console** → **RDS** → **Databases**
2. Click **Create Database**
3. Select:
   - **Engine**: PostgreSQL (select latest version)
   - **Templates**: Free tier
   - **DB instance identifier**: `lesson-flow-db`
   - **Master username**: `postgres`
   - **Master password**: Create strong password (e.g., `Abc$123Xyz456!`)
   - **Publicly accessible**: **YES**

4. Click **Create Database** (wait 5-10 minutes for creation)

## 1.2 Get Database Details

Once created, open your database and **copy these values** to a text file:

```
DB_HOST = lesson-flow-db.xxxxxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_USER = postgres  
DB_PASSWORD = Your-Password-Here
DB_PORT = 5432
DB_NAME = postgres (default)
```

## 1.3 Allow EC2 to Access RDS

1. Go to your RDS database page
2. Scroll down → **Security group** → Click on security group link
3. Click **Edit inbound rules**
4. Add rule:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Custom → Enter your EC2 security group ID
5. Save

---

# STEP 2: Setup EC2 Instance

## 2.1 Connect to EC2

On your local machine, run:

```bash
# Give key correct permissions
chmod 400 your-key.pem

# Connect via SSH (use ec2-user for AWS Linux 2023)
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
```

## 2.2 Run Automated Setup

Copy the setup script and run it:

```bash
# From your LOCAL machine
scp -i your-key.pem scripts/setup-ec2.sh ec2-user@YOUR_EC2_IP:~/

# Then SSH and run it
ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'bash ~/setup-ec2.sh'
```

This will automatically install:
- Node.js 24
- PM2 (process manager)
- Nginx (reverse proxy)
- PostgreSQL client
- And setup firewall

---

# STEP 3: Create Database in RDS

## 3.1 Connect to RDS from EC2

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Connect to RDS database
psql -h database-1.chu08eousbxd.eu-north-1.rds.amazonaws.com -U postgres -d postgres \
     -U postgres \
     -d postgres

# When prompted, enter your RDS password
```

## 3.2 Create Application Database

Once connected, run:

```sql
CREATE DATABASE lessonflow;
\q
```

Verify:

```bash
psql -h database-1.chu08eousbxd.eu-north-1.rds.amazonaws.com -U postgres -d postgres \
     -U postgres \
     -d lessonflow

# Should connect successfully
\q
```

---

# STEP 4: Update Environment Files

## 4.1 Backend Production Environment

Edit `server/.env.production` with actual values:

```dotenv
# Database (from RDS details above)
DATABASE_URL=postgresql://postgres:Your-Password-Here@lesson-flow-db.xxxxxxxxxxxxx.us-east-1.rds.amazonaws.com:5432/lessonflow

# Server
PORT=3001
NODE_ENV=production

# Frontend URL (will be same as EC2 IP or your domain)
FRONTEND_URL=http://YOUR_EC2_IP

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=GENERATE_THIS_VALUE_WITH_openssl_rand_-hex_32

# Google Gemini API Key (if using AI features)
GEMINI_API_KEY=your_gemini_api_key_here
```

## 4.2 Frontend Production Environment

Edit `client/.env.production`:

```dotenv
# Backend API URL
VITE_API_URL=http://YOUR_EC2_IP/api
```

## 4.3 Generate JWT Secret

On your local machine:

```bash
# macOS/Linux
openssl rand -hex 32

# Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
```

Copy the output and paste into `JWT_SECRET` in `.env.production`

---

# STEP 5: Deploy Application

## 5.1 Push Code to GitHub

First, make sure your code is on GitHub:

```bash
git add .
git commit -m "AWS deployment ready"
git push origin main
```

## 5.2 Deploy with One Command

From your local machine:

```bash
bash scripts/deploy.sh YOUR_EC2_IP https://github.com/YOUR_USERNAME/lesson-flow.git
```

This script will:
1. SSH into EC2
2. Clone your repository
3. Install backend dependencies
4. Run Prisma migrations
5. Start API with PM2
6. Build frontend
7. Configure Nginx
8. Reload Nginx

---

# STEP 6: Verify Deployment

## 6.1 Check Backend is Running

```bash
# From your local machine
curl http://YOUR_EC2_IP/api/health
```

Should return:
```json
{"status":"ok","db":"connected","rows":0}
```

## 6.2 Check Frontend is Accessible

Open in browser:
```
http://YOUR_EC2_IP
```

Should see your React application.

## 6.3 View Logs

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'pm2 logs lessonflow-api'
```

---

# Environment Variables Explanation

## Backend (.env.production)

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pwd@rds-host:5432/lessonflow` |
| `PORT` | API port | `3001` |
| `NODE_ENV` | Environment type | `production` |
| `FRONTEND_URL` | Frontend domain for CORS | `http://54.123.45.67` |
| `JWT_SECRET` | Token signing key | `a1b2c3d4e5f6...` (32 chars) |
| `GEMINI_API_KEY` | Google AI API key | `AIzaSy...` |

## Frontend (.env.production)

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_URL` | Backend API endpoint | `http://54.123.45.67/api` |

---

# Frontend Hosting Explanation

Your frontend is hosted **directly on the same EC2 instance** as your backend:

1. **Frontend Build**: React app is built to `/app/client/dist` folder
2. **Nginx Serves**: Nginx serves these static files when accessing `http://YOUR_EC2_IP/`
3. **API Proxy**: Nginx also proxies `/api/*` requests to Node.js backend on port 3001
4. **One Server**: Both frontend and backend run on the same EC2 instance

This is the **simplest and most cost-effective** approach for free tier.

```
Browser Request                  EC2 Instance
     │                           ┌─────────────┐
     ├─ GET /               ──→  │   Nginx     │──→ React files in /dist
     │                           │             │
     └─ POST /api/login     ──→  │   Proxy     │──→ Node.js (port 3001)
                                 └─────────────┘
```

---

# Common Tasks

## Deploy Latest Code

```bash
bash scripts/deploy.sh YOUR_EC2_IP https://github.com/YOUR_USERNAME/lesson-flow.git
```

## View API Logs

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'pm2 logs lessonflow-api'
```

## SSH into EC2

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
```

## Restart API

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'pm2 restart lessonflow-api'
```

## Update Database Schema

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP << 'EOF'
cd /app/server
npx prisma migrate deploy
EOF
```

## Check Services Status

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP << 'EOF'
pm2 status
sudo systemctl status nginx
EOF
```

---

# Troubleshooting

## API Returns Connection Error

**Check database connection:**

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
psql -h YOUR_RDS_HOST -U postgres -d lessonflow
```

**Check .env.production:**
- Make sure DATABASE_URL is correct
- Verify RDS password is correct
- Confirm RDS security group allows EC2

## Frontend Shows Blank Page

**Check logs:**

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
sudo tail -f /var/log/nginx/error.log
```

**Check frontend built:**

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP ls -la /app/client/dist
```

## API Not Responding

**Check PM2 status:**

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'pm2 status'
```

**Restart:**

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'pm2 restart lessonflow-api'
```

---

# Security Best Practices

✓ Keep `.env.production` file **private** (don't commit to Git)  
✓ Use strong database password  
✓ Generate unique JWT_SECRET for production  
✓ Only expose HTTP/HTTPS ports in security group  
✓ Regularly update dependencies: `npm audit fix`  
✓ Monitor AWS free tier usage to avoid charges  

---

# Quick Reference

```bash
# Local: Deploy
bash scripts/deploy.sh 54.123.45.67 https://github.com/user/lesson-flow.git

# Remote: View logs
ssh -i key.pem ubuntu@54.123.45.67 "pm2 logs"

# Remote: SSH
ssh -i key.pem ubuntu@54.123.45.67

# Remote: Restart API
ssh -i key.pem ubuntu@54.123.45.67 "pm2 restart lessonflow-api"

# Test API
curl http://54.123.45.67/api/health

# View frontend
http://54.123.45.67
```

---

# Costs (AWS Free Tier)

- **EC2 t2.micro**: Free for 1 year (750 hours/month)
- **RDS db.t3.micro**: Free for 1 year (750 hours/month, 20GB storage)
- **Data transfer**: First 1GB/month is free
- **Total**: **$0/month** while in free tier

Monitor your usage in AWS Console to stay within limits.

---

# Next Steps

1. ✓ Create RDS database (Step 1)
2. ✓ Setup EC2 (Step 2)
3. ✓ Create database in RDS (Step 3)
4. ✓ Update .env files (Step 4)
5. ✓ Deploy application (Step 5)
6. ✓ Verify everything works (Step 6)

**Your app will be live at: `http://YOUR_EC2_IP`**

---

## Support Commands Cheatsheet

| Task | Command |
|------|---------|
| SSH to EC2 | `ssh -i key.pem ec2-user@IP` |
| Deploy code | `bash scripts/deploy.sh IP URL` |
| View logs | `ssh -i key.pem ec2-user@IP "pm2 logs"` |
| Check status | `ssh -i key.pem ec2-user@IP "pm2 status"` |
| Stop API | `ssh -i key.pem ec2-user@IP "pm2 stop lessonflow-api"` |
| Restart API | `ssh -i key.pem ec2-user@IP "pm2 restart lessonflow-api"` |
| Test API | `curl http://IP/api/health` |
| Test DB | `psql -h RDS_HOST -U postgres -d lessonflow` |

---

**Ready? Start with Step 1 above! 🚀**
