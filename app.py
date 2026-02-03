"""
SkillPlayer - Portable Video Learning Application
A Flask app that displays skills and videos from a folder structure.
Now includes integrated Quiz Game functionality.
"""

import os
import sys
import json
import time
import webbrowser
import threading
from pathlib import Path
from flask import Flask, render_template, jsonify, send_file, abort, request
import platform

# Try to import Flask-SocketIO (optional, for gamepad support)
try:
    from flask_socketio import SocketIO
    SOCKETIO_AVAILABLE = True
except ImportError:
    SOCKETIO_AVAILABLE = False
    print("[Info] flask-socketio not installed. Gamepad support disabled.")

from quiz import load_questions, get_random_questions
from leaderboard import get_leaderboard, add_score, is_top_score, save_scores

# Determine base path (works for both dev and PyInstaller exe)
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    BASE_DIR = Path(sys.executable).parent
else:
    # Running as script
    BASE_DIR = Path(__file__).parent

CONTENT_DIR = BASE_DIR / "content"
VIEWS_FILE = BASE_DIR / "views.json"
ANSWERS_FILE = BASE_DIR / "quiz_answers.json"

app = Flask(__name__, 
            template_folder=str(BASE_DIR / "templates"),
            static_folder=str(BASE_DIR / "static"))

# Initialize SocketIO if available
if SOCKETIO_AVAILABLE:
    # Force threading mode since we're using standard Flask/Waitress
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
else:
    socketio = None

# Gamepad handler reference (set at runtime)
gamepad_handler = None

# SocketIO event handlers for gamepad session control
if SOCKETIO_AVAILABLE and socketio:
    @socketio.on('start_gamepad_binding')
    def handle_start_binding(data=None):
        """Frontend requests to enter binding mode."""
        player_count = 1
        if data and 'player_count' in data:
            player_count = data['player_count']

        global gamepad_handler
        if gamepad_handler:
            # Start binding for Player 1 (multi=True if 2 players)
            gamepad_handler.start_binding_mode('P1', multi=(player_count > 1))
            
            count = len(gamepad_handler.active_listeners)
            print(f"[SocketIO] Binding mode started for {player_count} player(s). Devices found: {count}")
            socketio.emit('binding_status', {
                'status': 'listening_p1', 
                'device_count': count,
                'message': f'Waiting for Player 1...'
            })
        else:
            print("[SocketIO] Gamepad handler not availble")
            socketio.emit('binding_status', {
                'status': 'error', 
                'message': 'Gamepad support not available (check logs)'
            })
    
    @socketio.on('end_gamepad_session')
    def handle_end_session():
        """Frontend requests to end the session."""
        global gamepad_handler
        if gamepad_handler:
            gamepad_handler.end_session()
            print("[SocketIO] Gamepad session ended")

# Supported extensions
SUPPORTED_EXTENSIONS = {
    # Video
    '.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.m4v',
    # Documents
    '.pdf'
}

# New content threshold (14 days in seconds)
NEW_CONTENT_DAYS = 14
NEW_CONTENT_THRESHOLD = NEW_CONTENT_DAYS * 24 * 60 * 60

# Content categories
CATEGORIES = ['Skills', 'Equipment', 'Other']


def is_new_file(file_path):
    """Check if a file was modified within the NEW_CONTENT_THRESHOLD."""
    try:
        mtime = file_path.stat().st_mtime
        age = time.time() - mtime
        return age < NEW_CONTENT_THRESHOLD
    except OSError:
        return False


def get_skills(category='Skills'):
    """Get list of skill folders from a category directory."""
    category_dir = CONTENT_DIR / category
    if not category_dir.exists():
        category_dir.mkdir(parents=True, exist_ok=True)
        return []
    
    skills = []
    for item in sorted(category_dir.iterdir()):
        if item.is_dir() and not item.name.startswith('.'):
            # Check for logo
            logo_file = None
            for ext in ['.jpg', '.jpeg', '.png']:
                potential_logo = item / f"{item.name}{ext}"
                if potential_logo.exists():
                    logo_file = create_logo_filename(item.name, ext)
                    break
            
            # Check if any files in this skill are new
            has_new_content = False
            for f in item.iterdir():
                if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS:
                    if is_new_file(f):
                        has_new_content = True
                        break
            
            skills.append({
                'id': item.name,
                'name': item.name,
                'path': str(item),
                'logo': logo_file,
                'is_new': has_new_content,
                'category': category
            })
    return skills

