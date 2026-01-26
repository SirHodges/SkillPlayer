"""
Quiz logic module - handles question loading, random selection, and answer shuffling.
"""

import hashlib
import json
import random
import time
from datetime import datetime
from pathlib import Path


def get_question_hash(question_text):
    """Generate an 8-character MD5 hash of the question text."""
    return hashlib.md5(question_text.encode('utf-8')).hexdigest()[:8]


def update_question_history(questions, history_file):
    """
    Update the history file with any new questions.
    Returns a dictionary mapping question text to ID.
    """
    history = {}
    if history_file.exists():
        try:
            with open(history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except (json.JSONDecodeError, IOError):
            history = {}
    
    updated = False
    
    # Process each question
    for q in questions:
        q_text = q.get('question', '')
        q_hash = get_question_hash(q_text)
        
        # If hash doesn't exist in history, add it
        if q_hash not in history:
            history[q_hash] = {
                'question': q_text,
                'answers': q.get('answers', []),
                'correct': q.get('correct', ''),
                'first_seen': datetime.now().isoformat(),
                'tags': q.get('tags', [])
            }
            updated = True
            
        # Inject the ID into the question object for this session
        q['id'] = q_hash

    # Save tracking file if updated
    if updated:
        try:
            # Ensure directory exists
            history_file.parent.mkdir(parents=True, exist_ok=True)
            with open(history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2)
        except IOError:
            print(f"Error saving question history to {history_file}")
            
    return history


def load_questions(filepath: str = None) -> list:
    """Load questions from JSON file and track them."""
    if filepath is None:
        filepath = Path(__file__).parent / "questions.json"
    
    # Define history file path
    # Handle frozen state if necessary, but typically relative to app root
    base_dir = filepath.parent
    history_file = base_dir / "data" / "question_history.json"
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            questions = json.load(f)
            
        # Update history and inject IDs
        update_question_history(questions, history_file)
        
        return questions
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error loading questions: {e}")
        return []


def get_random_questions(questions: list, count: int) -> list:
    """
    Get a random sample of questions without repetition.
    Returns questions with shuffled answers and correct index tracked.
    """
    # Reseed random with current time for better randomization each game
    random.seed(time.time() * 1000 + random.random() * 1000)
    
    # Don't request more questions than available
    count = min(count, len(questions))
    
    # Create a copy and shuffle multiple times for better randomization
    question_pool = questions.copy()
    for _ in range(3):  # Multiple shuffle passes
        random.shuffle(question_pool)
    
    # Take the first 'count' questions
    selected = question_pool[:count]
    
    # Shuffle the selected questions one more time
    random.shuffle(selected)
    
    prepared = []
    for q in selected:
        # Create a copy with shuffled answers
        answers = q["answers"].copy()
        correct_answer = q["correct"]
        
        # Shuffle answers multiple times
        for _ in range(2):
            random.shuffle(answers)
        
        prepared.append({
            "id": q.get("id"),  # Pass the ID through
            "question": q["question"],
            "answers": answers,
            "correct_index": answers.index(correct_answer)
        })
    
    return prepared


def validate_answer(question: dict, answer_index: int) -> bool:
    """Check if the selected answer index is correct."""
    return answer_index == question["correct_index"]
