@echo off
:: Set legacy provider for Node.js (Fixes ERR_OSSL_EVP_UNSUPPORTED for Angular 7)
set NODE_OPTIONS=--openssl-legacy-provider

echo =======================================================
echo   DanpheEMR Unified Development Starter
echo =======================================================

:: 1. Start Frontend Watcher in a separate window
echo [1/2] Starting Angular Frontend Watcher (Auto-rebuild on save)...
start "Danphe-Frontend-Watch" cmd /k "cd Code\Websites\DanpheEMR\wwwroot\DanpheApp && npm run ng build -- --watch --deploy-url=/DanpheApp/dist/DanpheApp/"

:: 2. Start Backend Watcher in the current window
echo [2/2] Starting .NET Backend (Auto-restart on save)...
cd Code\Websites\DanpheEMR
dotnet watch run

pause