def create_logo_filename(skill_name, ext):
    """Helper to create consistent logo filename for frontend."""
    return f"{skill_name}{ext}"


def get_videos_for_skill(category, skill_name):
    """Get list of files (videos/pdfs) in a skill folder."""
    skill_path = CONTENT_DIR / category / skill_name
    if not skill_path.exists() or not skill_path.is_dir():
        return []
    
    files = []
    for item in sorted(skill_path.iterdir()):
        if item.is_file() and item.suffix.lower() in SUPPORTED_EXTENSIONS:
            # Create a nice display name from filename
            display_name = item.stem.replace('_', ' ').replace('-', ' ')
            
            # Determine type
            file_type = 'pdf' if item.suffix.lower() == '.pdf' else 'video'
            
            files.append({
                'id': item.name,
                'name': display_name,
                'filename': item.name,
                'skill': skill_name,
                'category': category,
                'type': file_type,
                'is_new': is_new_file(item)
            })
    return files


@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')


@app.route('/api/categories')
def api_categories():
    """API endpoint to get available categories with new status."""
    result = []
    for cat in CATEGORIES:
        skills = get_skills(cat)
        has_new = any(s.get('is_new', False) for s in skills)
        result.append({'name': cat, 'is_new': has_new})
    return jsonify(result)


@app.route('/api/skills')
@app.route('/api/skills/<category>')
def api_skills(category='Skills'):
    """API endpoint to get skills for a category."""
    if category not in CATEGORIES:
        category = 'Skills'
    return jsonify(get_skills(category))


@app.route('/api/skills/<category>/<skill_name>/videos')
def api_skill_videos(category, skill_name):
    """API endpoint to get content for a specific skill."""
    videos = get_videos_for_skill(category, skill_name)
    return jsonify(videos)


# ========================================
# View Tracking Functions
# ========================================

