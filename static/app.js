// ===========================================
// SocketIO for Gamepad Support
// ===========================================
let gamepadSocket = null;

// Initialize gamepad socket after page load
function initGamepadSocket() {
    try {
        if (typeof io !== 'undefined') {
            gamepadSocket = io();
            console.log('[Gamepad] SocketIO connected');

            // Listen for gamepad button presses
            gamepadSocket.on('gamepad_button', function (data) {
                console.log('[Gamepad] Button received:', data);

                // Only handle gamepad input when in gamepad mode, quiz mode, and game is active
                if (inputMode === 'gamepad' && currentAppMode === 'quiz' && quizIsGameActive && !quizIsAnswerLocked) {
                    const answerIndex = data.answer_index;
                    if (answerIndex >= 0 && answerIndex <= 3) {
                        selectQuizAnswer(answerIndex);
                    }
                }
            });
        }
    } catch (e) {
        console.log('[Gamepad] SocketIO not available:', e);
    }
}

// ===========================================
// App Mode State
// ===========================================
let currentAppMode = 'skillplayer';

// ===========================================
// SkillPlayer State
// ===========================================
let currentCategory = 'Skills';
let currentSkill = null;
let currentContent = null;

// ===========================================
// Quiz State
// ===========================================
let quizQuestions = [];
let quizCurrentQuestionIndex = 0;
let quizScore = 0;
// 2-Player State
let quizPlayerCount = 1;
let quizScores = { p1: 0, p2: 0 };
let quizLocks = { p1: false, p2: false };
let quizTimers = { p1: 60, p2: 60 };
let quizStreaks = { p1: 0, p2: 0 };

// Legacy/Global (used for 1P or tracking)
let quizTimeRemaining = 60;

let quizTimerInterval = null;
let quizIsGameActive = false;
let quizIsAnswerLocked = false;

// Input Mode State (mouse = column layout, gamepad = diamond layout)
let inputMode = 'mouse';

