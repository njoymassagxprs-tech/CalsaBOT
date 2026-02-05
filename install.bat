@echo off
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           🤖 CalsaBOT - Instalador Windows                ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

:: Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js nao encontrado!
    echo    Instala em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js encontrado
echo.

:: Instalar dependencias
echo 📦 A instalar dependencias...
call npm install
echo.

:: Verificar .env
if not exist .env (
    echo.
    echo 🔧 Ficheiro .env nao encontrado!
    echo    A iniciar assistente de configuracao...
    echo.
    call npm run setup
) else (
    echo ✅ Ficheiro .env encontrado
    echo.
    set /p RECONFIG="   Queres reconfigurar? (s/n): "
    if /i "%RECONFIG%"=="s" (
        call npm run setup
    )
)

echo.
echo ═══════════════════════════════════════════════════════════
echo ✅ Instalacao concluida!
echo.
echo Para iniciar o CalsaBOT:
echo    npm run cli       - Interface de linha de comandos
echo    npm run telegram  - Bot Telegram
echo    npm run whatsapp  - Bot WhatsApp
echo.
echo ═══════════════════════════════════════════════════════════
pause
