@echo off
chcp 65001 >nul 2>&1
cd /d %~dp0
echo ================================
echo   qiangge pin dao tui song
echo ================================
echo.
git add -A
git commit -m "gengxin neirong"
git push
echo.
echo ================================
echo   tui song chenggong! Vercel jiang zidong bushu...
echo   dengdai yue 1-2 fenzhong hou shuaxin wangzhan
echo ================================
pause
