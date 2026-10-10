@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM 本机 HTTP 代理：直连 GitHub 推送失败（常见报错 SSL_ERROR_SYSCALL）时用它重试一次。
REM 不需要就留空：set "PUSH_PROXY="
set "PUSH_PROXY=http://127.0.0.1:7897"
REM 文档站仓库（KTBOY/sh-design）的本地路径，仅用于发版后打印同步待办；不存在则只指向 RELEASING.md。
set "DOCS_DIR=D:\my\git\sh-ui"

echo ==========================================
echo    sk-chart 提交 / 发布助手
echo ==========================================
echo.

REM ---------- 0. 环境检查：Node >= 18 ----------
node -e "process.exit(Number(process.versions.node.split('.')[0])>=18?0:1)" 2>nul
if errorlevel 1 (
  echo [错误] Node 版本过低：需要 Node ^>= 18，请先切换 Node 版本。
  goto :fail
)

REM ---------- 1. 读取当前版本号 ----------
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set VER=%%v
echo 当前版本：v%VER%
echo 提示：发新版请先手动改 package.json 的 version，本脚本据此打 tag。
echo.

REM ---------- 2. 本地验证（与 CI / prepublishOnly 同款，全过再提交）----------
echo [1/4] typecheck...
call npm run typecheck || goto :fail
echo [2/4] lint...
call npm run lint || goto :fail
echo [3/4] test...
call npm test || goto :fail
echo [4/4] build...
call npm run build || goto :fail
echo.
echo 全部检查通过。
echo.

REM ---------- 3. 提交并推送 ----------
REM 先暂存全部改动；若没有新改动（如上次已 commit 但未 push）则跳过提交直接推送
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo 没有新改动需要提交，直接推送本地已有提交...
  goto :push
)
echo 即将提交以下改动，git add -A 已包含所有新文件：
echo ------------------------------------------
git status --short
echo ------------------------------------------
choice /m "确认全部加入并提交推送吗？请先确认上面没有不想提交的临时文件"
if errorlevel 2 goto :end

set /p MSG=请输入提交信息: 
if "%MSG%"=="" set MSG=chore: update

git commit -m "%MSG%" || goto :fail
:push
call :push_ref main || goto :fail
echo.
echo 已推送。CI 会自动跑门禁（typecheck / lint / test / build）：
echo   https://github.com/KTBOY/sk-chart-duo/actions
echo.

REM ---------- 4. 可选：打 tag 发版到 npm ----------
choice /m "是否发版？打 tag v%VER% 并发布 npm"
if errorlevel 2 goto :end

git rev-parse "v%VER%" >nul 2>&1
if not errorlevel 1 (
  echo [错误] tag v%VER% 已存在。请先在 package.json 升版本号后重新运行。
  goto :fail
)

git tag -a "v%VER%" -m "v%VER%"
call :push_ref v%VER% || goto :fail
echo.
echo tag v%VER% 已推送。npm 侧全自动：
echo   CI 构建通过后经 OIDC 可信发布到 npm（免验证码），成功后自动创建 GitHub Release。
start "" "https://github.com/KTBOY/sk-chart-duo/actions/workflows/publish-npm.yml"
echo.
echo ==========================================
echo    还差一步：文档站不会自动更新
echo ==========================================
echo   sk-chart 与文档站是两个仓库，唯一的连接点是 npm 版本号。等流水线变绿后手动跑：
echo.
if exist "%DOCS_DIR%\pnpm-workspace.yaml" (
  echo     cd /d "%DOCS_DIR%"
  echo     pnpm --filter @sh-design/docs add sk-chart-duo@^^%VER%
  echo     pnpm docs:build
  echo     提交 docs/package.json、pnpm-lock.yaml、pnpm-workspace.yaml 与改动的 md，push main 即上线 Pages
  echo.
  echo   别用 pnpm update：它会「跑成功」却仍装旧版本，原因见 RELEASING.md「文档站同步」。
) else (
  echo   未找到文档站本地目录 %DOCS_DIR%，完整步骤见 RELEASING.md「文档站同步（发版后必做）」。
)
goto :end

:fail
echo.
echo [中断] 请查看上方报错，修复后重新运行本脚本。
pause
exit /b 1

:end
echo.
echo 完成。
pause
endlocal
exit /b 0

REM ---------- 子程序：推送，直连失败则走本机代理重试一次 ----------
REM 用法：call :push_ref main   /   call :push_ref v0.1.1
:push_ref
git push origin %~1
if not errorlevel 1 exit /b 0
if "%PUSH_PROXY%"=="" (
  echo [错误] 推送失败，且 PUSH_PROXY 未配置，无法走代理重试。
  exit /b 1
)
echo [提示] 直连推送失败（常见为 SSL_ERROR_SYSCALL），改用本机代理 %PUSH_PROXY% 重试...
git -c http.proxy=%PUSH_PROXY% -c https.proxy=%PUSH_PROXY% push origin %~1
if not errorlevel 1 exit /b 0
echo [错误] 走代理仍失败，请确认 %PUSH_PROXY% 上有代理在监听，或把 PUSH_PROXY 留空后自行排查网络。
exit /b 1
