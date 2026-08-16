@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Progresso Mudanca de Infra MIT 2026
echo  Iniciando servidor local...
echo ============================================
echo.

set PORT=8000

REM tenta abrir o navegador depois de 2 segundos (da tempo do servidor subir)
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%/"

REM tenta com Python primeiro (a maioria dos PCs Windows ja tem)
where python >nul 2>nul
if %errorlevel%==0 (
    echo Usando Python...
    python -m http.server %PORT%
    goto :fim
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    echo Usando Python3...
    python3 -m http.server %PORT%
    goto :fim
)

REM se nao tiver Python, tenta com Node.js (npx http-server)
where npx >nul 2>nul
if %errorlevel%==0 (
    echo Python nao encontrado. Usando Node.js...
    npx --yes http-server -p %PORT%
    goto :fim
)

echo.
echo ERRO: Nao encontrei Python nem Node.js instalado neste computador.
echo Instale o Python em https://www.python.org/downloads/ (marque a opcao
echo "Add Python to PATH" durante a instalacao) e rode este arquivo de novo.
echo.
pause

:fim
endlocal
