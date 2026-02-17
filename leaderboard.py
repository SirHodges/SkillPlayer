"""
Leaderboard module - handles score persistence with 14-day expiry.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path


SCORES_FILE = Path(__file__).parent / "scores.json"
MAX_SCORES = 10
EXPIRY_DAYS = 14
MAX_NAME_LENGTH = 10


def load_scores() -> list:
    """Load scores from file, filtering out expired entries."""
    if not SCORES_FILE.exists():
        return []
    
    try:
        with open(SCORES_FILE, 'r', encoding='utf-8') as f:
            scores = json.load(f)
    except (json.JSONDecodeError, IOError):
        return []
    
    # Filter out expired scores (older than 14 days)
    cutoff_date = datetime.now() - timedelta(days=EXPIRY_DAYS)
    valid_scores = []
    
    for entry in scores:
        try:
            entry_date = datetime.fromisoformat(entry["date"])
            if entry_date >= cutoff_date:
                valid_scores.append(entry)
        except (KeyError, ValueError):
            continue
    
    # Sort by score descending, keep top 10
    valid_scores.sort(key=lambda x: x["score"], reverse=True)
    return valid_scores[:MAX_SCORES]


def save_scores(scores: list) -> None:
    """Save scores to file."""
    try:
        with open(SCORES_FILE, 'w', encoding='utf-8') as f:
            json.dump(scores, f, indent=2)
    except IOError as e:
        print(f"Error saving scores: {e}")


def is_top_score(score: int) -> bool:
    """Check if score qualifies for the leaderboard."""
    scores = load_scores()
    
    if len(scores) < MAX_SCORES:
        return True
    
    # Check if score beats the lowest score
    return score > scores[-1]["score"]


def add_score(name: str, score: int, stats: dict = None) -> list:
    """
    Add a new score to the leaderboard.
    Returns the updated leaderboard.
    """
    # Validate and truncate name
    name = name.strip()[:MAX_NAME_LENGTH].upper()
    if not name:
        name = "ANON"
    
    scores = load_scores()
    
    new_entry = {
        "name": name,
        "score": score,
        "date": datetime.now().isoformat(),
        "stats": stats or {}
    }
    
    scores.append(new_entry)
    scores.sort(key=lambda x: x["score"], reverse=True)
    scores = scores[:MAX_SCORES]
    
    save_scores(scores)
    return scores


def get_leaderboard() -> list:
    """Get the current leaderboard."""
    return load_scores()
