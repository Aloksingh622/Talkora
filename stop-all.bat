@echo off
REM ============================================
REM   Stop All Discord Services
REM ============================================

echo Stopping all services...
echo.

echo [1/3] Stopping NGINX Load Balancer...
cd docker-nginx
docker-compose down
cd ..

echo.
echo [2/3] Stopping Kafka...
cd docker-kafka
docker-compose down
cd ..

echo.
echo [3/3] Press Ctrl+C in all terminal windows to stop:
echo    - backend-api
echo    - backend-consumer
echo    - backend-realtime instances (all 3)
echo    - frontend
echo.

echo ✅ Docker services stopped!
echo.
pause
