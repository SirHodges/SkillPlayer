
/**
 * Quiz Game - Client-side Logic
 */

// Game state
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeRemaining = 30; // 30 seconds for testing (change to 180 for production)
let timerInterval = null;
let isGameActive = false;
let isAnswerLocked = false; // Prevent answering during delay

// DOM Elements
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen'),
    leaderboard: document.getElementById('leaderboard-screen')
};

const elements = {
    startBtn: document.getElementById('start-btn'),
    leaderboardBtn: document.getElementById('leaderboard-btn'),
    backBtn: document.getElementById('back-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    submitScoreBtn: document.getElementById('submit-score-btn'),
    timerFill: document.getElementById('timer-fill'),
    timerText: document.getElementById('timer-text'),
    score: document.getElementById('score'),
    questionNum: document.getElementById('question-num'),
    totalQuestions: document.getElementById('total-questions'),
    questionText: document.getElementById('question-text'),
    answersContainer: document.getElementById('answers-container'),
    feedback: document.getElementById('feedback'),
    finalScore: document.getElementById('final-score'),
    nameEntry: document.getElementById('name-entry'),
    playerName: document.getElementById('player-name'),
    scoresList: document.getElementById('scores-list'),
    fullScoresList: document.getElementById('full-scores-list')
};

// Initialize event listeners
function init() {
    elements.startBtn.addEventListener('click', startGame);
    elements.leaderboardBtn.addEventListener('click', showLeaderboard);
    elements.backBtn.addEventListener('click', showStartScreen);
    elements.playAgainBtn.addEventListener('click', showStartScreen);
    elements.submitScoreBtn.addEventListener('click', submitScore);

    // Allow Enter key to submit name
    elements.playerName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitScore();
    });

    // Keyboard shortcuts for answers (A, B, C, D)
    document.addEventListener('keydown', (e) => {
        if (!isGameActive || isAnswerLocked) return;

        const key = e.key.toUpperCase();
        const keyMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

        if (key in keyMap) {
            const buttons = elements.answersContainer.querySelectorAll('.answer-btn');
            if (buttons[keyMap[key]] && !buttons[keyMap[key]].disabled) {
                selectAnswer(keyMap[key]);
            }
        }
    });
}

// Screen management
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showStartScreen() {
    showScreen('start');
}

// Start game
async function startGame() {
    try {
        const response = await fetch('/api/start');
        const data = await response.json();

        if (data.success) {
            questions = data.questions;
            currentQuestionIndex = 0;
            score = 0;
            timeRemaining = 30; // 30 seconds for testing
            isGameActive = true;
            isAnswerLocked = false;

            elements.totalQuestions.textContent = questions.length;
            elements.score.textContent = '0';

            showScreen('game');
            displayQuestion();
            startTimer();
        }
    } catch (error) {
        console.error('Failed to start game:', error);
    }
}

// Timer
function startTimer() {
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerDisplay();
        } else {
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    elements.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update timer bar
    const percentage = (timeRemaining / 30) * 100; // Match to initial time
    elements.timerFill.style.width = `${percentage}%`;

    // Change color when low
    if (timeRemaining <= 30) {
        elements.timerFill.classList.add('low');
    } else {
        elements.timerFill.classList.remove('low');
    }
}

function applyPenalty(seconds) {
    timeRemaining = Math.max(0, timeRemaining - seconds);
    updateTimerDisplay();

    // Flash penalty indicator
    showFeedback(`-${seconds} seconds!`, 'penalty');
}

// Questions
function displayQuestion() {
    if (currentQuestionIndex >= questions.length) {
        // No more questions, cycle back or end
        currentQuestionIndex = 0;
    }

    const question = questions[currentQuestionIndex];
    elements.questionNum.textContent = currentQuestionIndex + 1;
    elements.questionText.textContent = question.question;

    // Clear previous answers
    elements.answersContainer.innerHTML = '';
    elements.feedback.textContent = '';
    elements.feedback.className = 'feedback';

    // Create answer buttons with letter prefixes
    const letters = ['A', 'B', 'C', 'D'];
    question.answers.forEach((answer, index) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.innerHTML = `<span class="answer-letter">${letters[index]}</span> ${answer}`;
        btn.addEventListener('click', () => selectAnswer(index));
        elements.answersContainer.appendChild(btn);
    });
}

