# 🚀 How to Create a Desktop Shortcut

## Option 1: Simple Shortcut (Recommended)

### Windows Method

1. **Navigate to the project folder:**
   ```
   D:\appdev\frontend-web\ahp-complaint-prioritization
   ```

2. **Right-click on `run_dashboard.bat`**

3. **Select "Send to" → "Desktop (create shortcut)"**

4. **Done!** Double-click the desktop shortcut to launch the dashboard

### Rename the Shortcut

1. Right-click the desktop shortcut
2. Select "Rename"
3. Change to: **"AHP Dashboard"** or **"Complaint System"**

---

## Option 2: Custom Shortcut

### Create Manually

1. **Right-click on Desktop** → New → Shortcut

2. **Enter location:**
   ```
   D:\appdev\frontend-web\ahp-complaint-prioritization\run_dashboard.bat
   ```

3. **Click "Next"**

4. **Name it:** "AHP Complaint Dashboard"

5. **Click "Finish"**

### Change Icon (Optional)

1. Right-click shortcut → Properties
2. Click "Change Icon"
3. Select an icon from Windows system icons
4. Or browse to custom icon if you have one
5. Click OK

---

## Option 3: Pin to Taskbar

### Windows 10/11

1. Create desktop shortcut first (see above)
2. Right-click the shortcut
3. Select "Pin to taskbar"
4. Now click the taskbar icon to launch!

---

## Option 4: Startup on Boot (Auto-run)

### To Launch Dashboard When Windows Starts

1. **Press** `Win + R`
2. **Type:** `shell:startup`
3. **Press Enter** (Startup folder opens)
4. **Copy `run_dashboard.bat`** to this folder
5. Dashboard will auto-launch on Windows startup

**To disable:** Just delete the file from Startup folder

---

## Quick Access Methods

### Method 1: Start Menu
1. Right-click `run_dashboard.bat`
2. Select "Pin to Start"

### Method 2: Quick Launch
1. Create desktop shortcut
2. Drag to taskbar
3. One-click access

### Method 3: Custom Keyboard Shortcut
1. Create desktop shortcut
2. Right-click → Properties
3. Click in "Shortcut key" field
4. Press desired key combo (e.g., Ctrl+Alt+A)
5. Click OK

---

## Troubleshooting Shortcuts

### Shortcut Doesn't Work

**Issue:** Double-clicking does nothing

**Fix:**
1. Right-click shortcut → Properties
2. Check "Target" field shows correct path
3. Check "Start in" field shows folder path:
   ```
   D:\appdev\frontend-web\ahp-complaint-prioritization
   ```
4. Click OK

### "File Not Found" Error

**Fix:**
1. Edit shortcut properties
2. Update paths if project folder moved
3. Or recreate shortcut in new location

### Permission Denied

**Fix:**
1. Right-click shortcut → Properties
2. Advanced → Run as administrator
3. Or run PowerShell version: `run_dashboard.ps1`

---

## Best Setup

### Recommended Configuration

1. **Desktop shortcut** for easy access
2. **Taskbar pin** for quick launch
3. **Renamed** to "AHP Dashboard"
4. **Custom icon** for visual clarity

### One-Time Setup (2 minutes)

```
1. Right-click run_dashboard.bat
2. Send to Desktop
3. Rename shortcut on desktop
4. Pin to taskbar
5. Done! ✅
```

---

## Multiple Computers

### Share Across Team

If you want team members to use the dashboard:

1. **Copy entire project folder** to their computer
2. **Update shortcut path** to match their system
3. **Send them** `DASHBOARD_GUIDE.md` for instructions

### Network Drive Setup

If project is on network drive:

1. Create shortcut with **UNC path**:
   ```
   \\server\share\ahp-complaint-prioritization\run_dashboard.bat
   ```
2. Share shortcut with team
3. Everyone accesses same data

---

## Icons (Optional)

### Where to Get Icons

**Free Icon Sources:**
- [Icons8](https://icons8.com)
- [Flaticon](https://www.flaticon.com)
- [IconFinder](https://www.iconfinder.com)

**Search for:**
- "dashboard"
- "analytics"
- "map"
- "chart"

### Set Custom Icon

1. Download `.ico` file
2. Save to project folder
3. Right-click shortcut → Properties
4. Change Icon → Browse
5. Select downloaded `.ico` file
6. Apply

---

## Quick Reference Card

Print or save this for your desk:

```
╔════════════════════════════════════════╗
║   AHP COMPLAINT DASHBOARD - SHORTCUTS  ║
╠════════════════════════════════════════╣
║                                        ║
║  Desktop Icon:                         ║
║    Double-click to launch dashboard    ║
║                                        ║
║  Taskbar:                              ║
║    Single-click for quick access       ║
║                                        ║
║  Keyboard:                             ║
║    [Your custom shortcut key]          ║
║                                        ║
║  Manual:                               ║
║    Run: run_dashboard.bat              ║
║                                        ║
╚════════════════════════════════════════╝
```

---

## Success! ✅

Once set up, launching the dashboard is as simple as:

**Double-click desktop icon** → **Dashboard opens** → **Select action** → **View results**

Total time: 3 seconds! 🚀
