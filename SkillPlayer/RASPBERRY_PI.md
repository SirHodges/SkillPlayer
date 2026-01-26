# SkillPlayer - Raspberry Pi Instruction Guide

Follow these steps exactly to move your app from this computer to your Raspberry Pi.

## Part 1: Move Files (On your Windows PC)

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

## Part 2: Setup (On the Raspberry Pi)

1.  **Boot up** your Raspberry Pi and log in to the Desktop.
2.  **Plug in** the USB Drive.
3.  **Copy to Home**:
    *   Open the **File Manager** (folder icon).
    *   Find your USB drive on the left.
    *   Drag the `SkillPlayer` folder from the USB drive to the `/home/pi/` folder (standard user home).
    *   *Result: You should now have a folder located at `/home/pi/SkillPlayer`*.

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