async function selectAnswer(answerIndex) {
    if (!isGameActive || isAnswerLocked) return;

    isAnswerLocked = true; // Lock answers during processing

    // Disable all buttons temporarily
    const buttons = elements.answersContainer.querySelectorAll('.answer-btn');
    buttons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch('/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_index: currentQuestionIndex,
                answer_index: answerIndex
            })
        });

        const data = await response.json();

        // Highlight correct/wrong answers
        buttons.forEach((btn, idx) => {
            if (idx === data.correct_index) {
                btn.classList.add('correct');
            } else if (idx === answerIndex && !data.correct) {
                btn.classList.add('wrong');
            }
        });

        if (data.correct) {
            score = data.score;
            elements.score.textContent = score;
            showFeedback('Correct! ✓', 'correct');

            // Move to next question after short delay
            setTimeout(() => {
                if (isGameActive) {
                    currentQuestionIndex++;
                    isAnswerLocked = false;
                    displayQuestion();
                }
            }, 300);
        } else {
            // Wrong answer - show 1-second penalty delay with visual countdown
            showPenaltyCountdown();

            // Wait 1 second with visual feedback before next question
            setTimeout(() => {
                hidePenaltyCountdown();
                if (isGameActive) {
                    currentQuestionIndex++;
                    isAnswerLocked = false;
                    displayQuestion();
                }
            }, 1000);
            return; // Don't fall through to the normal timeout below
        }

        // (Correct answer path uses timeout above)

    } catch (error) {
        console.error('Failed to check answer:', error);
    }
}

function showFeedback(message, type) {
    elements.feedback.textContent = message;
    elements.feedback.className = `feedback ${type}`;
}

// Penalty countdown circle
function showPenaltyCountdown() {
    let countdown = document.getElementById('penalty-countdown');
    if (!countdown) {
        countdown = document.createElement('div');
        countdown.id = 'penalty-countdown';
        countdown.className = 'penalty-countdown';
        countdown.innerHTML = `
            <svg class="countdown-ring" viewBox="0 0 100 100">
                <circle class="countdown-ring-bg" cx="50" cy="50" r="45"/>
                <circle class="countdown-ring-progress" cx="50" cy="50" r="45"/>
            </svg>
            <span class="countdown-text">-1s</span>
        `;
        document.getElementById('game-screen').appendChild(countdown);
    }
    countdown.classList.add('active');

    // Trigger the shrinking animation
    const progress = countdown.querySelector('.countdown-ring-progress');
    progress.style.strokeDashoffset = '283'; // Full circle
    requestAnimationFrame(() => {
        progress.style.strokeDashoffset = '0'; // Animate to empty
    });
}

function hidePenaltyCountdown() {
    const countdown = document.getElementById('penalty-countdown');
    if (countdown) {
        countdown.classList.remove('active');
    }
}

// End game
function endGame() {
    isGameActive = false;
    clearInterval(timerInterval);

    elements.finalScore.textContent = score;
    showScreen('end');

    // Check if top score
    checkTopScore();
}

async function checkTopScore() {
    try {
        const response = await fetch('/api/check_top_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: score })
        });

        const data = await response.json();

        if (data.is_top_score && score > 0) {
            elements.nameEntry.classList.remove('hidden');
            elements.playerName.value = '';
            elements.playerName.focus();
        } else {
            elements.nameEntry.classList.add('hidden');
            loadLeaderboard();
        }
    } catch (error) {
        console.error('Failed to check top score:', error);
        elements.nameEntry.classList.add('hidden');
        loadLeaderboard();
    }
}

async function submitScore() {
    const name = elements.playerName.value.trim().toUpperCase() || 'ANON';

    try {
        const response = await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: score, name: name })
        });

        const data = await response.json();

        elements.nameEntry.classList.add('hidden');
        displayScores(data.scores, elements.scoresList);
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
}

// Leaderboard
async function showLeaderboard() {
    showScreen('leaderboard');
    await loadFullLeaderboard();
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        displayScores(data.scores, elements.scoresList);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

async function loadFullLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        displayScores(data.scores, elements.fullScoresList);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

function displayScores(scores, container) {
    container.innerHTML = '';

    if (scores.length === 0) {
        container.innerHTML = '<p class="no-scores">No scores yet. Be the first!</p>';
        return;
    }

    scores.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'score-row';

        const rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = `#${index + 1}`;

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = entry.name;

        const scoreVal = document.createElement('span');
        scoreVal.className = 'score-val';
        scoreVal.textContent = entry.score;

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(scoreVal);
        container.appendChild(row);
    });
}

// Start the app
init();