function setInputMode(mode) {
    inputMode = mode;

    // Update toggle button states
    document.querySelectorAll('.input-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update answer container layout
    const answersContainer = document.getElementById('quiz-answers-container');
    if (answersContainer) {
        if (mode === 'gamepad') {
            answersContainer.classList.add('diamond-layout');
        } else {
            answersContainer.classList.remove('diamond-layout');
        }
    }
}

// Sound Effects
const soundRight = new Audio('/static/Right.mp3');
const soundWrong = new Audio('/static/Wrong.mp3');

// Initialize volume
soundRight.volume = 0.5;
soundWrong.volume = 0.0; // Muted by default/removed

function updateVolume(val) {
    soundRight.volume = val;
    // soundWrong is effectively removed, but if we kept it:
    // soundWrong.volume = val;
}

// Streak State
let quizStreak = 0;
let streakTimerTimeout = null;
let streakExpiryInterval = null;
const STREAK_EXPIRY_TIME = 7000; // 7 seconds
let streakTimeRemaining = STREAK_EXPIRY_TIME;

// Answer Tracking State
let questionDisplayTime = 0; // Timestamp when question was shown

// Detailed Stats Tracking
let gameStats = {
    correct: 0,
    wrong: 0,
    skips: 0,
    streakCount: 0, // Number of times a 3+ streak was achieved
    bestStreak: 0  // Highest streak level reached
};
let currentStreakLevel = 0; // To track if we just entered a new streak level

// ===========================================
// DOM Elements - SkillPlayer
// ===========================================
const skillsList = document.getElementById('skills-list');
const videosGrid = document.getElementById('videos-grid');
const videoPlayer = document.getElementById('video-player');
const pdfViewer = document.getElementById('pdf-viewer');
const videoPlaceholder = document.getElementById('video-placeholder');
const videoTitle = document.getElementById('video-title');
const currentSkillTitle = document.getElementById('current-skill-title');
const categoryTitle = document.getElementById('category-title');

// ===========================================
// DOM Elements - Quiz
// ===========================================
const quizElements = {
    timerFill: document.getElementById('quiz-timer-fill'),
    timerText: document.getElementById('quiz-timer-text'),
    score: document.getElementById('quiz-score'),
    questionNum: document.getElementById('quiz-question-num'),
    totalQuestions: document.getElementById('quiz-total-questions'),
    questionText: document.getElementById('quiz-question-text'),
    answersContainer: document.getElementById('quiz-answers-container'),
    feedback: document.getElementById('quiz-feedback'),
    finalScore: document.getElementById('quiz-final-score'),
    nameEntry: document.getElementById('quiz-name-entry'),
    playerName: document.getElementById('quiz-player-name'),
    endScoresList: document.getElementById('quiz-end-scores-list'),
    sidebarScoresList: document.getElementById('sidebar-scores-list')
};

// ===========================================
// App Mode Switching
// ===========================================
function switchAppMode(mode) {
    currentAppMode = mode;

    // If switching away from quiz, always reset it
    if (mode === 'skillplayer') {
        resetQuiz();
    }

    // Update tab active states
    document.querySelectorAll('.app-mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Switch sidebar content
    document.querySelectorAll('.sidebar-mode-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${mode}-sidebar`).classList.add('active');

    // Switch main content
    document.querySelectorAll('.app-mode-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${mode}-content`).classList.add('active');

    // Load data for the mode
    if (mode === 'quiz') {
        loadQuizLeaderboard();
    }
}

// ===========================================
// SkillPlayer Functions
// ===========================================

// Select a category
function selectCategory(category) {
    currentCategory = category;
    currentSkill = null;

    // Update tab active state
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });

    // Update category title
    categoryTitle.textContent = category;

    // Reset content area
    videosGrid.innerHTML = '';
    currentSkillTitle.textContent = 'Select a topic to see videos';
    document.getElementById('current-skill-title-french').style.display = 'inline';
    document.getElementById('current-skill-title-french').textContent = '/ Sélectionnez un sujet pour voir les vidéos';
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.style.display = 'none';
    pdfViewer.src = '';
    pdfViewer.style.display = 'none';
    videoPlaceholder.style.display = 'flex';
    videoTitle.textContent = '';

    // Reset arrow to point left (at sidebar) when no skill selected
    const placeholderArrow = document.getElementById('placeholder-arrow');
    if (placeholderArrow) {
        placeholderArrow.classList.remove('point-down');
    }

    // Load skills for this category
    loadSkills();
}

// Load skills on page load
async function loadSkills() {
    try {
        const response = await fetch(`/api/skills/${currentCategory}`);
        const skills = await response.json();

        if (skills.length === 0) {
            skillsList.innerHTML = `
                        <li class="empty-message">
                            <span>No items found</span>
                            <small>Add folders to content/${currentCategory}/</small>
                        </li>
                    `;
            return;
        }

        skillsList.innerHTML = skills.map(skill => {
            const iconHtml = skill.logo
                ? `<img src="/video/${currentCategory}/${skill.id}/${skill.logo}" class="skill-logo" alt="${skill.name}">`
                : '<span class="skill-icon">📚</span>';
            const newBadge = skill.is_new ? '<span class="new-badge">NEW</span>' : '';

            return `
                    <li>
                        <button class="skill-btn" data-skill="${skill.id}" onclick="selectSkill('${skill.id}', '${skill.name}')">
                            ${iconHtml}
                            <span class="skill-name">${skill.name}</span>
                            ${newBadge}
                        </button>
                    </li>
                `}).join('');

    } catch (error) {
        console.error('Error loading skills:', error);
        skillsList.innerHTML = '<li class="error-message">Error loading skills</li>';
    }
}

// Select a skill and load its content
async function selectSkill(skillId, skillName) {
    currentSkill = skillId;

    // Stop current content and reset player
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.style.display = 'none';
    pdfViewer.src = '';
    pdfViewer.style.display = 'none';

    videoPlaceholder.style.display = 'flex';
    videoTitle.textContent = '';

    // Arrow should point down to content when skill is selected
    const placeholderArrow = document.getElementById('placeholder-arrow');
    if (placeholderArrow) {
        placeholderArrow.classList.add('point-down');
    }
    currentContent = null;

    // Update active state in sidebar
    document.querySelectorAll('.skill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.skill === skillId);
    });

    // Update title
    currentSkillTitle.textContent = skillName;
    document.getElementById('current-skill-title-french').style.display = 'none';

    // Load content for this skill
    try {
        const response = await fetch(`/api/skills/${currentCategory}/${skillId}/videos`);
        const files = await response.json();

        if (files.length === 0) {
            videosGrid.innerHTML = `
                        <div class="empty-videos">
                            <span class="empty-icon">📭</span>
                            <p>No content found in this skill folder</p>
                            <small>Add .mp4 videos or .pdf files</small>
                        </div>
                    `;
            return;
        }

        videosGrid.innerHTML = files.map((file, index) => {
            const pdfIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13h1c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1h-.5v1.5H8V13h.5zm3 0h1.25c.41 0 .75.34.75.75v2.5c0 .41-.34.75-.75.75H11.5V13zm4 0H17v1h-1v.5h1v1h-1V17h-1v-4h.5zM9 14v1h.5v-1H9zm3 0v2h.5v-2h-.5z"/>
                    </svg>`;
            const videoIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>`;
            const icon = file.type === 'pdf' ? pdfIcon : videoIcon;
            const newBadge = file.is_new ? '<span class="new-badge">NEW</span>' : '';
            return `
                    <button class="video-card" onclick="playContent('${file.category}', '${file.skill}', '${file.filename}', '${file.name.replace(/'/g, "\\'")}', '${file.type}')">
                        <div class="video-card-icon">${icon}</div>
                        <div class="video-card-info">
                            <span class="video-name">${file.name} ${newBadge}</span>
                        </div>
                    </button>
                `}).join('');

    } catch (error) {
        console.error('Error loading content:', error);
        videosGrid.innerHTML = '<div class="error-message">Error loading content</div>';
    }
}

// Play a video or show PDF
function playContent(category, skill, filename, title, type) {
    currentContent = { category, skill, filename, title, type };

    // Update active state
    document.querySelectorAll('.video-card').forEach(card => {
        card.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Hide placeholder
    videoPlaceholder.style.display = 'none';

    // Set source url
    const contentUrl = `/video/${category}/${skill}/${filename}`;
    videoTitle.textContent = title;

    if (type === 'pdf') {
        // Show PDF
        videoPlayer.pause();
        videoPlayer.style.display = 'none';

        pdfViewer.src = `${contentUrl}?t=${Date.now()}#toolbar=0&navpanes=0&pagemode=none&view=FitH&scrollbar=0`;
        pdfViewer.style.display = 'block';
    } else {
        // Show Video
        pdfViewer.style.display = 'none';
        pdfViewer.src = '';

        videoPlayer.src = contentUrl;
        videoPlayer.style.display = 'block';
        videoPlayer.play();
    }

    // Scroll to viewer on mobile
    document.getElementById('video-section').scrollIntoView({ behavior: 'smooth' });

    // Track view
    trackView(skill, filename);
}

// Track view and update counter
async function trackView(skill, filename) {
    try {
        const response = await fetch('/api/views/increment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skill, filename })
        });
        const data = await response.json();
        document.getElementById('total-views').textContent = data.total;
    } catch (error) {
        console.error('Error tracking view:', error);
    }
}

// Load total views on page load
async function loadTotalViews() {
    try {
        const response = await fetch('/api/views/total');
        const data = await response.json();
        document.getElementById('total-views').textContent = data.total;
    } catch (error) {
        console.error('Error loading views:', error);
    }
}

// Load categories with NEW badges
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        const categoryTabs = document.getElementById('category-tabs');

        categoryTabs.innerHTML = categories.map(cat => {
            const isActive = cat.name === currentCategory ? 'active' : '';
            const newBadge = cat.is_new ? '<span class="new-badge">NEW</span>' : '';
            return `<button class="category-tab ${isActive}" data-category="${cat.name}" onclick="selectCategory('${cat.name}')">${cat.name} ${newBadge}</button>`;
        }).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// ===========================================
// Quiz Functions
// ===========================================

function showQuizScreen(screenName) {
    document.querySelectorAll('.quiz-screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(`quiz-${screenName}-screen`).classList.add('active');
}

function cancelBinding() {
    // Force valid context if needed or just proceed
    // Switch to mouse input locally for this session
    showQuizScreen('countdown');
    runCountdown();
}

function resetQuiz() {
    // Stop any running timer
    quizIsGameActive = false;
    clearInterval(quizTimerInterval);

    // End gamepad session if active
    if (socket && socket.connected) {
        socket.emit('end_gamepad_session');
    }

    // Reset all state
    quizQuestions = [];
    quizCurrentQuestionIndex = 0;
    quizScore = 0;
    quizTimeRemaining = 60;
    quizIsAnswerLocked = false;

    // Reset UI
    quizElements.playerName.value = '';
    quizElements.nameEntry.classList.add('hidden');

    // Reset streak
    resetStreak();

    // Show start screen
    showQuizScreen('start');

    // Reset UI Elements that might be hidden
    document.querySelectorAll('.input-toggle-btn').forEach(btn => btn.style.display = 'flex');
}

function showQuizStartScreen() {
    resetQuiz();
    loadQuizLeaderboard();
}

// New function to update rules based on mode selection
function updateQuizRules(mode) {
    const rules1p = document.getElementById('quiz-rules-1p');
    const rules2p = document.getElementById('quiz-rules-2p');
    const hint = document.querySelector('.quiz-hint');

    if (mode == 2) {
        if (rules1p) rules1p.classList.add('hidden');
        if (rules2p) rules2p.classList.remove('hidden');
        if (hint) hint.classList.add('hidden'); // Hint doesn't apply to lockout mode
    } else {
        if (rules1p) rules1p.classList.remove('hidden');
        if (rules2p) rules2p.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
    }
}

async function startQuiz() {
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`/api/quiz/start?t=${Date.now()}`);
        const data = await response.json();

        if (data.success) {
            // Check player mode & count first
            const playerModeInput = document.querySelector('input[name="player-mode"]:checked');
            quizPlayerCount = playerModeInput ? parseInt(playerModeInput.value) : 1;

            // FORCE GAMEPAD FOR 2-PLAYER
            if (quizPlayerCount > 1) {
                setInputMode('gamepad');
                // Hide toggles to prevent switching
                document.querySelectorAll('.input-toggle-btn').forEach(btn => btn.style.display = 'none');

                // Initialize 2-Player State
                quizScores = { p1: 0, p2: 0 };
                quizTimers = { p1: 60, p2: 60 }; // Kept for legacy ref, but main timer used
                quizStreaks = { p1: 0, p2: 0 };
                quizLocks = { p1: false, p2: false };
                quizTimeRemaining = 60; // Use shared timer
            } else {
                // 1-Player State
                document.querySelectorAll('.input-toggle-btn').forEach(btn => btn.style.display = 'flex');
                quizTimeRemaining = 60;
                quizStreak = 0;
            }

            quizQuestions = data.questions;
            quizCurrentQuestionIndex = 0;
            quizIsGameActive = true;
            quizIsAnswerLocked = false;

            // Reset stats
            gameStats = {
                correct: 0,
                wrong: 0,
                skips: 0,
                streakCount: 0,
                bestStreak: 0
            };
            currentStreakLevel = 0;

            quizElements.totalQuestions.textContent = quizQuestions.length;

            // Reset Score Displays
            updateScoreDisplay(); // Will handle hiding/showing p1/p2 containers

            // If in gamepad mode (which is forced for 2P), show binding screen first
            if (inputMode === 'gamepad') {
                showQuizScreen('binding');

                // Update binding text based on mode
                const statusText = document.getElementById('binding-status-text');
                if (statusText) {
                    statusText.textContent = quizPlayerCount > 1 ? "Waiting for Player 1..." : "Press any button to start...";
                    statusText.style.color = "white"; // Reset color

                    // Cancel button stays visible to allow going back
                    const cancelBtn = document.getElementById('binding-cancel-btn');
                    if (cancelBtn) cancelBtn.style.display = 'inline-block';
                }
            }

            // Tell backend to start listening
            if (socket && socket.connected) {
                socket.emit('start_gamepad_binding', { player_count: quizPlayerCount });
            }
        } else {
            // Show countdown screen directly for mouse mode
            showQuizScreen('countdown');
            runCountdown();
        }
    } catch (error) {
        console.error('Failed to start quiz:', error);
    }
}

function runCountdown() {
    const countdownEl = document.getElementById('countdown-number');
    let count = 3;
    countdownEl.textContent = count;
    countdownEl.className = 'countdown-number countdown-pop';

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownEl.textContent = count;
            countdownEl.className = 'countdown-number';
            // Trigger reflow for animation restart
            void countdownEl.offsetWidth;
            countdownEl.className = 'countdown-number countdown-pop';
        } else if (count === 0) {
            countdownEl.textContent = 'GO!';
            countdownEl.className = 'countdown-number countdown-go';
            // Transition to game after 750ms
            setTimeout(() => {
                clearInterval(countdownInterval);
                quizIsGameActive = true;
                showQuizScreen('game');
                displayQuizQuestion();
                startQuizTimer();
            }, 750);
        }
    }, 750);
}

