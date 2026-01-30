@echo off
REM ============================================
REM   NGINX Load Balancer - Quick Commands
REM ============================================

echo.
echo [1] Start NGINX
echo [2] Stop NGINX
echo [3] Restart NGINX
echo [4] View NGINX Logs
echo [5] Reload Config (No Downtime)
echo [6] Check Status
echo [0] Exit
echo.

set /p choice="Enter choice: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto reload
if "%choice%"=="6" goto status
if "%choice%"=="0" exit

:start
echo Starting NGINX...
cd docker-nginx
docker-compose up -d
echo NGINX started!
pause
exit

:stop
echo Stopping NGINX...
cd docker-nginx
docker-compose down
echo NGINX stopped!
pause
exit

:restart
echo Restarting NGINX...
cd docker-nginx
docker-compose restart
echo NGINX restarted!
pause
exit

:logs
echo Showing NGINX logs (Ctrl+C to exit)...
docker logs -f discord-nginx-lb
pause
exit

:reload
echo Reloading NGINX config (no downtime)...
docker exec discord-nginx-lb nginx -s reload
echo Config reloaded!
pause
exit

:status
echo Checking NGINX status...
docker ps | findstr nginx
echo.
curl http://localhost:3000/health
pause
exit
