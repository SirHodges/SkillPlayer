# Troubleshooting: "Risky Action Blocked" or Virus Warning

If Windows Security or your antivirus blocks `SkillPlayer.exe`, don't panic! This is a common "false positive" for custom-made applications that aren't digitally signed.

Because this app was just created and hasn't been downloaded by millions of people, Windows Defender treats it as "unknown" and therefore "risky".

## How to Fix It

### Option 1: Unblock the File (easiest)
1. Right-click on `SkillPlayer.exe`.
2. Select **Properties**.
3. At the bottom of the **General** tab, look for a checkbox that says **Unblock** (it might be next to text saying "This file came from another computer...").
4. Check **Unblock**, click **Apply**, and then **OK**.
5. Try running the app again.

### Option 2: Allow in Windows Security
1. When the "Risky action blocked" notification pops up, click it (or go to **Start > Settings > Privacy & security > Windows Security > Virus & threat protection**).
2. Click on **Protection history**.
3. Find the entry for `SkillPlayer.exe` (it might be labeled as "Severe" or "Threat blocked").
4. Click on it, allowing the dropdown to expand.
5. Click **Actions** and select **Allow on device**.
6. Try running the app again.

### Option 3: "Windows protected your PC" (SmartScreen)
If you see a blue window saying "Windows protected your PC":
1. Click the underlined text that says **More info**.
2. A new button will appear at the bottom: **Run anyway**.
3. Click **Run anyway**.

## Why is this happening?
Commercial software developers pay for "Code Signing Certificates" (like a digital ID card) that tell Windows exactly who made the software. This custom portable app is "unsigned," so Windows acts with extreme caution.

# Build & Runtime Issues (Developer Log)

## Issue: "TemplateNotFound: index.html" / App Crashes on Start
**Date**: 2026-01-12
**Symptoms**: The `SkillPlayer.exe` opens briefly and closes, or logs show `jinja2.exceptions.TemplateNotFound: index.html`.
**Cause**: The PyInstaller build process (or a manual move of the dist folder) failed to include the `templates` and `static` directories inside the `dist/SkillPlayer` folder. The executable requires these folders to be sitting next to it.
**Fix**:
1. Copy the `templates` folder from the source to `dist/SkillPlayer/templates`.
2. Copy the `static` folder from the source to `dist/SkillPlayer/static`.
3. Ensure `SkillPlayer.spec` is used for future builds, as it contains the instructions to auto-include these folders:
   ```python
   datas=[('templates', 'templates'), ('static', 'static')],
   ```
