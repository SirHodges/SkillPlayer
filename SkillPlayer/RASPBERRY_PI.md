# SkillPlayer - Raspberry Pi Instruction Guide

Follow these steps exactly to move your app from this computer to your Raspberry Pi.

## Part 1: Get Files onto the Pi

You can either download the code directly from GitHub (easiest) or transfer it via USB.

### Option A: Via GitHub (Recommended)
*Requires the Pi to be connected to the internet.*

1.  **Open Terminal** on your Raspberry Pi.
2.  **Clone the Repository**:
    Type the following command:
    ```bash
    cd ~
    git clone https://github.com/SirHodges/SkillPlayer.git
    ```
    *Note: `~` is a shortcut for your home folder (e.g. `/home/paramedictraining`)*

3.  **Enter Folder**:
    ```bash
    cd SkillPlayer
    ```
    *Note: If your repository is private, you may be asked for a username and a Personal Access Token as the password.*

### Option B: Via USB Drive (Offline Method)

1.  **Insert your USB Drive** (or SD card) into this computer.
2.  **Open the SkillPlayer folder**:
    `c:\Users\sirho\.gemini\antigravity\scratch\SkillPlayer`
3.  **Copy Files**:
    You only need the following specific files and folders. Select them and **COPY** them to your USB drive:
    
    *   **Files**:
        *   `app.py`
        *   `setup_pi.sh`
        *   `run_pi.sh`
        *   `SkillPlayer.desktop`
        *   `requirements.txt`
    *   **Folders**:
        *   `templates`
        *   `static`
        *   `content`

    *(Note: Do NOT copy the `dist`, `build`, or `.exe` files. They are for Windows only).*
4.  **Paste** them onto your USB Drive.
    *Recommendation: Create a folder on the USB drive called `SkillPlayer` and paste inside that.*

5.  **Move to Home (on Pi)**:
    *   Plug USB into Pi.
    *   Open File Manager on Pi.
    *   Drag the `SkillPlayer` folder to your **Home** folder (usually usually called `pi` or your username like `paramedictraining`).
    *   *Result: You should now have a folder located at `~/SkillPlayer`*.

## Part 2: Setup (On the Raspberry Pi)

1.  **Boot up** your Raspberry Pi and log in to the Desktop.
2.  **Plug in** the USB Drive.
3.  **Copy to Home**:
    *   Open the **File Manager** (folder icon).
    *   Find your USB drive on the left.
    *   Drag the `SkillPlayer` folder from the USB drive to your **Home** folder (usually called `pi` or your username like `paramedictraining`).
    *   *Result: You should now have a folder located at `~/SkillPlayer`*.

4.  **Open Terminal**:
    *   Click the default **Terminal** icon (black screen icon) in the top bar.

5.  **Run Setup**:
    Type these commands exactly (press Enter after each line):

    ```bash
    cd ~/SkillPlayer
    ```

    ```bash
    bash setup_pi.sh
    ```

    *Wait for it to finish installing Python libraries. It might ask for your password (default is typically `raspberry` or `pi` unless you changed it).*

## Part 3: Running the App

### Option A: From Terminal (Test First)
While still in the terminal, type:

```bash
./run_pi.sh
```

The browser should open automatically with the app!

### Option B: Create Desktop Icon
1.  Open File Manager and go to your `SkillPlayer` folder.
2.  Find the file named `SkillPlayer.desktop`.
3.  **Copy** it (Right click > Copy).
4.  Go to your **Desktop** folder.
5.  **Paste** it (Right click > Paste).
6.  **Trust the Shortcut** (Important!):
    *   Double-click the new `SkillPlayer` icon on your desktop.
    *   It will pop up a window asking if you want to "Execute" or "Trust".
    *   Choose **"Execute"** (or "Trust Executable").
    
Now you check double-click it anytime to launch the app!

---
## Troubleshooting
- **No Audio?**: Right-click the speaker icon on the Pi top bar and ensure HDMI or AV Jack is selected correctly.
- **Videos Laggy?**: The Pi Zero might struggle with 4K videos. 1080p or 720p is recommended for Raspberry Pi.

To get the latest version from GitHub:

### First Time Setup (If you installed via USB)
If you originally copied files via USB, your Pi doesn't know about GitHub yet. Run this **one time** to connect them:

```bash
cd ~/SkillPlayer
git init
git branch -M main
git remote add origin https://github.com/SirHodges/SkillPlayer.git
git fetch --all
git reset --hard origin/main
```
*Note: This is safe! It won't delete your scores or data.*

### Standard Update Command
Once connected (or if you cloned from GitHub originally), just run:

1.  **Open Terminal**.
2.  **Type these commands**:
    ```bash
    cd ~/SkillPlayer
    git pull
    ```
    *This will download any new changes (like version 1.8!) immediately.*

