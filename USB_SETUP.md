# USB Content Storage Setup Guide

This guide explains how to use a USB drive to store your videos and PDFs instead of the Raspberry Pi's SD card.

## Why Use USB Storage?

- **Save SD Card Space**: Keep the Pi's SD card free for the operating system
- **Portable Content**: Easily swap USB drives with different content libraries
- **Larger Capacity**: Use bigger USB drives (64GB, 128GB, etc.) for more content

---

## Quick Setup (3 Steps)

### Step 1: Prepare Your USB Drive

1. **Label your USB drive** as `SKILLPLAYER` (case-sensitive)
   - **Windows**: Right-click drive → Properties → Change label
   - **Mac**: Select drive → Get Info → Change name
   - **Linux**: Use `Disks` utility or: `sudo e2label /dev/sda1 SKILLPLAYER`

2. **Create folder structure** on the USB drive:
   ```
   SKILLPLAYER (USB Drive)
   └─ content/
       ├─ Skills/
       │   └─ [Your Skill Folders]/
       ├─ Equipment/
       │   └─ [Your Equipment Folders]/
       └─ Other/
           └─ [Other Content Folders]/
   ```

3. **Copy your videos** into the appropriate skill/equipment/topic folders

### Step 2: Insert USB into Raspberry Pi

1. Plug the USB drive into any USB port on the Pi
2. Wait a few seconds for it to auto-mount
3. Verify it mounted: Open File Manager, check for drive under `/media/pi/SKILLPLAYER`

### Step 3: Start SkillPlayer

Run the app as normal:
```bash
./run_pi.sh
```

The app will automatically detect and use the USB drive!

**Console output will confirm**:
```
[Content] Using USB drive: /media/pi/SKILLPLAYER/content
Content folder: /media/pi/SKILLPLAYER/content
```

---

## Advanced: Custom USB Path

If your USB drive has a different name or mount point:

### Option 1: Set Environment Variable (One-Time)
```bash
export SKILLPLAYER_CONTENT_PATH=/media/pi/MYUSBDRIVE/videos
./run_pi.sh
```

### Option 2: Set Permanently
Add to `~/.bashrc`:
```bash
echo 'export SKILLPLAYER_CONTENT_PATH=/media/pi/MYUSBDRIVE/videos' >> ~/.bashrc
source ~/.bashrc
```

### Option 3: Modify run_pi.sh
Edit `run_pi.sh` and add before the python line:
```bash
export SKILLPLAYER_CONTENT_PATH=/your/custom/path
```

---

## Troubleshooting

### Issue: App uses local content folder instead of USB

**Check 1**: Is USB inserted and mounted?
```bash
ls /media/pi/SKILLPLAYER
```
If error: USB not mounted or wrong label

**Check 2**: Does content folder exist on USB?
```bash
ls /media/pi/SKILLPLAYER/content
```
If error: Create the `content/` folder

**Check 3**: Verify label
```bash
lsblk -o NAME,LABEL,MOUNTPOINT
```
Look for your USB drive and check the LABEL column

### Issue: USB not auto-mounting

**Fix**: Unplug and re-plug the USB drive, wait 10 seconds

OR manually mount:
```bash
sudo mount /dev/sda1 /media/pi/SKILLPLAYER
```

### Issue: Permission denied errors

**Fix**: Set proper permissions:
```bash
sudo chmod -R 755 /media/pi/SKILLPLAYER/content
```

---

## Fallback Behavior

SkillPlayer will automatically fall back to local storage if:
- USB drive is not inserted
- USB drive is not labeled `SKILLPLAYER`
- No `content/` folder exists on the USB
- Environment variable points to non-existent path

**Fallback path**: `~/SkillPlayer/content` (local SD card)

---

## Tips

- **Keep a backup**: Copy your content folder to your computer periodically
- **Multiple USB drives**: Prepare multiple drives labeled `SKILLPLAYER` to swap different content libraries
- **Format recommendation**: Use FAT32 or exFAT for Windows/Mac/Linux compatibility
- **Safe removal**: Always eject USB properly before unplugging (right-click in File Manager → Eject)

---

## Migration from Local to USB

Already have content in `~/SkillPlayer/content`? Copy it to USB:

```bash
# Insert USB drive
# Then copy everything:
cp -r ~/SkillPlayer/content/* /media/pi/SKILLPLAYER/content/

# Verify it worked:
ls /media/pi/SKILLPLAYER/content
```

You can delete the local copy after confirming USB works:
```bash
rm -rf ~/SkillPlayer/content/*
```
