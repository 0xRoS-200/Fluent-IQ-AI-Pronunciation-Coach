@echo off
echo ===================================================
echo   FluentIQ - AI Pronunciation Coach Startup Script
echo ===================================================

:: Check if .env file exists, create a default template if not
if not exist .env (
    echo [WARNING] .env file not found!
    echo Creating a template .env file. Please edit it with your GROQ_API_KEY.
    echo GROQ_API_KEY=your_groq_api_key_here > .env
    echo WHISPER_MODEL=base >> .env
    pause
    exit /b
)

:: Verify virtual environment exists and activate it
if exist venv\Scripts\activate.bat (
    echo Activating virtual environment (venv)...
    call venv\Scripts\activate.bat
) else (
    echo [WARNING] Virtual environment (venv) was not found in the workspace root.
    echo Will attempt to run using system Python. Make sure dependencies from requirements.txt are installed.
)

:: Wait 2 seconds and open the browser
echo Launching http://localhost:8000 in your default browser...
timeout /t 2 >nul
start http://localhost:8000

:: Run the FastAPI backend service
echo Starting backend service (uvicorn)...
python -m uvicorn backend.main:app --reload --port 8000

pause