function startQuizTimer() {
    updateQuizTimerDisplay();
    updateScoreDisplay(); // Refresh UI state

    quizTimerInterval = setInterval(() => {
        if (!quizIsGameActive) return;

        // Shared Timer Logic for both modes
        if (quizTimeRemaining > 0) {
            quizTimeRemaining--;
            updateQuizTimerDisplay();
        } else {
            endQuiz();
        }

        // Legacy: if we want individual timers for something else, we can keep them, 
        // but user requested a shared top timer.
    }, 1000);
}

function updateQuizTimerDisplay() {
    // SHARED TIMER DISPLAY (For both 1P and 2P)
    const minutes = Math.floor(quizTimeRemaining / 60);
    const seconds = quizTimeRemaining % 60;
    quizElements.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update timer bar
    const percentage = Math.max(0, Math.min(100, (quizTimeRemaining / 60) * 100));
    quizElements.timerFill.style.width = `${percentage}%`;

    // Change color when low (under 30 seconds)
    if (quizTimeRemaining <= 30) {
        quizElements.timerFill.classList.add('low');
    } else {
        quizElements.timerFill.classList.remove('low');
    }

    // Hide individual player timers if they exist
    ['p1', 'p2'].forEach(p => {
        const el = document.getElementById(`${p}-timer`);
        if (el) el.style.display = 'none';
    });
}

function applyQuizPenalty(seconds, playerIndex = 1) {
    if (quizPlayerCount > 1) {
        const pKey = 'p' + playerIndex;
        quizTimers[pKey] = Math.max(0, quizTimers[pKey] - seconds);
        updateQuizTimerDisplay();
        showQuizFeedback(`-${seconds}s`, 'penalty', playerIndex);
    } else {
        quizTimeRemaining = Math.max(0, quizTimeRemaining - seconds);
        updateQuizTimerDisplay();
        showQuizFeedback(`-${seconds} seconds!`, 'penalty');
    }
}

function updateScoreDisplay() {
    if (quizPlayerCount > 1) {
        // 2-Player UI
        document.getElementById('p1-score-container').classList.remove('hidden');
        document.getElementById('p2-score-container').classList.remove('hidden');
        document.getElementById('single-player-score-container').classList.add('hidden');

        document.getElementById('p1-score-val').textContent = quizScores.p1;
        document.getElementById('p2-score-val').textContent = quizScores.p2;
    } else {
        // 1-Player UI
        document.getElementById('p1-score-container').classList.add('hidden');
        document.getElementById('p2-score-container').classList.add('hidden');
        document.getElementById('single-player-score-container').classList.remove('hidden');

        quizElements.score.textContent = quizScore;
    }
}