def load_views():
    """Load view counts from JSON file."""
    if VIEWS_FILE.exists():
        try:
            with open(VIEWS_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_views(views):
    """Save view counts to JSON file."""
    try:
        with open(VIEWS_FILE, 'w') as f:
            json.dump(views, f, indent=2)
    except IOError:
        pass


def increment_view(skill_name, filename):
    """Increment view count for a specific file."""
    views = load_views()
    key = f"{skill_name}/{filename}"
    views[key] = views.get(key, 0) + 1
    save_views(views)
    return views[key]


def get_total_views():
    """Get total view count across all files."""
    views = load_views()
    return sum(views.values())


@app.route('/api/views/increment', methods=['POST'])
def api_increment_view():
    """API endpoint to increment view count."""
    data = request.get_json()
    skill = data.get('skill', '')
    filename = data.get('filename', '')
    if skill and filename:
        count = increment_view(skill, filename)
        return jsonify({'count': count, 'total': get_total_views()})
    return jsonify({'error': 'Missing skill or filename'}), 400


@app.route('/api/views/total')
def api_total_views():
    """API endpoint to get total views."""
    return jsonify({'total': get_total_views()})


@app.route('/video/<category>/<skill_name>/<filename>')
def serve_file(category, skill_name, filename):
    """Serve a video, PDF, or image file."""
    file_path = CONTENT_DIR / category / skill_name / filename
    
    if not file_path.exists():
        abort(404)
    
    # Determine MIME type
    ext = file_path.suffix.lower()
    mime_types = {
        # Videos
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.m4v': 'video/x-m4v',
        # Documents
        '.pdf': 'application/pdf',
        # Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    }
    
    return send_file(
        file_path,
        mimetype=mime_types.get(ext, 'application/octet-stream')
    )


# ========================================
# Quiz Game API Routes
# ========================================

# Store active quiz game sessions (simple in-memory for single player)
current_quiz_game = {
    "questions": [],
    "current_index": 0,
    "score": 0
}


@app.route('/api/quiz/start', methods=['GET'])
def quiz_start_game():
    """Start a new quiz game with random questions."""
    questions = load_questions()
    game_questions = get_random_questions(questions, len(questions))
    
    # Store game state
    current_quiz_game["questions"] = game_questions
    current_quiz_game["current_index"] = 0
    current_quiz_game["score"] = 0
    
    # Return questions without correct answer info to client
    client_questions = [
        {
            "question": q["question"],
            "answers": q["answers"]
        }
        for q in game_questions
    ]
    
    response = jsonify({
        "success": True,
        "questions": client_questions,
        "total": len(client_questions)
    })
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# ========================================
# Quiz Answer Tracking Functions
# ========================================

def load_answers():
    """Load quiz answers from JSON file."""
    if ANSWERS_FILE.exists():
        try:
            with open(ANSWERS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_answer(answer_data):
    """Append a quiz answer record to the JSON file."""
    answers = load_answers()
    answers.append(answer_data)
    try:
        with open(ANSWERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(answers, f, indent=2)
    except IOError:
        pass


@app.route('/api/quiz/answer', methods=['POST'])
def quiz_check_answer():
    """Check an answer and return result."""
    data = request.get_json()
    question_index = data.get('question_index', 0)
    answer_index = data.get('answer_index', -1)
    time_to_answer_ms = data.get('time_to_answer_ms', 0)
    streak_count = data.get('streak_count', 0)
    timestamp = data.get('timestamp', '')
    
    if question_index >= len(current_quiz_game["questions"]):
        return jsonify({"success": False, "error": "Invalid question"})
    
    question = current_quiz_game["questions"][question_index]
    is_correct = answer_index == question["correct_index"]
    
    if is_correct:
        current_quiz_game["score"] += 1
    
    # Save answer tracking data
    # Use the hash ID if available, otherwise fallback to index (shouldn't happen with new logic)
    question_id = question.get("id", question_index)
    
    save_answer({
        "question_id": question_id,
        "answer_selected": answer_index,
        "correct": is_correct,
        "time_to_answer_ms": time_to_answer_ms,
        "skipped": False,
        "timestamp": timestamp,
        "streak_count": streak_count
    })
    
    return jsonify({
        "success": True,
        "correct": is_correct,
        "correct_index": question["correct_index"],
        "score": current_quiz_game["score"]
    })


@app.route('/api/quiz/leaderboard', methods=['GET'])
def quiz_get_scores():
    """Get the current quiz leaderboard."""
    return jsonify({
        "success": True,
        "scores": get_leaderboard()
    })


@app.route('/api/quiz/score', methods=['POST'])
def quiz_submit_score():
    """Submit a final quiz score."""
    data = request.get_json()
    score = data.get('score', 0)
    name = data.get('name', 'ANON')
    stats = data.get('stats', {})  # Get optional stats
    
    # Check if it's a top score
    if is_top_score(score):
        updated_scores = add_score(name, score, stats)
        return jsonify({
            "success": True,
            "is_top_score": True,
            "scores": updated_scores
        })
    
    return jsonify({
        "success": True,
        "is_top_score": False,
        "scores": get_leaderboard()
    })


@app.route('/api/quiz/check_top_score', methods=['POST'])
def quiz_check_top_score():
    """Check if a score qualifies for the leaderboard."""
    data = request.get_json()
    score = data.get('score', 0)
    
    return jsonify({
        "success": True,
        "is_top_score": is_top_score(score)
    })


@app.route('/api/quiz/nuke', methods=['POST'])
def quiz_nuke_leaderboard():
    """Secret endpoint to clear the entire leaderboard."""
    save_scores([])  # Clear all scores
    return jsonify({
        "success": True,
        "scores": []
    })


@app.route('/api/quiz/skip', methods=['POST'])
def quiz_track_skip():
    """Track question skips for difficulty analysis."""
    data = request.get_json()
    question_text = data.get('question', '')
    question_index = data.get('question_index', 0)
    time_to_answer_ms = data.get('time_to_answer_ms', 0)
    streak_count = data.get('streak_count', 0)
    timestamp = data.get('timestamp', '')
    
    # Get question ID from current game state if possible
    question_id = question_index
    if question_index < len(current_quiz_game["questions"]):
        question = current_quiz_game["questions"][question_index]
        question_id = question.get("id", question_index)

    # Save skip as answer tracking data
    save_answer({
        "question_id": question_id,
        "answer_selected": -1,
        "correct": False,
        "time_to_answer_ms": time_to_answer_ms,
        "skipped": True,
        "timestamp": timestamp,
        "streak_count": streak_count
    })
    
    # Return success (skip tracking is now handled solely by save_answer)
    return jsonify({
        "success": True,
        "message": "Skip recorded"
    })


# ========================================
# Calibration Mode API Routes
# ========================================

# Store active calibration session
calibration_session = {
    "active": False,
    "level": 0,
    "questions": [],
    "current_index": 0
}

QUESTIONS_FILE = BASE_DIR / "questions.json"


@app.route('/api/quiz/calibration/counts', methods=['GET'])
def calibration_counts():
    """Get count of questions at each calibration level."""
    all_questions = load_all_questions()
    
    # Count questions at each level (0-5)
    counts = {i: 0 for i in range(6)}
    for q in all_questions:
        level = q.get("calibration_level", 0)
        if level in counts:
            counts[level] += 1
        else:
            counts[0] += 1  # Default to 0 if invalid
    
    return jsonify({
        "success": True,
        "counts": counts,
        "total": len(all_questions)
    })


def load_all_questions():
    """Load all questions from the JSON file."""
    if QUESTIONS_FILE.exists():
        try:
            with open(QUESTIONS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_all_questions(questions):
    """Save all questions back to the JSON file."""
    try:
        with open(QUESTIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)
        return True
    except IOError:
        return False


def get_question_by_text(questions, question_text):
    """Find a question in the list by its text."""
    for q in questions:
        if q.get("question") == question_text:
            return q
    return None


@app.route('/api/quiz/calibration/start', methods=['POST'])
def calibration_start():
    """Start a calibration session with a specific level."""
    data = request.get_json()
    level = data.get('level', 1)
    
    if level < 1 or level > 5:
        return jsonify({"success": False, "error": "Invalid level. Must be 1-5."})
    
    # Load all questions and filter by calibration_level < selected level
    all_questions = load_all_questions()
    eligible_questions = [
        q for q in all_questions 
        if q.get("calibration_level", 0) < level
    ]
    
    if len(eligible_questions) == 0:
        return jsonify({
            "success": False,
            "error": "There are no questions to calibrate at this level"
        })
    
    # Shuffle questions
    import random
    random.shuffle(eligible_questions)
    
    # Prepare questions with shuffled answers
    prepared = []
    for q in eligible_questions:
        answers = q["answers"].copy()
        correct_answer = q["correct"]
        random.shuffle(answers)
        prepared.append({
            "question": q["question"],
            "answers": answers,
            "correct_index": answers.index(correct_answer),
            "original_question": q  # Keep reference for updates
        })
    
    # Store session
    calibration_session["active"] = True
    calibration_session["level"] = level
    calibration_session["questions"] = prepared
    calibration_session["current_index"] = 0
    
    # Return questions for frontend
    client_questions = [
        {"question": q["question"], "answers": q["answers"]}
        for q in prepared
    ]
    
    return jsonify({
        "success": True,
        "level": level,
        "questions": client_questions,
        "total": len(client_questions)
    })


@app.route('/api/quiz/calibration/answer', methods=['POST'])
def calibration_answer():
    """Process a calibration answer - only returns correctness, does NOT update file."""
    if not calibration_session["active"]:
        return jsonify({"success": False, "error": "No active calibration session"})
    
    data = request.get_json()
    question_index = data.get('question_index', 0)
    answer_index = data.get('answer_index', -1)
    
    if question_index >= len(calibration_session["questions"]):
        return jsonify({"success": False, "error": "Invalid question index"})
    
    question = calibration_session["questions"][question_index]
    is_correct = answer_index == question["correct_index"]
    
    return jsonify({
        "success": True,
        "correct": is_correct,
        "correct_index": question["correct_index"]
    })


@app.route('/api/quiz/calibration/submit', methods=['POST'])
def calibration_submit():
    """Submit calibration result - updates level and flags."""
    if not calibration_session["active"]:
        return jsonify({"success": False, "error": "No active calibration session"})
    
    data = request.get_json()
    question_index = data.get('question_index', 0)
    flag_type = data.get('flag_type', None) # 'confusing', 'outdated', 'difficult', 'wrong', or None
    
    if question_index >= len(calibration_session["questions"]):
        return jsonify({"success": False, "error": "Invalid question index"})
    
    question = calibration_session["questions"][question_index]
    
    all_questions = load_all_questions()
    source_question = get_question_by_text(all_questions, question["question"])
    
    if source_question:
        # Migration: Ensure New Structure
        if "flags" not in source_question:
            source_question["flags"] = {
                "confusing": 0,
                "outdated": 0,
                "difficult": 0,
                "wrong": 0
            }
            # Migrate old review_count if exists (mapped to 'wrong' as fallback or kept separate? User said remove)
            if "review_count" in source_question:
                # Optional: mapped old review count to 'wrong' or just discard. 
                # Discarding as per "Remove the old review_count field"
                del source_question["review_count"]
                
        if "tags" not in source_question:
            source_question["tags"] = []

        # Update Flag
        if flag_type and flag_type in source_question["flags"]:
            source_question["flags"][flag_type] += 1
            
        # Update Level
        source_question["calibration_level"] = calibration_session["level"]
        
        save_all_questions(all_questions)
    
    return jsonify({
        "success": True,
        "message": "Calibration submitted"
    })


@app.route('/api/quiz/calibration/end', methods=['POST'])
def calibration_end():
    """End the calibration session."""
    calibration_session["active"] = False
    calibration_session["level"] = 0
    calibration_session["questions"] = []
    calibration_session["current_index"] = 0
    
    return jsonify({
        "success": True,
        "message": "Calibration session ended"
    })



# ========================================
# System Management API Routes
# ========================================

@app.route('/api/system/update', methods=['POST'])
def system_update_and_reboot():
    """Trigger git pull and reboot (Linux/Pi only)."""
    import subprocess
    if platform.system() != 'Linux':
        return jsonify({
            "success": False,
            "error": "Update only available on Raspberry Pi"
        }), 400
    
    try:
        # Run the update script in background
        script_path = BASE_DIR / "update_and_reboot.sh"
        if script_path.exists():
            subprocess.Popen(['bash', str(script_path)], 
                           cwd=str(BASE_DIR),
                           start_new_session=True)
            return jsonify({"success": True, "message": "Update started, rebooting..."})
        else:
            return jsonify({"success": False, "error": "Update script not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def open_browser():
    """Open the browser after a short delay."""
    webbrowser.open('http://127.0.0.1:5000')


if __name__ == '__main__':
    # Create content directory if it doesn't exist
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"SkillPlayer starting...")
    print(f"Process ID: {os.getpid()}")
    print(f"Content folder: {CONTENT_DIR}")
    print(f"Add skill folders with videos to: {CONTENT_DIR}")
    print()
    
    # Start gamepad handler on Linux if SocketIO is available
    if platform.system() == 'Linux' and SOCKETIO_AVAILABLE:
        try:
            from gamepad_handler import start_gamepad_handler
            gamepad_handler = start_gamepad_handler(socketio)
            if gamepad_handler:
                print("[Gamepad] Handler started")
        except Exception as e:
            print(f"[Gamepad] Could not start handler: {e}")
    
    # Open browser after a short delay
    threading.Timer(1.5, open_browser).start()
    
    # Use SocketIO if available, otherwise fallback to waitress/Flask
    if SOCKETIO_AVAILABLE and socketio:
        print("Starting server with SocketIO at http://127.0.0.1:5000")
        print("Press Ctrl+C to stop")
        socketio.run(app, host='127.0.0.1', port=5000, debug=False, allow_unsafe_werkzeug=True)
    else:
        # Use waitress for production-ready serving on Windows
        try:
            from waitress import serve
            print("Starting server at http://127.0.0.1:5000")
            print("Press Ctrl+C to stop")
            serve(app, host='127.0.0.1', port=5000, threads=4)
        except ImportError:
            # Fallback to Flask dev server
            print("Starting development server at http://127.0.0.1:5000")
            app.run(host='127.0.0.1', port=5000, debug=False)
