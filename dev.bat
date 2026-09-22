@echo off
title Divvy - Dev Tools
:: Delayed expansion: variables set inside if/for blocks need !VAR!.
setlocal enabledelayedexpansion
:: Run from the .bat's own directory no matter where it was launched from.
cd /d "%~dp0"

:: Firebase project that .env points to. Passed explicitly to every deploy so
:: the CLI's global "current project" can never redirect it elsewhere.
set "FB_PROJECT=divvy-app-e4565"

:menu
cls
echo.
echo  ==========================================
echo        Divvy  Dev Tools
echo  ==========================================
echo.
echo  -- Local Development --
echo   1. Start dev server          (http://localhost:5173)
echo   2. Start dev server on LAN   (test from phone)
echo   3. Type-check + tests
echo   4. Build + preview           (http://localhost:4173)
echo.
echo  -- Production Deploy (%FB_PROJECT%) --
echo   5. Deploy Firestore rules + indexes
echo   6. Deploy frontend (build + hosting)
echo   7. Deploy everything (build + rules + indexes + hosting)
echo.
echo   0. Exit
echo.
set "choice="
set /p choice= Enter option:

if "%choice%"=="1" goto start_dev
if "%choice%"=="2" goto start_dev_lan
if "%choice%"=="3" goto check
if "%choice%"=="4" goto preview
if "%choice%"=="5" goto deploy_rules
if "%choice%"=="6" goto deploy_hosting
if "%choice%"=="7" goto deploy_all
if "%choice%"=="0" goto exit_program
echo.
echo  Invalid option, try again
timeout /t 1 >nul
goto menu

:: ==========================================
:: Local Development
:: ==========================================

:start_dev
cls
echo.
echo  Start dev server
echo  ----------------------------------------
echo  Opening in a new window: http://localhost:5173
echo  If 5173 is busy, Vite picks the next port -- check that window.
echo  Close that window to stop the server.
echo.
echo  Note: the dev server uses the PRODUCTION Firestore from .env.
echo.
start "Divvy Dev Server" cmd /k "cd /d "%~dp0" && npm run dev"
pause
goto menu

:start_dev_lan
cls
echo.
echo  Start dev server on LAN
echo  ----------------------------------------
echo  Opening in a new window. Use the "Network:" URL it prints
echo  from a phone on the same Wi-Fi.
echo  Google sign-in only works if that IP is listed under
echo  Firebase console -^> Authentication -^> Settings -^> Authorized domains.
echo.
start "Divvy Dev Server (LAN)" cmd /k "cd /d "%~dp0" && npm run dev -- --host"
pause
goto menu

:check
cls
echo.
echo  Type-check + tests
echo  ----------------------------------------
echo.
echo  [1/2] vue-tsc --noEmit
call npm run typecheck
if %errorlevel% neq 0 (
    echo.
    echo  [FAILED] Type errors found.
    pause
    goto menu
)
echo.
echo  [2/2] vitest run
call npm run test
if %errorlevel% neq 0 (
    echo.
    echo  [FAILED] Tests failed.
    pause
    goto menu
)
echo.
echo  [DONE] Type-check and tests passed.
pause
goto menu

:preview
cls
echo.
echo  Build + preview
echo  ----------------------------------------
echo.
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [FAILED] Build failed.
    pause
    goto menu
)
echo.
echo  Opening preview in a new window: http://localhost:4173
echo  This serves dist\ exactly as it would be deployed ^(PWA included^).
start "Divvy Preview" cmd /k "cd /d "%~dp0" && npm run preview"
pause
goto menu

:: ==========================================
:: Production Deploy
:: ==========================================

:deploy_rules
cls
echo.
echo  Deploy Firestore rules + indexes
echo  ----------------------------------------
echo  [WARNING] This updates PRODUCTION Firestore rules and indexes.
echo  Target project: %FB_PROJECT%
echo.
set "confirm="
set /p confirm= Continue? (y/N):
if /i not "%confirm%"=="y" (
    echo  Cancelled.
    timeout /t 1 >nul
    goto menu
)
echo.
call firebase deploy --only firestore:rules,firestore:indexes --project %FB_PROJECT%
if %errorlevel% neq 0 (
    echo.
    echo  [FAILED] Rules deploy failed.
    pause
    goto menu
)
echo.
echo  [DONE] Rules and indexes deployed to %FB_PROJECT%.
pause
goto menu

:deploy_hosting
cls
echo.
echo  Deploy frontend (build + hosting)
echo  ----------------------------------------
echo  [WARNING] This updates the PRODUCTION frontend.
echo  Target project: %FB_PROJECT%
echo.
set "confirm="
set /p confirm= Continue? (y/N):
if /i not "%confirm%"=="y" (
    echo  Cancelled.
    timeout /t 1 >nul
    goto menu
)
echo.
echo  [1/2] Building...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed. Nothing was deployed.
    pause
    goto menu
)
echo.
echo  [2/2] Deploying to Firebase Hosting...
call firebase deploy --only hosting --project %FB_PROJECT%
if %errorlevel% neq 0 (
    echo.
    echo  [FAILED] Hosting deploy failed.
    pause
    goto menu
)
echo.
echo  [DONE] Deployed.  https://%FB_PROJECT%.web.app
pause
goto menu

:deploy_all
cls
echo.
echo  Deploy everything
echo  ----------------------------------------
echo  [WARNING] This updates PRODUCTION Firestore rules, indexes and frontend.
echo  Target project: %FB_PROJECT%
echo.
set "confirm="
set /p confirm= Continue? (y/N):
if /i not "%confirm%"=="y" (
    echo  Cancelled.
    timeout /t 1 >nul
    goto menu
)
echo.
echo  [1/2] Building...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed. Nothing was deployed.
    pause
    goto menu
)
echo.
echo  [2/2] Deploying rules, indexes and hosting...
call firebase deploy --only firestore:rules,firestore:indexes,hosting --project %FB_PROJECT%
if %errorlevel% neq 0 (
    echo.
    echo  [FAILED] Deploy failed.
    pause
    goto menu
)
echo.
echo  [DONE] Deployed.  https://%FB_PROJECT%.web.app
pause
goto menu

:: ==========================================
:: Exit
:: ==========================================

:exit_program
exit /b 0
