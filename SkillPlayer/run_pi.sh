#!/bin/bash

# Simple launcher for SkillPlayer
# Ensures we are in the correct directory before running

# Get absolute path to this script's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Move to that directory
cd "$DIR"

# Run the app
echo "Starting SkillPlayer..."
python3 app.py
