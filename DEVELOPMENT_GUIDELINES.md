# SkillPlayer Development Guidelines

## Project Overview

SkillPlayer is a Flask-based kiosk application for paramedic training. It runs locally on a Raspberry Pi 5 (8GB RAM) in a Chromium browser, serving quiz games and training content (videos/PDFs). No internet connectivity is assumed.

**Key Constraints:**
- Single-user kiosk design (global state is acceptable)
- Must run on both Windows (development) and Raspberry Pi OS (production)
- All data is local (JSON files, no external databases)
- Content folder (content/) is managed separately and should never be modified by code changes

## Architecture

- Backend: Flask with Waitress WSGI server
- Frontend: Vanilla JS Single Page Application in index.html
- Hardware Input: evdev for arcade controls (Linux only)
- Data Persistence: JSON files in data/ directory

## File Structure Rules

SkillPlayer/
├── app.py                  # Main Flask app - routes and API endpoints
├── input_handler.py        # Hardware input (Pi only, uses evdev)
├── leaderboard.py          # Score persistence and ranking logic
├── quiz.py                 # Question loading and game logic
├── static/                 # CSS, images, sound effects
├── templates/
│   └── index.html          # The entire frontend SPA lives here
├── data/                   # Runtime data (JSON files) - auto-generated
└── content/                # DO NOT MODIFY - managed externally
    ├── Skills/
    ├── Equipment/
    └── Other/

**Never modify or reference files in content/ during development.** This folder is updated independently via USB stick.

## Naming Conventions

Follow existing patterns strictly:

- Python variables/functions: snake_case (load_questions, get_leaderboard)
- JavaScript variables/functions: camelCase (selectCategory, startQuiz)
- CSS classes: kebab-case (.video-card, .sidebar-header)
- API endpoints: REST-style, lowercase (/api/skills/<category>)
- Python files: snake_case (input_handler.py)

## Data Formats

### Questions (questions.json)

{
  "question": "What is the correct procedure for...",
  "answers": ["Option A", "Option B", "Option C", "Option D"],
  "correct": "Option A"
}

- correct must exactly match one string in answers
- Questions are stored as an array

### Answer Tracking (quiz_answers.json)

{
  "question_id": 1,
  "answer_selected": 1,
  "correct": true,
  "time_to_answer_ms": 2327,
  "skipped": false,
  "timestamp": "2026-01-23T14:40:06.968Z",
  "streak_count": 0
}

### Leaderboard (scores.json)

- Top 10 scores with 14-day expiry
- Includes detailed stats object per entry

## Coding Standards

### Python

- Use existing Flask app patterns in app.py
- API routes return JSON
- File I/O uses json module with proper error handling
- Path handling must support both frozen (PyInstaller) and script execution
- Use waitress for serving, not Flask's dev server

### JavaScript

- No external frameworks - vanilla JS only
- DOM manipulation for SPA navigation (show/hide containers)
- Fetch API for all backend communication
- Sound effects via HTML5 Audio (Right.mp3, Wrong.mp3)

### CSS

- Dark theme: background #0f0f1a, accent #6c5ce7
- Large touch targets for kiosk use
- Google Fonts: Outfit
- Animations for feedback (pulse, transitions)

## Platform Compatibility

Code must run on both Windows and Raspberry Pi OS:

- evdev imports: Wrap in try/except or platform checks - evdev only works on Linux
- Path separators: Use os.path.join() or pathlib
- Browser launch: Only auto-launch on Windows development

Example pattern:

try:
    import evdev
    EVDEV_AVAILABLE = True
except ImportError:
    EVDEV_AVAILABLE = False

## Deployment Workflow

**Development happens on Windows. Production is Raspberry Pi.**

When changes are complete, prompt the developer with:

1. List of modified/new files (exclude content/ folder)
2. Clear instructions for which files to transfer
3. Target path: ~/SkillPlayer/ on the Pi
4. Any commands needed after transfer (e.g., restart service)

Example deployment summary format:

## Files Changed
- app.py (modified)
- static/style.css (modified)
- quiz.py (new feature)

## Transfer to Pi
Copy these files to ~/SkillPlayer/ maintaining folder structure:
- app.py -> ~/SkillPlayer/app.py
- static/style.css -> ~/SkillPlayer/static/style.css
- quiz.py -> ~/SkillPlayer/quiz.py

## After Transfer
Restart the application:
  cd ~/SkillPlayer && ./run_pi.sh

## Future Features (Reference Only)

- Gamepad support: Two-player competitive modes using USB gamepads. Will likely use pygame or evdev for input. Not yet implemented.
- Game modes in development: Tug-of-war questions, first-to-answer buzzer style

## Testing Checklist

Before marking a feature complete:

1. Test in Windows browser (development)
2. Verify no hardcoded Windows paths
3. Confirm evdev/Linux code is properly guarded
4. Check that content/ folder is not referenced in changes
5. Provide deployment file list
