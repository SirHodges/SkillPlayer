# SkillPlayer Application Features

## SkillPlayer Mode

### Content Organization
- **Category System**: Content organized into tabs (Skills, Equipment, Other)
- **Topic Sidebar**: Scrollable list of topics with custom logos
- **NEW Badges**: Automatically flags content added within the last 14 days
- **Bilingual Support**: English and French placeholder text

### Media Playback
- **Video Player**: Full-featured HTML5 video player with controls
- **PDF Viewer**: Inline PDF display for training bulletins
- **Content Cards**: Visual buttons showing available videos/PDFs per topic
- **Auto-scroll**: Scrolls to player when content is selected on mobile

### Visual Design
- **Dark Theme**: Modern dark UI with purple accent gradients
- **Animated Arrow**: Bouncing red arrow guides users
  - Points left → sidebar when no topic selected
  - Points down → content when topic selected
- **Pulsing Cards**: Content cards have subtle border animation
- **Premium Styling**: Glassmorphism effects and smooth transitions

### Tracking
- **View Counter**: Tracks total content views across all sessions
- **Persistent Storage**: View counts saved to JSON file

---

## Quiz Mode

### Gameplay
- **1-Minute Challenge**: Race against the clock to answer questions
- **Random Questions**: Questions shuffled from JSON question bank
- **Shuffled Answers**: Answer order randomized each time
- **Skip Option**: Skip questions for -1 second penalty

### Timing System
| Action | Effect |
|--------|--------|
| Correct answer | +2 seconds |
| Wrong answer | -5 seconds |
| Skip question | -1 second |

### Scoring System
- **Base Points**: 10 points per correct answer
- **Streak Bonus**: +1 point per streak level (max +5)
- **Maximum**: 15 points per answer at 7+ streak

### Streak System
| Streak | Display | Color |
|--------|---------|-------|
| 3 | Streak! | Purple |
| 4 | On Fire! | Orange |
| 5 | Megastreak! | Red |
| 6 | ULTRASTREAK! | Pink |
| 7+ | PARAGOD! | Gold (pulsing) |

- **Visual Indicator**: Large star with countdown ring on right side
- **Expiry Timer**: 7-second countdown to maintain streak
- **Ring Animation**: Shows remaining time before streak expires

### Visual Feedback
- **Floating Score**: Green "+X" floats up when earning points
- **Answer Delay**: 2-second fade-in for answer buttons (prevents accidental clicks)
- **Color Coding**: Green for correct, red for wrong answers
- **Quick Countdown**: "3, 2, 1, GO!" with 500ms GO transition

### Leaderboard
- **Top 10 Scores**: Saves highest scores with player names
- **10-Character Names**: Virtual keyboard for name entry
- **Date/Time Stamps**: Shows when each score was achieved
- **Auto-Cleanup**: Removes scores older than 14 days
- **Sidebar Display**: Always visible during Quiz mode

### Controls
- **Virtual Keyboard**: On-screen QWERTY for name entry
- **Stop Attempt**: End quiz early without submitting
- **Play Again**: Quick restart after game ends
