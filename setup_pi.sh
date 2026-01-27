#!/bin/bash

# SkillPlayer Setup Script for Raspberry Pi

echo "------------------------------------------------"
echo "SkillPlayer Setup"
echo "------------------------------------------------"

# 1. Update System Repositories (Good practice)
echo "[1/4] Updating package lists..."
sudo apt-get update

# 2. Install System Dependencies
# python3-pip: Package manager for Python
# libatlas-base-dev: Often needed for scientific libraries if they get pulled in
echo "[2/4] Installing system dependencies..."
sudo apt-get install -y python3-pip libatlas-base-dev

# 3. Install Python Libraries
# Installing directly to avoid PyInstaller (not needed on Pi) and potential conflicts
echo "[3/4] Installing Python requirements (Flask, Waitress)..."
pip3 install flask waitress --break-system-packages

# Note: --break-system-packages is needed on newer Raspberry Pi OS (Bookworm)
# because they enforce managed environments. For a dedicated Pi app, this is fine.

# 4. Permissions
echo "[4/4] Setting permissions..."
chmod +x ./run_pi.sh

echo "------------------------------------------------"
echo "Setup Complete!"
echo "You can now run the app with: ./run_pi.sh"
echo "------------------------------------------------"
