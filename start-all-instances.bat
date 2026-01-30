@echo off
REM ============================================
REM   Start ALL Backend Realtime Instances
REM ============================================

echo Starting 3 Realtime Instances...
echo.

cd backend-realtime

echo [1/3] Starting Instance 1 (Port 3001)...
start "Realtime Instance 1" cmd /k ".\start-instance-1.bat"
timeout /t 2 /nobreak >nul

echo [2/3] Starting Instance 2 (Port 3011)...
start "Realtime Instance 2" cmd /k ".\start-instance-2.bat"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Instance 3 (Port 3012)...
start "Realtime Instance 3" cmd /k ".\start-instance-3.bat"

echo.
echo ✅ All 3 instances started!
echo.
echo Check the 3 new terminal windows for status
pause