function displayQuizQuestion() {
    if (quizCurrentQuestionIndex >= quizQuestions.length) {
        // End of quiz
        endQuiz();
        return;
    }

    // Reset Locks for 2-Player
    quizLocks = { p1: false, p2: false };
    document.querySelectorAll('.lock-overlay').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.lockout-bar').forEach(el => el.classList.add('hidden')); // Clear bars
    document.querySelectorAll('.player-score-container').forEach(el => el.classList.remove('locked', 'active-turn'));

    // Update Scores
    updateScoreDisplay();

    const question = quizQuestions[quizCurrentQuestionIndex];
    quizElements.questionNum.textContent = quizCurrentQuestionIndex + 1;
    quizElements.questionText.textContent = question.question;

    // Clear previous answers
    quizElements.answersContainer.innerHTML = '';
    quizElements.feedback.textContent = '';
    quizElements.feedback.className = 'quiz-feedback';

    // Reapply diamond layout if in gamepad mode
    if (inputMode === 'gamepad') {
        quizElements.answersContainer.classList.add('diamond-layout');
    } else {
        quizElements.answersContainer.classList.remove('diamond-layout');
    }

    // Hide skip button (will fade in after 2 seconds)
    const skipBtn = document.getElementById('quiz-skip-btn');
    if (skipBtn) {
        skipBtn.classList.remove('skip-fade-in');
        skipBtn.classList.add('skip-hidden');
    }

    // Lock answers during delay
    quizIsAnswerLocked = true;

    // Record when question was displayed for timing tracking
    questionDisplayTime = Date.now();

    // Create answer buttons with letter prefixes (hidden initially)
    const letters = ['A', 'B', 'C', 'D'];

    question.answers.forEach((answer, index) => {
        let label = letters[index];
        let colorClass = '';

        // Custom Gamepad Mapping:
        // Top(0): X (Blue)
        // Right(1): A (Red)
        // Bottom(2): B (Yellow)
        // Left(3): Y (Green)
        if (inputMode === 'gamepad') {
            if (index === 0) { label = 'X'; colorClass = 'blue'; }
            if (index === 1) { label = 'A'; colorClass = 'red'; }
            if (index === 2) { label = 'B'; colorClass = 'yellow'; }
            if (index === 3) { label = 'Y'; colorClass = 'green'; }
        }

        const btn = document.createElement('button');
        btn.className = 'quiz-answer-btn answer-hidden';
        btn.innerHTML = `<span class="answer-letter ${colorClass}">${label}</span> ${answer}`;
        btn.addEventListener('click', () => selectQuizAnswer(index, 1));
        quizElements.answersContainer.appendChild(btn);
    });

    // After 1 second, start fade in AND unlock (reduced delay)
    setTimeout(() => {
        const buttons = quizElements.answersContainer.querySelectorAll('.quiz-answer-btn');
        buttons.forEach(btn => {
            btn.classList.remove('answer-hidden');
            btn.classList.add('answer-fade-in');
        });

        quizIsAnswerLocked = false;
        const skipBtn = document.getElementById('quiz-skip-btn');
        if (skipBtn) {
            skipBtn.classList.remove('skip-hidden');
            skipBtn.classList.add('skip-fade-in');
        }
    }, 1000);
}

