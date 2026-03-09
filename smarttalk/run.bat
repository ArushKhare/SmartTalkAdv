@echo off
echo Starting SmartTalk
echo ================================

REM Check for .env file
if not exist "backend\.env" (
    echo No .env file found in backend\
    echo Create backend\.env with: GOOGLE_API_KEY=your-key-here
    pause
    exit /b 1
)

REM Start backend
echo Starting backend...
cd backend
start /B cmd /c "pip install -r requirements.txt -q && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

REM Wait for backend
timeout /t 5 /nobreak > nul

REM Start frontend
echo Starting frontend...
cd frontend
start /B cmd /c "npm install --silent && npm start"
cd ..

echo.
echo ================================
echo App is running!
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo Press any key to stop...
echo ================================

pause > nul

REM Kill processes
taskkill /F /IM uvicorn.exe 2>nul
taskkill /F /IM node.exe 2>nul
echo Stopped
