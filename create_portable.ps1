# SkillPlayer Portable Builder
# Uses official Python Embeddable Package (Signed) to avoid AV issues

$Output = "dist_signed\SkillPlayer"
$PythonUrl = "https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip"
$ZipFile = "python-embed.zip"

# 1. Clean and Create output directory
Write-Host "Cleaning output directory..."
if (Test-Path $Output) { Remove-Item $Output -Recurse -Force }
New-Item -ItemType Directory -Path "$Output\bin" -Force | Out-Null
New-Item -ItemType Directory -Path "$Output\content" -Force | Out-Null

# 2. Download Python Embeddable
Write-Host "Downloading Python Embeddable Package..."
Invoke-WebRequest -Uri $PythonUrl -OutFile $ZipFile

# 3. Extract Python
Write-Host "Extracting Python..."
Expand-Archive -Path $ZipFile -DestinationPath "$Output\bin" -Force
Remove-Item $ZipFile

# 4. Configure Python to support site-packages (Enable 'import site')
# By default, python39._pth has 'import site' commented out. We need to uncomment it.
$PthFile = "$Output\bin\python39._pth"
$Content = Get-Content $PthFile
$Content[-1] = "import site"  # Replace the last line (usually '#import site') or just add it
$Content | Set-Content $PthFile

# 5. Install Pip (Get-pip.py)
Write-Host "Downloading get-pip.py..."
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile "$Output\bin\get-pip.py"

Write-Host "Installing pip..."
& "$Output\bin\python.exe" "$Output\bin\get-pip.py" --no-warn-script-location

# 6. Install Dependencies
Write-Host "Installing dependencies (Flask, Waitress)..."
& "$Output\bin\python.exe" -m pip install flask waitress --no-warn-script-location

# 7. Copy App Files
Write-Host "Copying application files..."
Copy-Item "app.py" -Destination $Output
Copy-Item "templates" -Destination $Output -Recurse
Copy-Item "static" -Destination $Output -Recurse

# 8. Copy Content (Videos)
Write-Host "Copying content..."
if (Test-Path "content") {
    Copy-Item "content\*" -Destination "$Output\content" -Recurse
}

# 9. Create Launcher
Write-Host "Creating launcher..."
$LauncherContent = @"
@echo off
cd /d "%~dp0"
bin\python.exe app.py
"@
Set-Content -Path "$Output\Start_SkillPlayer.bat" -Value $LauncherContent

Write-Host "Done! Portable app is in: $Output"
