# Deployment Guide — Kraftman Packaging

## Domain Setup

| Domain | App | Port |
|--------|-----|------|
| `kraftmanpackaging.com` | Website (Node.js/Express) | 3000 |
| `erp.kraftmanpackaging.com` | ERP (Next.js) | 3001 |

## Prerequisites

- Ubuntu/Debian VPS (e.g., DigitalOcean, AWS EC2, Hostinger VPS)
- Node.js 18+ installed
- Nginx installed
- Domain DNS pointing to server IP

## Step 1: DNS Records

Add these A records in your domain registrar (GoDaddy, Cloudflare, etc.):

```
Type    Name    Value           TTL
A       @       <SERVER_IP>     3600
A       www     <SERVER_IP>     3600
A       erp     <SERVER_IP>     3600
```

## Step 2: Upload Code to Server

```bash
# SSH into server
ssh root@<SERVER_IP>

# Create directories
mkdir -p /var/www/kraftman-website
mkdir -p /var/www/kraftman-erp

# Upload code (from your local machine)
# Option A: rsync
rsync -avz --exclude node_modules ~/Desktop/kraftman-website/ root@<SERVER_IP>:/var/www/kraftman-website/
rsync -avz --exclude node_modules ~/Desktop/kraftman-erp/ root@<SERVER_IP>:/var/www/kraftman-erp/

# Option B: git clone (if repos are on GitHub)
# cd /var/www && git clone <repo-url> kraftman-website
# cd /var/www && git clone <repo-url> kraftman-erp
```

## Step 3: Install Dependencies

```bash
# Website
cd /var/www/kraftman-website
npm install --production
cp .env.example .env
# Edit .env — set JWT_SECRET, NODE_ENV=production, PORT=3000

# ERP
cd /var/www/kraftman-erp
npm install
npx prisma generate
npx prisma db push    # or migrate if using migrations
npm run build
```

## Step 4: PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start Website
cd /var/www/kraftman-website
pm2 start server.js --name "kraftman-website" --env production

# Start ERP (Next.js on port 3001)
cd /var/www/kraftman-erp
PORT=3001 pm2 start npm --name "kraftman-erp" -- start

# Save PM2 config & enable auto-start on reboot
pm2 save
pm2 startup
```

## Step 5: Nginx Configuration

```bash
# Copy nginx config
sudo cp /var/www/kraftman-website/deploy/nginx.conf /etc/nginx/sites-available/kraftman

# Enable site
sudo ln -s /etc/nginx/sites-available/kraftman /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

## Step 6: SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificates
sudo certbot --nginx -d kraftmanpackaging.com -d www.kraftmanpackaging.com
sudo certbot --nginx -d erp.kraftmanpackaging.com

# Auto-renewal is set up automatically. Verify:
sudo certbot renew --dry-run
```

## Step 7: Verify

- Visit `https://kraftmanpackaging.com` — website should load
- Visit `https://erp.kraftmanpackaging.com` — ERP should load
- Click "ERP Portal" link in website nav — should open ERP in new tab
- Visit `https://kraftmanpackaging.com/health` — should return OK

## Useful PM2 Commands

```bash
pm2 status              # Check running processes
pm2 logs                # View all logs
pm2 logs kraftman-erp   # View ERP logs only
pm2 restart all         # Restart everything
pm2 monit               # Real-time monitoring
```
