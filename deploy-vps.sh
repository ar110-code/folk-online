#!/bin/bash
# اسکریپت راه‌اندازی خودکار بازی فلق روی سرور مجازی لینوکس (Ubuntu/Debian VPS)
set -e

echo "============================================="
echo "   راه‌اندازی سرور دائمی بازی فلق (Megagame V4)"
echo "============================================="

# بررسی و نصب Node.js اگر نصب نباشد
if ! command -v node &> /dev/null; then
    echo "[1/4] در حال نصب Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get update && sudo apt-get install -y nodejs
fi

echo "[2/4] در حال نصب وابستگی‌های پروژه..."
npm install --production

# نصب PM2 برای مدیریت دائمی پروسس (۲۴ ساعته و ری‌استارت خودکار)
if ! command -v pm2 &> /dev/null; then
    echo "[3/4] در حال نصب PM2..."
    sudo npm install -g pm2
fi

echo "[4/4] اجرای بازی در پس‌زمینه با PM2..."
pm2 stop falak-game 2>/dev/null || true
pm2 start server/index.js --name "falak-game"
pm2 save

echo "============================================="
echo "✅ بازی با موفقیت روی سرور مستقر شد!"
echo "🌐 پورت بازی: 3000"
echo "برای مشاهده لاگ‌ها: pm2 logs falak-game"
echo "============================================="
