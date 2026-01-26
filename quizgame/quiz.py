"""
Quiz logic module - handles question loading, random selection, and answer shuffling.
"""

import json
import random
from pathlib import Path


def load_questions(filepath: str = None) -> list:
    """Load questions from JSON file."""
    if filepath is None:
        filepath = Path(__file__).parent / "questions.json"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_random_questions(questions: list, count: int) -> list:
    """
    Get a random sample of questions without repetition.
    Returns questions with shuffled answers and correct index tracked.
    """
    # Don't request more questions than available
    count = min(count, len(questions))
    
    selected = random.sample(questions, count)
    prepared = []
    
    for q in selected:
        # Create a copy with shuffled answers
        answers = q["answers"].copy()
        correct_answer = q["correct"]
        random.shuffle(answers)
        
        prepared.append({
            "question": q["question"],
            "answers": answers,
            "correct_index": answers.index(correct_answer)
        })
    
    return prepared


def validate_answer(question: dict, answer_index: int) -> bool:
    """Check if the selected answer index is correct."""
    return answer_index == question["correct_index"]
