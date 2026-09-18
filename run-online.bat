@echo off
chcp 65001 >nul
echo ====================================================
echo        راه‌اندازی سرور آنلاین بازی فلق (Megagame V4)
echo ====================================================
echo.
echo [1/2] در حال اجرای سرور بازی روی پورت 3000...
start /b node server/index.js

timeout /t 2 /nobreak >nul

echo [2/2] در حال ایجاد تونل آنلاین اینترنتی امن (HTTPS)...
echo.
:loop
echo ====================================================
echo سرور با موفقیت آنلاین شد!
echo آدرس‌های عمومی برای ارسال به بازیکنان در ادامه نمایش داده می‌شود:
echo ====================================================
ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 0:127.0.0.1:3000 0yuUefvYCHS@free.pinggy.io
echo.
echo اتصال منقضی یا قطع شد. اتصال مجدد خودکار در چند ثانیه...
timeout /t 3 /nobreak >nul
goto loop