async function selectQuizAnswer(answerIndex, playerIndex = 1) {
    const pKey = 'p' + playerIndex;

    // Checks
    if (!quizIsGameActive) return;
    if (quizPlayerCount > 1) {
        if (quizLocks[pKey]) return; // This player is locked
        if (quizIsAnswerLocked) return; // Game is transitioning
    } else {
        if (quizIsAnswerLocked) return;
    }

    // In 1P mode, lock immediately. In 2P, we wait for result to lock specific player or game.
    if (quizPlayerCount === 1) quizIsAnswerLocked = true;

    // Disable all buttons visual feedback if 1P? No, keep it dynamic.
    const buttons = quizElements.answersContainer.querySelectorAll('.quiz-answer-btn');

    try {
        // Calculate time to answer
        const timeToAnswer = Date.now() - questionDisplayTime;

        const response = await fetch('/api/quiz/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_index: quizCurrentQuestionIndex,
                answer_index: answerIndex,
                time_to_answer_ms: timeToAnswer,
                streak_count: quizStreak,
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (data.correct) {
            // ANSWER CORRECT
            // Lock game immediately
            quizIsAnswerLocked = true;

            // Highlight Correct Button
            if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');

            // Play Sound
            soundRight.currentTime = 0;
            soundRight.play().catch(() => { });

            // Update Score
            if (quizPlayerCount > 1) {
                quizScores[pKey]++;

                // TIME BONUS for 2P
                quizTimeRemaining = Math.min(quizTimeRemaining + 2, 120);
                updateQuizTimerDisplay();

                updateStreak(true, playerIndex);

                updateScoreDisplay();

                // Highlight winner box
                const pContainer = document.getElementById(pKey + '-score-container');
                if (pContainer) pContainer.classList.add('active-turn');
                showQuizFeedback(`+1 Point!`, 'correct', playerIndex);
            } else {
                // 1P Logic
                const streakBonus = quizStreak >= 2 ? Math.min(quizStreak - 1, 5) : 0;
                const pointsEarned = 10 + streakBonus;
                quizScore += pointsEarned;
                quizElements.score.textContent = quizScore;
                showFloatingScore(pointsEarned);
                quizTimeRemaining = Math.min(quizTimeRemaining + 2, 120);
                updateQuizTimerDisplay();
                showQuizFeedback('Correct! +2 seconds', 'correct');
                updateStreak(true);
            }

            // Next Question Delay
            setTimeout(() => {
                if (quizIsGameActive) {
                    quizCurrentQuestionIndex++;
                    quizIsAnswerLocked = false;
                    displayQuizQuestion();
                }
            }, 1000);

        } else {
            // ANSWER WRONG
            if (quizPlayerCount > 1) {
                // Lock THIS player
                quizLocks[pKey] = true;

                // NO TIME PENALTY for 2P as requested (Locked timer remains)
                updateStreak(false, playerIndex);

                const pOverlay = document.getElementById(pKey + '-lock-overlay');
                const pContainer = document.getElementById(pKey + '-score-container');
                const pLockBar = document.getElementById(pKey + '-lock-bar'); // New Bar

                if (pOverlay) pOverlay.classList.remove('hidden');
                if (pLockBar) pLockBar.classList.remove('hidden'); // Show Bar
                if (pContainer) pContainer.classList.add('locked');

                // Visual feedback
                if (buttons[answerIndex]) buttons[answerIndex].classList.add('wrong');

                // Check if BOTH are locked
                if (quizLocks.p1 && quizLocks.p2) {
                    showQuizFeedback("Both Players Locked! Moving on...", 'penalty');
                    quizIsAnswerLocked = true; // Stop inputs

                    // Reveal correct answer
                    if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');

                    setTimeout(() => {
                        if (quizIsGameActive) {
                            quizCurrentQuestionIndex++;
                            quizIsAnswerLocked = false;
                            displayQuizQuestion();
                        }
                    }, 1500);
                } else {
                    // Just this player locked
                    // Just this player locked
                    showQuizFeedback(`LOCKED (3s)!`, 'penalty', playerIndex);

                    const currentQIndex = quizCurrentQuestionIndex;

                    // Initialize Lock Visual (Countdown)
                    if (pOverlay) {
                        pOverlay.innerHTML = `<div class="lock-countdown">3</div>`;
                    }

                    // Countdown Timer (Logic + sync check)
                    let lockTime = 3000; // ms
                    const intervalStep = 100;
                    const lockInterval = setInterval(() => {
                        if (!quizIsGameActive || quizCurrentQuestionIndex !== currentQIndex) {
                            clearInterval(lockInterval);
                            return;
                        }

                        lockTime -= intervalStep;

                        // Update Countdown Text
                        if (pOverlay) {
                            const seconds = Math.ceil(lockTime / 1000);
                            const cntEl = pOverlay.querySelector('.lock-countdown');
                            if (cntEl) cntEl.textContent = Math.max(1, seconds);
                        }

                        if (lockTime <= 0) {
                            clearInterval(lockInterval);
                            quizLocks[pKey] = false;
                            if (pOverlay) pOverlay.classList.add('hidden');
                            if (pLockBar) pLockBar.classList.add('hidden'); // Hide Bar
                            if (pContainer) pContainer.classList.remove('locked');
                        }
                    }, intervalStep);
                }

            } else {
                // 1P Logic (Penalty)
                gameStats.wrong++;
                showQuizFeedback('Wrong! -5 seconds penalty', 'penalty');
                applyQuizPenalty(5);
                updateStreak(false);

                if (buttons[answerIndex]) buttons[answerIndex].classList.add('wrong');
                if (buttons[data.correct_index]) buttons[data.correct_index].classList.add('correct');

                quizIsAnswerLocked = true;
                setTimeout(() => {
                    if (quizIsGameActive) {
                        quizCurrentQuestionIndex++;
                        quizIsAnswerLocked = false;
                        displayQuizQuestion();
                    }
                }, 800);
            }
        }

    } catch (error) {
        console.error('Failed to check answer:', error);
        quizIsAnswerLocked = false;
    }
}

function showFloatingScore(points) {
    const floatingScore = document.getElementById('floating-score');
    if (floatingScore) {
        floatingScore.textContent = `+${points}`;
        floatingScore.classList.remove('animate');
        void floatingScore.offsetWidth; // Force reflow
        floatingScore.classList.add('animate');
    }
}

function showQuizFeedback(message, type, playerIndex = null) {
    // If playerIndex provided and valid, show there
    if (quizPlayerCount > 1 && playerIndex) {
        const pKey = 'p' + playerIndex;
        const el = document.getElementById(`${pKey}-feedback`);
        if (el) {
            el.textContent = message;
            el.className = `player-feedback ${type}`;
            // Clear after delay
            setTimeout(() => {
                el.textContent = '';
                el.className = 'player-feedback';
            }, 2000);
        }
    } else {
        // Global feedback (1P or fallback)
        quizElements.feedback.textContent = message;
        quizElements.feedback.className = `quiz-feedback ${type}`;
    }
}

// ===========================================
// Streak Functions
// ===========================================

function resetStreak() {
    quizStreak = 0;
    streakTimeRemaining = STREAK_EXPIRY_TIME;
    clearTimeout(streakTimerTimeout);
    clearInterval(streakExpiryInterval);
    streakTimerTimeout = null;
    streakExpiryInterval = null;

    const indicator = document.getElementById('streak-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
        indicator.classList.remove('streak-pop');
    }
}

function getStreakText(streak) {
    if (streak > gameStats.bestStreak) {
        gameStats.bestStreak = streak;
    }

    // Count distinct streaks (3 or more)
    // If we just hit 3, count it.
    if (streak >= 3 && streak > currentStreakLevel) {
        // Determine if this is a "new" streak event or just continuation
        // For simplicity, let's just count every time we cross the threshold of 3 from 2
        if (streak === 3) {
            gameStats.streakCount++;
        }
    }
    currentStreakLevel = streak;

    if (streak >= 7) return 'PARAGOD!';
    if (streak >= 6) return 'ULTRASTREAK!';
    if (streak >= 5) return 'Megastreak!';
    if (streak >= 4) return 'On Fire!';
    return 'Streak!';
}

function getStreakLevel(streak) {
    if (streak >= 7) return 'paragod';
    if (streak >= 6) return 'ultra';
    if (streak >= 5) return 'mega';
    if (streak >= 4) return 'fire';
    return 'basic';
}

function updateStreak(correct, playerIndex = 1) {
    if (quizPlayerCount > 1) {
        // 2-Player Streak Logic
        const pKey = 'p' + playerIndex;
        if (correct) {
            quizStreaks[pKey]++;
        } else {
            quizStreaks[pKey] = 0;
        }
        // Update UI handled by updateScoreDisplay() called in selectQuizAnswer
    } else {
        // 1-Player Standard Logic
        if (correct) {
            quizStreak++;
            gameStats.correct++;

            // Track best streak
            if (quizStreak > gameStats.bestStreak) {
                gameStats.bestStreak = quizStreak;
            }

            // Track streak occurrences (simple approach: count when we hit 3)
            if (quizStreak === 3) {
                gameStats.streakCount++;
            }

            // Only show indicator at streak of 3 or more
            if (quizStreak >= 3) {
                const indicator = document.getElementById('streak-indicator');
                const streakText = document.getElementById('streak-text');
                const ringProgress = document.getElementById('streak-ring-progress');

                if (indicator && streakText) {
                    // Update text
                    streakText.textContent = getStreakText(quizStreak);

                    // Update visual level
                    indicator.className = `streak-indicator streak-${getStreakLevel(quizStreak)}`;

                    // Trigger pop animation
                    indicator.classList.remove('streak-pop');
                    void indicator.offsetWidth; // Force reflow
                    indicator.classList.add('streak-pop');

                    // Reset and start the expiry timer
                    startStreakTimer();
                }
            }
        } else {
            // Wrong answer or skip breaks streak
            resetStreak();
        }
    }
}

function startStreakTimer() {
    // Clear existing timers
    clearTimeout(streakTimerTimeout);
    clearInterval(streakExpiryInterval);

    streakTimeRemaining = STREAK_EXPIRY_TIME;
    const ringProgress = document.getElementById('streak-ring-progress');
    const circumference = 2 * Math.PI * 16; // r=16 from the SVG

    // Set initial full circle
    if (ringProgress) {
        ringProgress.style.strokeDasharray = circumference;
        ringProgress.style.strokeDashoffset = 0;
    }

    // Update ring every 50ms for smooth animation
    streakExpiryInterval = setInterval(() => {
        streakTimeRemaining -= 50;

        if (ringProgress) {
            const progress = streakTimeRemaining / STREAK_EXPIRY_TIME;
            const offset = circumference * (1 - progress);
            ringProgress.style.strokeDashoffset = offset;
        }

        if (streakTimeRemaining <= 0) {
            resetStreak();
        }
    }, 50);
}

async function skipQuestion() {
    if (!quizIsGameActive || quizIsAnswerLocked) return;

    quizIsAnswerLocked = true;

    // Apply 1 second penalty
    applyQuizPenalty(1);
    showQuizFeedback('Skipped! -1 second', 'penalty');

    // Track detailed stats
    gameStats.skips++;

    // Break streak on skip
    updateStreak(false);

    // Track the skip on the server
    try {
        // Calculate time before skipping
        const timeToAnswer = Date.now() - questionDisplayTime;

        const question = quizQuestions[quizCurrentQuestionIndex];
        await fetch('/api/quiz/skip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question.question,
                question_index: quizCurrentQuestionIndex,
                time_to_answer_ms: timeToAnswer,
                streak_count: quizStreak,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        console.error('Failed to track skip:', error);
    }

    // Move to next question after short delay
    setTimeout(() => {
        if (quizIsGameActive) {
            quizCurrentQuestionIndex++;
            quizIsAnswerLocked = false;
            displayQuizQuestion();
        }
    }, 500);
}

function stopQuizAttempt() {
    // End the quiz immediately when user clicks Stop Attempt
    endQuiz();
}

// Virtual Keyboard Functions
function pressKey(letter) {
    const input = document.getElementById('quiz-player-name');
    if (input.value.length < 10) {
        input.value += letter;
    }
}

function pressBackspace() {
    const input = document.getElementById('quiz-player-name');
    input.value = input.value.slice(0, -1);
}

function endQuiz() {
    quizIsGameActive = false;
    clearInterval(quizTimerInterval);

    // End gamepad session if active
    if (socket && socket.connected) {
        socket.emit('end_gamepad_session');
    }

    if (quizPlayerCount > 1) {
        // 2-Player End Screen
        let winnerText = "It's a Tie!";
        let winnerColor = "white";

        if (quizScores.p1 > quizScores.p2) {
            winnerText = "PLAYER 1 WINS!";
            winnerColor = "#2196F3"; // Blue
        } else if (quizScores.p2 > quizScores.p1) {
            winnerText = "PLAYER 2 WINS!";
            winnerColor = "#F44336"; // Red
        }

        // Hide Leaderboard & Init Elements that might confuse
        document.getElementById('quiz-end-leaderboard').classList.add('hidden');
        quizElements.nameEntry.classList.add('hidden');

        // Display Winner
        document.querySelector('.quiz-score-label').textContent = 'RESULT';
        quizElements.finalScore.textContent = winnerText;
        quizElements.finalScore.style.color = winnerColor;
        quizElements.finalScore.style.textShadow = "0 0 20px " + winnerColor;

        showQuizScreen('end');

    } else {
        // 1-Player Standard Logic
        document.querySelector('.quiz-score-label').textContent = 'Your Score';
        document.getElementById('quiz-end-leaderboard').classList.remove('hidden');
        quizElements.finalScore.style.color = "";
        quizElements.finalScore.style.textShadow = "";

        quizElements.finalScore.textContent = quizScore;
        showQuizScreen('end');

        checkQuizTopScore();
    }
}

async function checkQuizTopScore() {
    try {
        const response = await fetch('/api/quiz/check_top_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: quizScore })
        });

        const data = await response.json();

        if (data.is_top_score && quizScore > 0) {
            quizElements.nameEntry.classList.remove('hidden');
            quizElements.playerName.value = '';
            quizElements.playerName.focus();
            // Load leaderboard with placeholder for user's score
            loadQuizEndLeaderboardWithPlaceholder();
        } else {
            quizElements.nameEntry.classList.add('hidden');
            loadQuizEndLeaderboard();
        }
    } catch (error) {
        console.error('Failed to check top score:', error);
        quizElements.nameEntry.classList.add('hidden');
        loadQuizEndLeaderboard();
    }
}

function skipNameEntry() {
    // Hide the name entry and just show the regular leaderboard
    quizElements.nameEntry.classList.add('hidden');
    loadQuizEndLeaderboard();
}

async function loadQuizEndLeaderboardWithPlaceholder() {
    try {
        const response = await fetch('/api/quiz/leaderboard');
        const data = await response.json();
        displayQuizScoresWithPlaceholder(data.scores, quizElements.endScoresList, quizScore);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

function displayQuizScoresWithPlaceholder(scores, container, userScore) {
    container.innerHTML = '';

    // Find where user's score would be inserted
    let insertIndex = scores.findIndex(entry => userScore > entry.score);
    if (insertIndex === -1) insertIndex = scores.length;

    // Create combined list with placeholder
    let displayIndex = 0;
    for (let i = 0; i <= scores.length && displayIndex < 10; i++) {
        if (i === insertIndex) {
            // Insert flashing placeholder row
            const row = document.createElement('div');
            row.className = 'score-row score-placeholder';

            const rank = document.createElement('span');
            rank.className = 'rank';
            rank.textContent = `#${displayIndex + 1}`;

            const name = document.createElement('span');
            name.className = 'name placeholder-name';
            name.textContent = '???';

            const scoreVal = document.createElement('span');
            scoreVal.className = 'score-val';
            scoreVal.textContent = userScore;

            const dateTimeSpan = document.createElement('span');
            dateTimeSpan.className = 'score-datetime';
            dateTimeSpan.innerHTML = '<span class="score-date">NOW</span><span class="score-time"></span>';

            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(scoreVal);
            row.appendChild(dateTimeSpan);
            container.appendChild(row);
            displayIndex++;
        }

        if (i < scores.length && displayIndex < 10) {
            const entry = scores[i];
            const row = document.createElement('div');
            row.className = 'score-row';

            if (entry.stats) {
                row.dataset.hasStats = 'true';
                // Store full stats in a data attribute
                row.dataset.stats = JSON.stringify(entry.stats);

                // Click handler for fixed tooltip
                row.addEventListener('click', function (e) {
                    // Stop propagation to prevent document click from closing it immediately
                    e.stopPropagation();

                    const stats = JSON.parse(this.dataset.stats);
                    showFixedTooltip(this, stats);
                });

                // Add visual cue
                row.style.cursor = 'pointer';
            }

            const rank = document.createElement('span');
            rank.className = 'rank';
            rank.textContent = `#${displayIndex + 1}`;

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = entry.name;

            const scoreVal = document.createElement('span');
            scoreVal.className = 'score-val';
            scoreVal.textContent = entry.score;

            const dateTimeInfo = formatScoreDate(entry.date);
            const dateTimeSpan = document.createElement('span');
            dateTimeSpan.className = 'score-datetime';
            dateTimeSpan.innerHTML = `<span class="score-date">${dateTimeInfo.date}</span><span class="score-time">${dateTimeInfo.time}</span>`;

            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(scoreVal);
            row.appendChild(dateTimeSpan);
            container.appendChild(row);
            displayIndex++;
        }
    }
}

async function submitQuizScore() {
    const name = quizElements.playerName.value.trim().toUpperCase() || 'ANON';

    try {
        // Check for secret NUKE command to clear leaderboard
        if (name === 'NUKE') {
            const response = await fetch('/api/quiz/nuke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            quizElements.nameEntry.classList.add('hidden');
            displayQuizScores(data.scores, quizElements.endScoresList);
            displayQuizScores(data.scores, quizElements.sidebarScoresList);
            return;
        }

        const response = await fetch('/api/quiz/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score: quizScore,
                name: name,
                stats: gameStats
            })
        });

        const data = await response.json();

        quizElements.nameEntry.classList.add('hidden');
        displayQuizScores(data.scores, quizElements.endScoresList);
        displayQuizScores(data.scores, quizElements.sidebarScoresList);
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
}

async function loadQuizLeaderboard() {
    try {
        const response = await fetch('/api/quiz/leaderboard');
        const data = await response.json();
        displayQuizScores(data.scores, quizElements.sidebarScoresList);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

async function loadQuizEndLeaderboard() {
    try {
        const response = await fetch('/api/quiz/leaderboard');
        const data = await response.json();
        displayQuizScores(data.scores, quizElements.endScoresList);
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

function formatScoreDate(dateStr) {
    if (!dateStr) return { date: '', time: '' };
    try {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateText = `${months[date.getMonth()]} ${date.getDate()}`;
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        const timeText = `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}`;
        return { date: dateText, time: timeText };
    } catch (e) {
        return { date: '', time: '' };
    }
}

function displayQuizScores(scores, container) {
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

        if (entry.stats) {
            row.dataset.hasStats = 'true';
            row.dataset.stats = JSON.stringify(entry.stats);

            // Hover handler for fixed tooltip
            row.addEventListener('mouseenter', function (e) {
                const stats = JSON.parse(this.dataset.stats);
                showFixedTooltip(this, stats);
            });

            row.addEventListener('mouseleave', function (e) {
                hideFixedTooltip();
            });

            // Add visual cue
            row.style.cursor = 'pointer';
        }

        const scoreVal = document.createElement('span');
        scoreVal.className = 'score-val';
        scoreVal.textContent = entry.score;

        const dateTimeInfo = formatScoreDate(entry.date);
        const dateTimeSpan = document.createElement('span');
        dateTimeSpan.className = 'score-datetime';
        dateTimeSpan.innerHTML = `<span class="score-date">${dateTimeInfo.date}</span><span class="score-time">${dateTimeInfo.time}</span>`;

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(scoreVal);
        row.appendChild(dateTimeSpan);
        container.appendChild(row);
    });
}

// Keyboard shortcuts for quiz answers (A, B, C, D)
document.addEventListener('keydown', (e) => {
    if (currentAppMode !== 'quiz' || !quizIsGameActive || quizIsAnswerLocked) return;

    const key = e.key.toUpperCase();
    const keyMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

    if (key in keyMap) {
        const buttons = quizElements.answersContainer.querySelectorAll('.quiz-answer-btn');
        if (buttons[keyMap[key]] && !buttons[keyMap[key]].disabled) {
            selectQuizAnswer(keyMap[key]);
        }
    }
});

// Enter key to submit quiz name
quizElements.playerName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitQuizScore();
});

// Close tooltip when clicking outside
document.addEventListener('click', function (e) {
    const tooltip = document.getElementById('fixed-quiz-tooltip');
    if (tooltip && tooltip.style.visibility === 'visible') {
        hideFixedTooltip();
    }
});



// ===========================================
// Changelog System
// ===========================================

async function loadChangelog() {
    try {
        const response = await fetch('/static/changelog.json?t=' + Date.now());
        const changelogData = await response.json();

        // Update version label
        if (changelogData.length > 0) {
            document.getElementById('version-label').textContent = `v${changelogData[0].version}`;
        }

        const list = document.getElementById('changelog-list');
        list.innerHTML = changelogData.map(item => `
                    <div class="changelog-item">
                        <div class="changelog-header">
                            <span class="changelog-ver">v${item.version}</span>
                            <span class="changelog-date">${item.date}</span>
                        </div>
                        <div class="changelog-desc">${item.desc}</div>
                    </div>
                `).join('');
    } catch (error) {
        console.error('Failed to load changelog:', error);
    }
}

// ===========================================
// Admin Menu System
// ===========================================
let adminMenuOpen = false;

function toggleAdminMenu() {
    const popup = document.getElementById('admin-popup');
    adminMenuOpen = !adminMenuOpen;
    popup.classList.toggle('hidden', !adminMenuOpen);
}

function closeAdminMenu() {
    const popup = document.getElementById('admin-popup');
    adminMenuOpen = false;
    popup.classList.add('hidden');
}

// Close admin menu when clicking outside
document.addEventListener('click', function (e) {
    const container = document.querySelector('.admin-container');
    if (container && !container.contains(e.target) && adminMenuOpen) {
        closeAdminMenu();
    }
});

// ===========================================
// Update & Reboot System
// ===========================================
async function triggerUpdate() {
    if (!confirm('This will update from GitHub and reboot the device. Continue?')) {
        return;
    }

    const btn = document.querySelector('.update-action');
    btn.classList.add('loading');
    btn.querySelector('span').textContent = 'Updating...';

    try {
        const response = await fetch('/api/system/update', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            btn.querySelector('span').textContent = 'Rebooting...';
            setTimeout(() => {
                alert('Device is rebooting. Please wait about 30 seconds then refresh the page.');
            }, 1000);
        } else {
            alert(data.error || 'Update failed');
            btn.classList.remove('loading');
            btn.querySelector('span').textContent = 'Update & Reboot';
        }
    } catch (error) {
        alert('Update not available on this device');
        btn.classList.remove('loading');
        btn.querySelector('span').textContent = 'Update & Reboot';
    }
}

// ===========================================
// Reset Scores System
// ===========================================
function promptResetScores() {
    const password = prompt('Enter admin password to reset all scores:');

    if (password === null) {
        return; // Cancelled
    }

    if (password.toLowerCase() === 'nuke') {
        if (confirm('⚠️ WARNING: This will permanently delete ALL leaderboard scores. Are you absolutely sure?')) {
            resetAllScores();
        }
    } else {
        alert('❌ Incorrect password');
    }
}

async function resetAllScores() {
    try {
        const response = await fetch('/api/quiz/nuke', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ All scores have been reset!');
            loadQuizLeaderboard(); // Refresh the leaderboard
            closeAdminMenu();
        } else {
            alert('Failed to reset scores');
        }
    } catch (error) {
        alert('Error resetting scores: ' + error.message);
    }
}

// ===========================================
// Initialize
// ===========================================
// Create global tooltip element
const fixedTooltip = document.createElement('div');
fixedTooltip.id = 'fixed-quiz-tooltip';
fixedTooltip.className = 'score-tooltip fixed';
document.body.appendChild(fixedTooltip);

function showFixedTooltip(targetElement, stats) {
    const tooltip = document.getElementById('fixed-quiz-tooltip');

    // Populate content
    tooltip.innerHTML = `
                <div class="stat-item"><span class="stat-label">Correct:</span><span class="stat-val correct">+${stats.correct || 0}</span></div>
                <div class="stat-item"><span class="stat-label">Wrong:</span><span class="stat-val wrong">-${stats.wrong || 0}</span></div>
                <div class="stat-item"><span class="stat-label">Skips:</span><span class="stat-val skip">${stats.skips || 0}</span></div>
                <div class="stat-break"></div>
                <div class="stat-item"><span class="stat-label">Best Streak:</span><span class="stat-val streak">${stats.bestStreak || 0}</span></div>
                <div class="stat-break"></div>
                <div class="stat-item"><span class="stat-label">Best Streak:</span><span class="stat-val streak">${stats.bestStreak || 0}</span></div>
                <div class="stat-item"><span class="stat-label">Total Streaks:</span><span class="stat-val">${stats.streakCount || 0}</span></div>
            `;

    // Show and position
    tooltip.style.opacity = '1';
    tooltip.style.visibility = 'visible';

    const rect = targetElement.getBoundingClientRect();
    tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
    tooltip.style.left = `${rect.right + 15}px`;
    tooltip.style.transform = 'translateY(-50%)';
}

function hideFixedTooltip() {
    const tooltip = document.getElementById('fixed-quiz-tooltip');
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
}

loadCategories();
loadSkills();
loadTotalViews();
loadChangelog();
loadQuizLeaderboard();

// Canvas / 2-Player Mode Logic
// Force Gamepad selection when 2P is chosen
// Canvas / 2-Player Mode Logic
// Force Gamepad selection when 2P is chosen
document.querySelectorAll('input[name="player-mode"]').forEach(input => {
    input.addEventListener('change', (e) => {
        const mouseBtn = document.querySelector('.input-toggle-btn[data-mode="mouse"]');
        if (e.target.value === '2') {
            setInputMode('gamepad');
            if (mouseBtn) {
                mouseBtn.classList.add('disabled');
                mouseBtn.title = "Mouse disabled in 2-Player Mode";
            }
        } else {
            if (mouseBtn) {
                mouseBtn.classList.remove('disabled');
                mouseBtn.title = "Mouse Mode";
            }
        }
    });
});

// ===========================================
// SocketIO & Virtual Input (2-Player)
// ===========================================
const p2PosDisplay = document.getElementById('p2-pos');

// Check if library loaded
if (typeof io === 'undefined') {
    bridgeStatus.textContent = "LIB MISSING";
    bridgeStatus.style.color = "orange";
    throw new Error("Socket.IO library not found");
}

const socket = io();

socket.on('connect', () => {
    console.log('Connected to Input Bridge via SocketIO');
    bridgeStatus.textContent = "CONNECTED";
    bridgeStatus.style.color = "#00ff00";
});

socket.on('disconnect', () => {
    bridgeStatus.textContent = "DISCONNECTED";
    bridgeStatus.style.color = "red";
});

// Gamepad button handler
socket.on('gamepad_button', (data) => {
    console.log('[Gamepad] Button received:', data);

    // DEBUG: Update onscreen counter
    const statusText = document.getElementById('binding-status-text');
    if (statusText && inputMode === 'gamepad') {
        statusText.textContent = `Received Input! (Idx: ${data.answer_index})`;
        statusText.style.color = "cyan";
    }

    // Only handle gamepad input when in gamepad mode, quiz mode, and game is active
    if (inputMode === 'gamepad' && currentAppMode === 'quiz') {
        // FAILSAFE: If we receive a button press but are still on the binding screen,
        // it means we missed the bound event. Force start now.
        const bindingScreen = document.getElementById('quiz-binding-screen');
        if (bindingScreen && bindingScreen.classList.contains('active')) {
            console.log('[Gamepad] Button received on binding screen - forcing start');
            showQuizScreen('countdown');
            runCountdown();
            return; // Don't process this first button press as an answer
        }

        if (quizIsGameActive && !quizIsAnswerLocked) {
            const answerIndex = data.answer_index;
            if (answerIndex >= 0 && answerIndex <= 3) {
                const player = data.player || 1;
                selectQuizAnswer(answerIndex, player);
            }
        }
    }
});

// Gamepad bound handler - triggered when a controller claims the session
// Gamepad bound handler - triggered when a controller claims the session
socket.on('gamepad_bound', (data) => {
    console.log('[Gamepad] Controller bound:', data);
    const statusText = document.getElementById('binding-status-text');
    const player = data.player || 1;

    if (quizPlayerCount > 1) {
        // 2-Player Logic
        if (player === 1) {
            if (statusText) {
                statusText.textContent = "PLAYER 1 READY! Waiting for Player 2...";
                statusText.style.color = "#2196F3"; // Blue
                statusText.style.fontSize = "24px";
                statusText.style.fontWeight = "bold";
            }
            // Do NOT start yet, wait for P2
        } else if (player === 2) {
            if (statusText) {
                statusText.textContent = "PLAYER 2 READY! STARTING...";
                statusText.style.color = "#F44336"; // Red
            }
            // Both ready, start
            if (inputMode === 'gamepad') {
                setTimeout(() => {
                    showQuizScreen('countdown');
                    runCountdown();
                }, 1000);
            }
        }
    } else {
        // 1-Player Logic (Legacy)
        if (statusText) {
            statusText.textContent = "GAMEPAD BOUND! STARTING...";
            statusText.style.color = "#00ff00"; // Green
            statusText.style.fontSize = "24px";
            statusText.style.fontWeight = "bold";
        }

        if (inputMode === 'gamepad') {
            setTimeout(() => {
                showQuizScreen('countdown');
                runCountdown();
            }, 500);
        }
    }
});

// Binding Status Handler
socket.on('binding_status', (data) => {
    console.log('[Gamepad] Binding status:', data);
    const statusText = document.getElementById('binding-status-text');
    if (statusText) {
        statusText.textContent = data.message;
        if (data.status === 'error') {
            statusText.style.color = '#ef4444'; // red
        } else if (data.status === 'listening') {
            if (data.device_count > 0) {
                statusText.style.color = '#22c55e'; // green
            } else {
                statusText.style.color = '#eab308'; // yellow
            }
        }
    }
});

// Update cursor positions (60Hz interpolation target)
socket.on('state_update', (state) => {
    if (state.p1) {
        p1Cursor.style.transform = `translate(${state.p1.x}px, ${state.p1.y}px)`;
        p1PosDisplay.textContent = `${Math.round(state.p1.x)},${Math.round(state.p1.y)}`;
    }
    if (state.p2) {
        p2Cursor.style.transform = `translate(${state.p2.x}px, ${state.p2.y}px)`;
        p2PosDisplay.textContent = `${Math.round(state.p2.x)},${Math.round(state.p2.y)}`;
    }
});

// Handle Clicks
function handleVirtualClick(player, position) {
    // Find element at coordinates
    // Hide cursor momentarily so we don't click the cursor itself
    const cursor = player === 'p1' ? p1Cursor : p2Cursor;
    cursor.style.display = 'none';

    const el = document.elementFromPoint(position.x, position.y);

    // Show cursor again
    cursor.style.display = 'block';

    if (el) {
        console.log(`[${player.toUpperCase()}] Clicked:`, el.tagName, el.className);

        // If it's a button or interactive, click it
        // We might need to bubble up to find the closest button
        const clickable = el.closest('button') || el.closest('a') || (el.onclick ? el : null);

        if (clickable) {
            clickable.click();

            // Add visual ripple effect
            createRipple(position.x, position.y, player);
        }
    }
}

function createRipple(x, y, player) {
    const ripple = document.createElement('div');
    ripple.className = `click-ripple ${player}`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
}

// We need the latest position to simulate click
// The backend input_handler emits click event but not pos?
// Wait, backend 'p1_click' implies click at CURRENT p1 position.
// We can track the last known position from state_update.

let lastP1Pos = { x: 0, y: 0 };
let lastP2Pos = { x: 0, y: 0 };

socket.on('state_update', (state) => {
    if (state.p1) lastP1Pos = state.p1;
    if (state.p2) lastP2Pos = state.p2;
});

socket.on('p1_click', () => handleVirtualClick('p1', lastP1Pos));
socket.on('p2_click', () => handleVirtualClick('p2', lastP2Pos));

function cancelBinding() {
    showQuizStartScreen();
}

