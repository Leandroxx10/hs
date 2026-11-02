@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title HS Studio - instalacao para Windows
set "HS_ROOT=%LOCALAPPDATA%\HSStudio"
set "HS_COMMIT=0ff9a8abbf490962837b8f5a3abba43fa09b3404"
set "HS_APP=%HS_ROOT%\hs-%HS_COMMIT%"
set "HS_NODE=%HS_ROOT%\node-v24.19.0-win-x64"
set "HS_NODE_ZIP=%HS_ROOT%\node-v24.19.0-win-x64.zip"
set "HS_SOURCE_ZIP=%HS_ROOT%\hs-%HS_COMMIT%.zip"
set "HS_PUSHED="
set "HS_STAGE=inicializacao"

echo.
echo HS Studio - Windows 10/11 x64
echo Instalacao local em "%HS_ROOT%".
echo O aplicativo e as dependencias serao baixados de suas fontes oficiais.
echo.
where curl.exe >nul 2>nul
if errorlevel 1 (
  echo ERRO: curl.exe nao foi encontrado. Este instalador requer Windows 10/11.
  goto fail
)
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo ERRO: o Windows PowerShell nao foi encontrado.
  goto fail
)
if not exist "%HS_ROOT%" mkdir "%HS_ROOT%"
if not exist "%HS_ROOT%" goto fail

if exist "%HS_APP%\.hs-installed" if exist "%HS_APP%\dist\index.html" if exist "%HS_APP%\node_modules\electron\dist\electron.exe" goto launch

if exist "%HS_NODE%\node.exe" goto source
set "HS_STAGE=download do Node.js"
echo [1/5] Baixando o Node.js portatil verificado...
curl.exe --fail --location --retry 2 --connect-timeout 30 "https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip" --output "%HS_NODE_ZIP%"
if errorlevel 1 goto fail
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; if ((Get-FileHash -LiteralPath $env:HS_NODE_ZIP -Algorithm SHA256).Hash -ne '57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73') { throw 'Checksum do Node.js incorreto. Instalacao interrompida.' }; Expand-Archive -LiteralPath $env:HS_NODE_ZIP -DestinationPath $env:HS_ROOT"
if errorlevel 1 goto fail
if not exist "%HS_NODE%\node.exe" goto fail

:source
if exist "%HS_APP%\package-lock.json" goto install
set "HS_STAGE=download do aplicativo"
echo [2/5] Baixando a versao publicada do HS Studio...
curl.exe --fail --location --retry 2 --connect-timeout 30 "https://codeload.github.com/Leandroxx10/hs/zip/%HS_COMMIT%" --output "%HS_SOURCE_ZIP%"
if errorlevel 1 goto fail
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; if ((Get-FileHash -LiteralPath $env:HS_SOURCE_ZIP -Algorithm SHA256).Hash -ne 'b9c6372311438892360b98fc1e08566589f4ba31123a46a29ffb90ef10d01dab') { throw 'Checksum do aplicativo incorreto. Instalacao interrompida.' }; Expand-Archive -LiteralPath $env:HS_SOURCE_ZIP -DestinationPath $env:HS_ROOT"
if errorlevel 1 goto fail
if not exist "%HS_APP%\package-lock.json" goto fail

:install
set "PATH=%HS_NODE%;%PATH%"
set "npm_config_cache=%HS_ROOT%\npm-cache"
set "ELECTRON_SKIP_BINARY_DOWNLOAD="
set "HS_STAGE=acesso a pasta do aplicativo"
pushd "%HS_APP%"
if errorlevel 1 goto fail
set "HS_PUSHED=1"
if exist "dist\index.html" if exist "node_modules\electron\install.js" goto runtime
set "HS_STAGE=instalacao das dependencias"
echo [3/5] Instalando as dependencias...
call "%HS_NODE%\npm.cmd" ci
if errorlevel 1 goto fail
set "HS_STAGE=compilacao da interface"
echo [4/5] Compilando a interface...
call "%HS_NODE%\npm.cmd" run build
if errorlevel 1 goto fail

:runtime
set "HS_STAGE=instalacao do runtime Electron"
echo [5/5] Instalando o runtime oficial do Electron para Windows...
echo Este download pode levar alguns minutos. Os checksums sao verificados pelo instalador oficial.
"%HS_NODE%\node.exe" "node_modules\electron\install.js"
if errorlevel 1 goto fail
if not exist "node_modules\electron\dist\electron.exe" (
  echo ERRO: o instalador oficial terminou, mas electron.exe nao foi encontrado.
  goto fail
)
> ".hs-installed" echo %HS_COMMIT%
popd
set "HS_PUSHED="

:launch
> "%HS_ROOT%\ABRIR-HS-STUDIO.cmd" echo @echo off
>> "%HS_ROOT%\ABRIR-HS-STUDIO.cmd" echo chcp 65001 ^>nul
>> "%HS_ROOT%\ABRIR-HS-STUDIO.cmd" echo start "" "%HS_APP%\node_modules\electron\dist\electron.exe" "%HS_APP%"
echo.
echo Instalacao concluida. Abrindo o HS Studio...
echo Para abrir novamente: "%HS_ROOT%\ABRIR-HS-STUDIO.cmd"
echo O Hashcat e os drivers da GPU sao configurados separadamente no aplicativo.
set "HS_STAGE=abertura do aplicativo"
start "" "%HS_APP%\node_modules\electron\dist\electron.exe" "%HS_APP%"
if errorlevel 1 goto fail
endlocal
exit /b 0

:fail
if defined HS_PUSHED popd
echo.
echo A instalacao foi interrompida na etapa: %HS_STAGE%.
echo Confira a mensagem de erro acima. Os arquivos ja baixados foram preservados.
endlocal
exit /b 1
