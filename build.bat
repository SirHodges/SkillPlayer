@echo off
echo ==========================================
echo   SkillPlayer - Build Script
echo ==========================================
echo.

REM Check if Python 3.14 is installed (preferred)
py -3.14 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py -3.14
    goto :FOUND_PYTHON
)

REM Fallback to standard py -3
py -3 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py -3
    goto :FOUND_PYTHON
)

echo ERROR: Python is not installed or not in PATH
pause
exit /b 1

:FOUND_PYTHON
echo Using Python: %PYTHON_CMD%

echo.
echo [1/4] Installing dependencies...
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Building executable with PyInstaller...
REM Using --clean to ensure fresh build
%PYTHON_CMD% -m PyInstaller --noconfirm --clean SkillPlayer.spec

if errorlevel 1 (
    echo ERROR: PyInstaller build failed
    pause
    exit /b 1
)

echo.
echo [3/4] Copying required resources...
REM Manually copy templates and static to ensure they exist
xcopy /E /I /Y templates "dist\SkillPlayer\templates"
xcopy /E /I /Y static "dist\SkillPlayer\static"

echo.
echo [4/4] Creating content folder...
if not exist "dist\SkillPlayer\content" mkdir "dist\SkillPlayer\content"
if not exist "dist\SkillPlayer\content\Sample Skill" mkdir "dist\SkillPlayer\content\Sample Skill"

REM Copy sample PDF if it exists
if exist "content\Sample Skill\test.pdf" copy "content\Sample Skill\test.pdf" "dist\SkillPlayer\content\Sample Skill\test.pdf"

echo.
echo ==========================================
echo   Build Complete!
echo   Output: dist\SkillPlayer\SkillPlayer.exe
echo ==========================================
pause
