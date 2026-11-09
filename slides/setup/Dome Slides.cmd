@echo off
rem Same as the desktop icon, with the server window visible (use this if the icon does nothing).
cd /d "%~dp0.."
node server\server.mjs --launch
if errorlevel 1 pause
