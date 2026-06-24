@echo off
chcp 65001 > nul
echo ==============================================
echo GitHub Sync Script
echo ==============================================

git add .
powershell -Command "$date=Get-Date -Format 'yyyy-MM-dd HH:mm:ss'; git commit -m \"Auto-sync: $date\""
git push -u origin main

echo.
echo Sync Complete!
pause
