"""
Flask Quiz Game - Main application
"""

from flask import Flask, render_template, jsonify, request
from quiz import load_questions, get_random_questions
from leaderboard import get_leaderboard, add_score, is_top_score

app = Flask(__name__)

# Store active game sessions (simple in-memory for single player)
current_game = {
    "questions": [],
    "current_index": 0,
    "score": 0
}


@app.route('/')
def index():
    """Serve the game page."""
    return render_template('index.html')


@app.route('/api/start', methods=['GET'])
def start_game():
    """Start a new game with random questions."""
    questions = load_questions()
    game_questions = get_random_questions(questions, len(questions))
    
    # Store game state
    current_game["questions"] = game_questions
    current_game["current_index"] = 0
    current_game["score"] = 0
    
    # Return questions without correct answer info to client
    client_questions = [
        {
            "question": q["question"],
            "answers": q["answers"]
        }
        for q in game_questions
    ]
    
    return jsonify({
        "success": True,
        "questions": client_questions,
        "total": len(client_questions)
    })


@app.route('/api/answer', methods=['POST'])
def check_answer():
    """Check an answer and return result."""
    data = request.get_json()
    question_index = data.get('question_index', 0)
    answer_index = data.get('answer_index', -1)
    
    if question_index >= len(current_game["questions"]):
        return jsonify({"success": False, "error": "Invalid question"})
    
    question = current_game["questions"][question_index]
    is_correct = answer_index == question["correct_index"]
    
    if is_correct:
        current_game["score"] += 1
    
    return jsonify({
        "success": True,
        "correct": is_correct,
        "correct_index": question["correct_index"],
        "score": current_game["score"]
    })


@app.route('/api/leaderboard', methods=['GET'])
def get_scores():
    """Get the current leaderboard."""
    return jsonify({
        "success": True,
        "scores": get_leaderboard()
    })


@app.route('/api/score', methods=['POST'])
def submit_score():
    """Submit a final score."""
    data = request.get_json()
    score = data.get('score', 0)
    name = data.get('name', 'ANON')
    
    # Check if it's a top score
    if is_top_score(score):
        updated_scores = add_score(name, score)
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


@app.route('/api/check_top_score', methods=['POST'])
def check_top_score():
    """Check if a score qualifies for the leaderboard."""
    data = request.get_json()
    score = data.get('score', 0)
    
    return jsonify({
        "success": True,
        "is_top_score": is_top_score(score)
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
