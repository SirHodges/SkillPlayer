#!/bin/bash
# Update from GitHub and reboot the Pi

echo "📥 Pulling latest updates from GitHub..."
cd ~/SkillPlayer
git pull origin main

echo "✅ Update complete! Rebooting in 3 seconds..."
sleep 3
sudo reboot
