#!/bin/bash

# Lesson Flow - AWS Linux 2023 Initial Setup
# Run ONCE on fresh EC2 instance (AWS Linux 2023)
# Command: ssh -i your-key.pem ec2-user@YOUR_EC2_IP 'bash -s' < scripts/setup-ec2.sh

set -e

echo "=========================================="
echo "Setting up Lesson Flow on AWS Linux 2023"
echo "=========================================="

# Update system
echo "✓ Updating system..."
sudo yum update -y -q

# Install Node.js 18
echo "✓ Installing Node.js 18..."
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash - > /dev/null 2>&1
sudo yum install -y -q nodejs

# Install PM2
echo "✓ Installing PM2..."
sudo npm install -g pm2 > /dev/null 2>&1

# Install Nginx
echo "✓ Installing Nginx..."
sudo yum install -y -q nginx
sudo systemctl enable nginx > /dev/null 2>&1
sudo systemctl start nginx > /dev/null 2>&1

# Install PostgreSQL client
echo "✓ Installing PostgreSQL client..."
sudo yum install -y -q postgresql15

# Install Git
echo "✓ Installing Git..."
sudo yum install -y -q git

# Create app directory
echo "✓ Creating app directory..."
sudo mkdir -p /app
sudo chown ec2-user:ec2-user /app

# Setup firewall (firewalld on AWS Linux)
echo "✓ Setting up firewall..."
sudo systemctl enable firewalld > /dev/null 2>&1
sudo systemctl start firewalld > /dev/null 2>&1
sudo firewall-cmd --permanent --add-port=22/tcp > /dev/null 2>&1
sudo firewall-cmd --permanent --add-port=80/tcp > /dev/null 2>&1
sudo firewall-cmd --permanent --add-port=443/tcp > /dev/null 2>&1
sudo firewall-cmd --reload > /dev/null 2>&1

echo ""
echo "=========================================="
echo "✓ EC2 Setup Complete!"
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo "1. Create RDS PostgreSQL database"
echo "2. Note DB_HOST, DB_USER, DB_PASSWORD"
echo "3. SSH and run: bash deploy.sh"
echo ""
