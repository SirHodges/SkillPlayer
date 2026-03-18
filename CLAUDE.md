# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SkillPlayer is a Flask-based kiosk application for paramedic training, running on Raspberry Pi 5 (production) or Windows (development). It serves two modes via a single-page application:
- **SkillPlayer Mode**: Browse training videos/PDFs organized by skill category
- **Quiz Challenge Mode**: Timed 1-minute quiz game with leaderboard, streaks, and optional 2-player USB gamepad support

No internet connectivity is assumed. All data is local JSON files.

## Running the App

```bash
# Development (Windows)
python app.py

# Production (Raspberry Pi)
./run_pi.sh

# Install dependencies
pip install -r requirements.txt

# Build Windows executable
build.bat
```

## Deployment Workflow

Development happens on Windows; production is Raspberry Pi (`~/SkillPlayer/`). After making changes, provide:
1. List of modified/new files (exclude `content/`)
2. Transfer instructions (`scp` or USB copy to `~/SkillPlayer/` maintaining folder structure)
3. Post-transfer command: `cd ~/SkillPlayer && ./run_pi.sh`

## Architecture

### Backend (`app.py`)
All Flask routes and API endpoints. The `quiz.py`, `leaderboard.py`, `gamepad_handler.py`, and `input_handler.py` modules are imported and wired up here. Runs via Waitress WSGI (not Flask dev server) on both platforms.

### Frontend (`templates/index.html` + `static/app.js`)
The entire SPA lives in `index.html` (structure) and `static/app.js` (~3000 lines, vanilla JS). Navigation is DOM show/hide — there is no router. All backend calls use `fetch`. Sound effects via HTML5 Audio (`Right.mp3`, `Wrong.mp3`).

### Gamepad Support (`gamepad_handler.py`)
USB gamepad detection via `evdev` (Linux only). Integrated via Flask-SocketIO for real-time input events. Always wrapped in `try/except ImportError` since `evdev` is unavailable on Windows.

### Data Persistence
All state in JSON files — no database:
- `questions.json` — question bank (`[{question, answers[], correct}]`)
- `scores.json` — top 10 leaderboard with 14-day expiry
- `data/question_history.json` — MD5-hash-based question tracking
- `quiz_answers.json` — per-answer stats for review/calibration

### Content Folder
`content/` is managed externally via USB stick and **must never be modified or referenced by code changes**. It holds the actual video/PDF training files.

## Key Constraints

- **Single-user kiosk**: Global state is acceptable throughout the codebase
- **Platform compat**: `evdev` and other Linux-only imports must be wrapped in `try/except`; use `pathlib` or `os.path.join` for all paths
- **No external frameworks**: Vanilla JS only in the frontend
- **PyInstaller support**: Path handling in Python must work both frozen (`sys._MEIPASS`) and as a script

## Coding Conventions

- Python: `snake_case` for variables/functions
- JavaScript: `camelCase` for variables/functions
- CSS classes: `kebab-case`
- API endpoints: lowercase REST-style (`/api/skills/<category>`)
- Dark theme colors: background `#0f0f1a`, accent `#6c5ce7`
- Font: Google Fonts — Outfit

## Pre-deployment Checklist

1. Test in Windows browser
2. No hardcoded Windows paths
3. All `evdev`/Linux code guarded with `try/except`
4. `content/` folder not referenced in changes
