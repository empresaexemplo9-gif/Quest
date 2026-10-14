@echo off
setlocal
set "PSModulePath=%SystemRoot%\System32\WindowsPowerShell\v1.0\Modules;%ProgramFiles%\WindowsPowerShell\Modules"
set "ERIDAN_CLIENT=%~dp0public\downloads\Quest-Ragnarok-Setup.exe"
if not exist "%ERIDAN_CLIENT%" set "ERIDAN_CLIENT=%~dp0Quest-Ragnarok.exe"
if not exist "%ERIDAN_CLIENT%" (
 echo Cliente do Eridan nao encontrado. Baixe o pacote Jogador da central.
 pause
 exit /b 1
)
start "" "%ERIDAN_CLIENT%" --portable --data-dir "%~dp0Cliente" --assets-dir "%~dp0Dados" --port 38779 --follow-portal
