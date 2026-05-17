# Panduan Deploy BoxOffice ke VPS

Panduan ini menjelaskan cara deploy aplikasi BoxOffice ke VPS Linux (Ubuntu 22.04+ atau Debian 12+) menggunakan Node.js, PostgreSQL, PM2, dan Nginx.

Project ini sudah dibekali worker background untuk sync (`scripts/movie-sync-worker.ts`) supaya proses sync ke upstream Filmbox tidak timeout di request HTTP. Worker dijalankan terus oleh PM2 dan mengambil job dari tabel `MovieSyncJob` di database.

## Daftar Isi

1. [Persiapan VPS](#1-persiapan-vps)
2. [Install Node.js, PostgreSQL, dan Nginx](#2-install-nodejs-postgresql-dan-nginx)
3. [Setup Database PostgreSQL](#3-setup-database-postgresql)
4. [Clone Project dan Install Dependencies](#4-clone-project-dan-install-dependencies)
5. [Setup Environment Variables](#5-setup-environment-variables)
6. [Migrasi dan Generate Prisma Client](#6-migrasi-dan-generate-prisma-client)
7. [Build Project](#7-build-project)
8. [Setup PM2 untuk Web Server dan Sync Worker](#8-setup-pm2-untuk-web-server-dan-sync-worker)
9. [Setup Nginx sebagai Reverse Proxy](#9-setup-nginx-sebagai-reverse-proxy)
10. [Setup HTTPS dengan Let's Encrypt](#10-setup-https-dengan-lets-encrypt)
11. [Setup Cron Job](#11-setup-cron-job)
12. [Background Sync: Cara Kerja](#12-background-sync-cara-kerja)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Persiapan VPS

Spesifikasi minimum yang direkomendasikan:

- **OS**: Ubuntu 22.04 LTS atau Debian 12
- **RAM**: 2 GB (minimum), 4 GB (recommended)
- **CPU**: 2 vCPU
- **Storage**: 20 GB SSD
- **Network**: IPv4 publik

Login ke VPS sebagai `root` lalu update sistem:

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential ufw
```

Buat user non-root dan tambahkan ke grup `sudo`:

```bash
adduser deploy
usermod -aG sudo deploy
```

Setup firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Login ulang sebagai user `deploy` untuk langkah berikutnya.

---

## 2. Install Node.js, PostgreSQL, dan Nginx

### Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### PM2

```bash
sudo npm install -g pm2
pm2 -v
```

### PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
psql --version
```

### Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
nginx -v
```

---

## 3. Setup Database PostgreSQL

Login ke shell `psql` sebagai user postgres:

```bash
sudo -u postgres psql
```

Buat user database dan database baru. Ganti `STRONG_PASSWORD_DI_SINI` dengan password yang kuat:

```sql
CREATE USER boxofice WITH PASSWORD 'STRONG_PASSWORD_DI_SINI';
CREATE DATABASE boxofice OWNER boxofice;
GRANT ALL PRIVILEGES ON DATABASE boxofice TO boxofice;
ALTER USER boxofice CREATEDB;
\q
```

Test koneksi:

```bash
psql "postgresql://boxofice:STRONG_PASSWORD_DI_SINI@localhost:5432/boxofice" -c "SELECT version();"
```

Untuk produksi, kalau database di host yang sama, edit `/etc/postgresql/16/main/pg_hba.conf` agar koneksi local pakai `md5` atau `scram-sha-256`:

```
local   all   all   scram-sha-256
host    all   all   127.0.0.1/32   scram-sha-256
host    all   all   ::1/128        scram-sha-256
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

---

## 4. Clone Project dan Install Dependencies

Pastikan punya akses ke repository (SSH key atau token).

```bash
cd ~
git clone https://github.com/USER/boxofice.git
cd boxofice
npm install
```

`npm install` otomatis menjalankan `prisma generate` (lihat `package.json` script `postinstall`).

---

## 5. Setup Environment Variables

Salin contoh env dan edit:

```bash
cp env.example .env
nano .env
```

Field yang wajib diisi untuk produksi:

```env
# Admin
ADMIN_EMAIL="admin@boxofice.local"
ADMIN_PASSWORD="GANTI_DENGAN_PASSWORD_KUAT"
ADMIN_SESSION_SECRET="GANTI_DENGAN_RANDOM_HEX_64"

# Cron auth
CRON_SECRET="GANTI_DENGAN_RANDOM_HEX_64"

# Database (kalau host lokal)
DATABASE_URL="postgresql://boxofice:STRONG_PASSWORD_DI_SINI@localhost:5432/boxofice?schema=public"
DIRECT_URL="postgresql://boxofice:STRONG_PASSWORD_DI_SINI@localhost:5432/boxofice?schema=public"

# Public URL
NEXT_PUBLIC_APP_URL="https://domainkamu.com"

# Telegram bot
TELEGRAM_BOT_TOKEN="ISI_DARI_BOTFATHER"
TELEGRAM_BOT_USERNAME="BotKamu"
TELEGRAM_WEBHOOK_SECRET="GANTI_DENGAN_RANDOM_HEX"
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS="3600"

# Filmbox upstream
FILMBOX_BASE_URL="https://indocast.site/api/filmbox"
FILMBOX_API_KEY="ISI_API_KEY_FILMBOX"

# Sync background
SYNC_PAGES_PER_FEED="3"
SYNC_STREAM_VALIDATION_CONCURRENCY="3"
SYNC_BACKGROUND_HOME_BATCH_SIZE="9"
SYNC_BACKGROUND_MOVIE_BATCH_SIZE="9"
SYNC_WORKER_IDLE_DELAY_MS="5000"
SYNC_WORKER_STEP_DELAY_MS="750"
SYNC_WORKER_ERROR_DELAY_MS="10000"
STREAM_CACHE_TTL_HOURS="24"

# Stream auth
STREAM_ACCESS_SECRET="GANTI_DENGAN_RANDOM_HEX"

# Payment (opsional, kosongkan kalau belum dipakai)
PAYMENKU_API_KEY=""
PAYMENKU_WEBHOOK_TOKEN=""
PAKASIR_PROJECT_SLUG=""
PAKASIR_API_KEY=""
PAKASIR_WEBHOOK_TOKEN=""

NODE_ENV="production"
```

Generate secret yang kuat:

```bash
openssl rand -hex 32
```

Kunci file `.env`:

```bash
chmod 600 .env
```

---

## 6. Migrasi dan Generate Prisma Client

```bash
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` akan apply semua migrasi di folder `prisma/migrations` ke database produksi tanpa membuat migrasi baru.

Verifikasi tabel terbuat:

```bash
psql "$DATABASE_URL" -c "\dt" | head -30
```

Harus ada tabel `Movie`, `User`, `MovieSyncJob`, `CronJobCursor`, dll.

---

## 7. Build Project

```bash
npm run build
```

Build menghasilkan folder `.next/` yang siap dijalankan dengan `npm start`.

Test sebentar:

```bash
npm start
```

Kalau berhasil, terminal akan menampilkan `Ready - started server on 0.0.0.0:3000`. Tekan `Ctrl+C` untuk stop, lalu lanjut ke step PM2.

---

## 8. Setup PM2 untuk Web Server dan Sync Worker

Buat file `ecosystem.config.cjs` di root project:

```bash
nano ecosystem.config.cjs
```

Isi dengan:

```js
module.exports = {
  apps: [
    {
      name: "boxofice-web",
      script: "npm",
      args: "start",
      cwd: "/home/deploy/boxofice",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/home/deploy/.pm2/logs/boxofice-web-error.log",
      out_file: "/home/deploy/.pm2/logs/boxofice-web-out.log",
      time: true,
    },
    {
      name: "boxofice-sync-worker",
      script: "npm",
      args: "run sync:worker",
      cwd: "/home/deploy/boxofice",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        MOVIE_SYNC_WORKER: "1",
      },
      error_file: "/home/deploy/.pm2/logs/boxofice-sync-error.log",
      out_file: "/home/deploy/.pm2/logs/boxofice-sync-out.log",
      time: true,
    },
  ],
};
```

Catatan: ganti path `/home/deploy/boxofice` sesuai lokasi actual project.

Jalankan PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Setup PM2 boot otomatis saat VPS restart:

```bash
pm2 startup systemd
```

PM2 akan menampilkan command yang perlu di-copy paste sebagai sudo. Jalankan command tersebut, lalu:

```bash
pm2 save
```

Cek status:

```bash
pm2 status
pm2 logs boxofice-web
pm2 logs boxofice-sync-worker
```

Sekarang dua proses jalan:

- **boxofice-web** → Next.js server di port 3000
- **boxofice-sync-worker** → background worker untuk proses sync

Worker akan idle (polling tiap 5 detik) sampai ada job di tabel `MovieSyncJob`. Saat user trigger sync dari panel admin atau dari endpoint cron, worker akan ambil job dan proses bertahap.

---

## 9. Setup Nginx sebagai Reverse Proxy

Buat config Nginx untuk domain:

```bash
sudo nano /etc/nginx/sites-available/boxofice
```

Isi dengan:

```nginx
upstream boxofice_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name domainkamu.com www.domainkamu.com;

    client_max_body_size 25M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Static asset cache
    location /_next/static {
        proxy_cache_valid 200 60m;
        proxy_pass http://boxofice_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /static {
        proxy_pass http://boxofice_app;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Default proxy
    location / {
        proxy_pass http://boxofice_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }
}
```

Aktifkan config:

```bash
sudo ln -s /etc/nginx/sites-available/boxofice /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Cek dari browser dengan IP VPS atau domain (kalau DNS sudah pointing). Harus muncul halaman BoxOffice.

---

## 10. Setup HTTPS dengan Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domainkamu.com -d www.domainkamu.com
```

Certbot otomatis edit Nginx config dan setup auto-renewal. Test renewal:

```bash
sudo certbot renew --dry-run
```

Setelah HTTPS aktif, update env:

```env
NEXT_PUBLIC_APP_URL="https://domainkamu.com"
```

Restart aplikasi:

```bash
pm2 restart boxofice-web
```

---

## 11. Setup Cron Job

Project ini punya endpoint cron `/api/cron/sync-nightly` dan `/api/cron/audit` yang dipanggil dari layanan eksternal (cron-job.org).

Untuk **cron-job.org** (recommended):

1. Daftar di https://cron-job.org
2. Buat job baru:
   - **URL**: `https://domainkamu.com/api/cron/sync-nightly?mode=cursor&target=home&slug=sync-home&fromPage=1&toPage=50`
   - **Method**: GET
   - **Header**: `Authorization: Bearer ISI_CRON_SECRET_DARI_ENV`
   - **Schedule**: setiap 3 menit (`*/3 * * * *`)

Lihat `cronjob.md` untuk daftar lengkap job (sync home, popular, new, audit).

Atau pakai cron lokal di VPS dengan `crontab -e`:

```
*/3 * * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET" "https://domainkamu.com/api/cron/sync-nightly?mode=cursor&target=home&slug=sync-home&fromPage=1&toPage=50" > /dev/null
1-59/3 * * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET" "https://domainkamu.com/api/cron/sync-nightly?mode=cursor&target=popular&slug=sync-popular&fromPage=1&toPage=50" > /dev/null
2-59/3 * * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET" "https://domainkamu.com/api/cron/sync-nightly?mode=cursor&target=new&slug=sync-new&fromPage=1&toPage=50" > /dev/null
0 12 * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET" "https://domainkamu.com/api/cron/audit?target=all&batchSize=12&autoHide=true" > /dev/null
```

---

## 12. Background Sync: Cara Kerja

Proses sync ke upstream Filmbox berat dan rentan timeout di request HTTP biasa. Karena itu sync di-handle dengan pola **job queue + worker**:

### Alur

```
[Admin klik "Sync"] 
        ↓
[syncMoviesFromAdmin server action]
        ↓
[createMovieSyncJob() → INSERT row di MovieSyncJob]
        ↓
[Halaman admin redirect dengan status "queued"]
        ↓
[boxofice-sync-worker (PM2) polling tabel MovieSyncJob tiap 5 detik]
        ↓
[Claim job → run 1 step (1 batch) → update progress]
        ↓
[Loop sampai job selesai (status: succeeded / partial / failed)]
```

### Komponen

- **Tabel `MovieSyncJob`** — antrian job dan progress tracker
- **`lib/movie-sync-jobs.ts`** — logic create, claim, run step, update progress
- **`scripts/movie-sync-worker.ts`** — worker daemon yang PM2 jalanin terus
- **`/api/admin/sync-jobs/run`** — endpoint untuk trigger 1 step (dipakai admin UI untuk auto-refresh)

### Kenapa request langsung timeout?

Filmbox upstream butuh waktu lama untuk fetch detail dan validasi stream. Kalau dijalankan dalam request HTTP server action, Next.js / Vercel / Nginx semua punya timeout (umumnya 30-60 detik), sedangkan sync 50 page bisa makan 10+ menit.

Solusinya: split jadi batch kecil (default 9 movie per step), simpan state di DB, lalu worker proses bertahap.

### Tuning Performa Sync

Edit `.env` lalu `pm2 restart boxofice-sync-worker`:

| Variable | Default | Naikkan kalau ... | Turunkan kalau ... |
|----------|---------|-------------------|---------------------|
| `SYNC_BACKGROUND_HOME_BATCH_SIZE` | 9 | sync terlalu lambat | sering kena rate limit |
| `SYNC_BACKGROUND_MOVIE_BATCH_SIZE` | 9 | sync terlalu lambat | sering kena rate limit |
| `SYNC_STREAM_VALIDATION_CONCURRENCY` | 3 | jaringan stabil | upstream sering 502 |
| `SYNC_WORKER_STEP_DELAY_MS` | 750 | upstream stabil | dapat error 429 |
| `SYNC_WORKER_IDLE_DELAY_MS` | 5000 | mau worker lebih responsif | mau hemat resource |

### Cek Status Worker

```bash
pm2 logs boxofice-sync-worker --lines 50
```

Output normal:

```
[movie-sync-worker] 2026-05-17T... started {"idleDelayMs":5000,"once":false,"stepDelayMs":750}
[movie-sync-worker] 2026-05-17T... idle, waiting for queued jobs
[movie-sync-worker] 2026-05-17T... step finished {"jobId":"...","phase":"home",...}
```

### Run Worker Sekali untuk Testing

```bash
cd ~/boxofice
npm run sync:worker:once
```

Worker ambil 1 job, proses 1 step, lalu exit. Berguna untuk debug.

---

## 13. Troubleshooting

### Aplikasi tidak bisa diakses dari domain

```bash
# cek PM2 jalan
pm2 status

# cek port 3000 listening
sudo ss -tlnp | grep 3000

# cek Nginx config
sudo nginx -t

# cek Nginx error log
sudo tail -50 /var/log/nginx/error.log
```

### Sync stuck di status "queued"

Worker belum jalan. Cek:

```bash
pm2 status boxofice-sync-worker
pm2 logs boxofice-sync-worker --err --lines 50
```

Restart kalau perlu:

```bash
pm2 restart boxofice-sync-worker
```

### Sync error timeout

Kalau worker yang jalan tapi step-nya timeout, kecilkan batch size:

```env
SYNC_BACKGROUND_HOME_BATCH_SIZE="5"
SYNC_BACKGROUND_MOVIE_BATCH_SIZE="5"
SYNC_STREAM_VALIDATION_CONCURRENCY="2"
```

Lalu restart worker:

```bash
pm2 restart boxofice-sync-worker
```

### Database connection error

```bash
# cek PostgreSQL service
sudo systemctl status postgresql

# test koneksi manual
psql "$DATABASE_URL" -c "SELECT 1;"

# cek pg_hba.conf membolehkan koneksi
sudo cat /etc/postgresql/16/main/pg_hba.conf | grep -v "^#"
```

### PM2 tidak start otomatis setelah reboot

```bash
pm2 unstartup systemd
pm2 startup systemd
# jalankan command yang ditampilkan
pm2 save
```

### Memory leak / aplikasi crash

PM2 auto-restart kalau process crash. Cek histori restart:

```bash
pm2 status
# kolom "restart" angkanya tinggi = ada masalah
pm2 logs boxofice-web --err --lines 200
```

Naikkan `max_memory_restart` di `ecosystem.config.cjs` kalau memang butuh memory lebih besar.

### Build error karena Prisma client outdated

```bash
npx prisma generate
npm run build
pm2 restart boxofice-web
```

### Update aplikasi

```bash
cd ~/boxofice
git pull origin main
npm install
npx prisma migrate deploy
npm run build
pm2 restart boxofice-web
pm2 restart boxofice-sync-worker
```

---

## Ringkasan Command Penting

```bash
# Status semua
pm2 status

# Restart web
pm2 restart boxofice-web

# Restart worker
pm2 restart boxofice-sync-worker

# Logs realtime
pm2 logs

# Logs spesifik (50 baris terakhir)
pm2 logs boxofice-web --lines 50

# Reload Nginx setelah edit config
sudo nginx -t && sudo systemctl reload nginx

# Migrasi database
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Trigger sync test manual
npm run sync:worker:once
```

Selesai. App harusnya sudah jalan di `https://domainkamu.com` dengan worker background siap proses sync tanpa timeout.
