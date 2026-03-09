@echo off
setlocal

echo ============================================
echo   SVG Art Designer - Development Server
echo ============================================
echo.

REM Navigate to project root (parent of scripts/)
cd /d "%~dp0.."

REM Check for Go
where go >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Go is not installed or not in PATH.
    echo         Download from https://go.dev/dl/
    pause
    exit /b 1
)

REM Check for Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download from https://nodejs.org
    pause
    exit /b 1
)

REM Install frontend dependencies if needed
if not exist "node_modules" (
    echo [FRONTEND] Installing npm dependencies...
    call npm install
    echo.
)

REM Tidy Go modules if needed
if not exist "backend\go.sum" (
    echo [BACKEND] Tidying Go modules...
    pushd backend
    go mod tidy
    popd
    echo.
)

echo [BACKEND]  Starting Go server on :8080 ...
start "SVG-Art-Designer Backend" cmd /c "cd backend && go run ./cmd/server"

REM Give the backend a moment to start
timeout /t 2 /nobreak >nul

echo [FRONTEND] Starting Vite dev server on :3000 ...
start "SVG-Art-Designer Frontend" cmd /c "npm run dev"

echo.
echo ============================================
echo   Both servers starting in new windows:
echo     Backend:  http://localhost:8080
echo     Frontend: http://localhost:3000
echo ============================================
echo.
echo Close the terminal windows to stop the servers.
echo Press any key to exit this launcher...
pause >nul
