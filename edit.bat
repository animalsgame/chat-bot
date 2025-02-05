@echo off
echo select file:
echo 1 - app
echo 2 - service
echo enter key - app
set "input=1"
set /p input=
IF %input%==2 (
if exist service.js start notepad service.js
) ELSE (
if exist app.js start notepad app.js
)