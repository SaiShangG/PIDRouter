@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "APP_PACKAGE=@mlightcad/cad-simple-viewer-example"
set "VIEWER_RUNTIME=%PROJECT_DIR%packages\cad-html-plugin\dist\viewer-runtime.iife.js"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found. Please install Node.js 24 or newer.
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pnpm was not found. Please install pnpm 10 or newer.
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

if not exist "%PROJECT_DIR%node_modules" (
    echo Installing frontend dependencies...
    pnpm install --frozen-lockfile
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

if not exist "%VIEWER_RUNTIME%" (
    echo Building frontend workspace dependencies...
    pnpm --filter %APP_PACKAGE%... build
    if errorlevel 1 (
        echo [ERROR] Frontend dependency build failed.
        pause
        exit /b 1
    )
)

set "VITE_PROCESS_ASSISTANT_API_URL=http://localhost:5153"
set "VITE_PROCESS_ASSISTANT_USE_PROXY=true"

echo Starting frontend at http://localhost:5173
echo API proxy target: http://localhost:5153
echo Press Ctrl+C to stop the frontend.
echo.

pnpm --filter %APP_PACKAGE% dev -- --host localhost --port 5173

if errorlevel 1 (
    echo.
    echo [ERROR] Frontend stopped with an error.
    pause
)

endlocal
