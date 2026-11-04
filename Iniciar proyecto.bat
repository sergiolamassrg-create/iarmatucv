@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo No se encontro npm. Instala Node.js y vuelve a intentarlo.
    pause
    exit /b 1
)

start "iArmatuCV - Back End" /d "%~dp0" cmd.exe /k "npm.cmd run backend:dev"
start "iArmatuCV - Front End" /d "%~dp0" cmd.exe /k "npm.cmd run frontend:dev"

echo Proyecto iniciado en dos ventanas.
echo Abri http://127.0.0.1:4200/ cuando el frontend termine de compilar.
echo Para detenerlo, usa Ctrl+C en cada ventana.
