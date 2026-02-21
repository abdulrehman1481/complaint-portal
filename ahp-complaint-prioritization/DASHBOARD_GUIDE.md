# 🎛️ Dashboard User Guide

## Quick Start

### Windows Users

**Double-click one of these files:**
- `run_dashboard.bat` (Recommended)
- `run_dashboard.ps1` (PowerShell version)

That's it! The dashboard will open automatically.

---

## Dashboard Features

### 📊 Main Actions

#### 1. **Run Complete Analysis**
- Generates everything: Charts + Interactive Map + Report
- Takes 30-60 seconds
- Best for comprehensive analysis
- **Output:**
  - 📊 All charts (5 PNG files)
  - 🗺️ Interactive map (HTML)
  - 📄 Summary report (TXT)
  - 📑 Prioritized data (CSV)

#### 2. **Quick Prioritization Only**
- Fast analysis without visualizations
- Takes 5-10 seconds
- Best for quick updates
- **Output:**
  - 📑 Prioritized data (CSV)
  - 📄 Summary report (TXT)

#### 3. **Generate Interactive Map Only**
- Creates just the map visualization
- Takes 15-20 seconds
- Best for geographic view
- **Output:**
  - 🗺️ Interactive map (HTML)

#### 4. **Generate Charts Only**
- Creates all charts without map
- Takes 20-30 seconds
- Best for statistical analysis
- **Output:**
  - 📊 All charts (5 PNG files)

### 👁️ View Results

#### **Open Interactive Map**
- Opens the map in your default browser
- Shows all 80 complaints color-coded by priority
- Interactive markers with details

#### **Open Reports Folder**
- Opens Windows Explorer to `reports/charts/`
- View all generated files
- Easy access to visualizations

#### **View CSV Results**
- Opens the prioritized results in Excel/default CSV viewer
- See all complaints ranked by priority
- Includes all AHP scores

---

## Dashboard Interface

### Left Panel - Actions
- **Green button**: Complete analysis
- **Blue button**: Quick prioritization
- **Orange button**: Map only
- **Purple button**: Charts only
- **Teal/Gray buttons**: View results

### Right Panel - Output Console
- Real-time command output
- Shows progress and results
- Scrollable text area
- Dark theme for readability

### Status Bar (Bottom)
- Shows current operation status
- Color-coded:
  - **Gray**: Ready
  - **Orange**: Running
  - **Green**: Success
  - **Red**: Error

---

## Step-by-Step Usage

### First Time Use

1. **Double-click** `run_dashboard.bat`
2. Dashboard window opens
3. Click **"Run Complete Analysis"** (green button)
4. Wait 30-60 seconds (watch output console)
5. Success message appears
6. Click **"Open Interactive Map"** to view results

### Daily Use

1. Open dashboard (double-click `.bat` file)
2. Click **"Quick Prioritization Only"** for fast updates
3. Or click **"Generate Interactive Map Only"** to refresh map
4. View results using the "View Results" buttons

### Viewing Past Results

1. Open dashboard
2. Click **"Open Interactive Map"** directly
3. No need to regenerate if already created
4. Same for CSV and reports folder

---

## Understanding the Output

### Output Console Messages

**Good Signs (✅):**
```
✓ Loaded 80 complaints
✓ Prioritization complete
✓ Results exported
✅ Success: Complete Analysis completed!
```

**Warnings (⚠️):**
```
Warning: folium not installed
Missing coordinates for some complaints
```

**Errors (❌):**
```
✗ Error: Input file not found
✗ Error loading data
❌ Command failed
```

### Status Bar Messages

- `Ready | 80 Complaints | ...` - System ready
- `Running: Complete Analysis...` - Processing
- `✅ Completed: ...` - Success
- `❌ Failed: ...` - Error occurred

---

## Troubleshooting

### Dashboard Won't Open

**Issue:** Double-clicking `.bat` file does nothing

**Solutions:**
1. Right-click → "Run as Administrator"
2. Try `run_dashboard.ps1` instead
3. Or manually: `python dashboard.py`

**Issue:** "Python not found" error

**Solutions:**
1. Install Python from [python.org](https://www.python.org/downloads/)
2. Check "Add Python to PATH" during installation
3. Restart computer after installation

### Actions Not Working

**Issue:** Clicking buttons does nothing

**Solutions:**
1. Check output console for errors
2. Make sure `main.py` exists in same folder
3. Verify you're in the correct directory

**Issue:** "Map not found" when trying to open

**Solutions:**
1. Click "Generate Interactive Map Only" first
2. Wait for success message
3. Then try "Open Interactive Map" again

### Output Not Showing

**Issue:** Console is blank or frozen

**Solutions:**
1. Click "Clear Output" button
2. Try running command again
3. Close and reopen dashboard

---

## Keyboard Shortcuts

- **Alt+F4**: Close dashboard
- **Ctrl+C**: Can't stop running process (use X button)
- **Mouse scroll**: Scroll output console

---

## Tips & Best Practices

### 💡 Pro Tips

1. **First run of the day**: Use "Run Complete Analysis" to ensure everything is up-to-date

2. **Quick updates**: Use "Quick Prioritization Only" when you just need new rankings

3. **Share results**: After generating, open reports folder and share files with team

4. **Before presentations**: Run complete analysis to have fresh visualizations

5. **Monitor output**: Watch the console to see what's happening in real-time

### ⚡ Performance Tips

1. **Close other programs** when running complete analysis

2. **Don't click multiple buttons** at once - wait for completion

3. **Use "Clear Output"** periodically to keep console fast

4. **Keep dashboard open** - no need to close between runs

### 🎯 Workflow Recommendations

**Morning Routine:**
```
1. Open dashboard
2. Run Complete Analysis
3. Open Interactive Map
4. Share map link with team
```

**Quick Check:**
```
1. Open dashboard
2. Quick Prioritization Only
3. View CSV Results
```

**Presentation Prep:**
```
1. Run Complete Analysis
2. Open Reports Folder
3. Copy all charts to presentation
```

---

## Advanced Usage

### Custom Commands

You can modify the dashboard to run custom commands:

1. Open `dashboard.py` in a text editor
2. Find the command strings (e.g., `"python main.py --visualize --map"`)
3. Add your own parameters
4. Save and restart dashboard

### Adding New Buttons

To add new functionality:
1. Copy an existing button code block
2. Modify the text, color, and command
3. Save and test

---

## File Locations

### Generated Files

```
reports/
└── charts/
    ├── priority_map.html          ← Interactive map
    ├── criteria_weights.png       ← Criteria chart
    ├── priority_distribution.png  ← Distribution
    ├── priority_by_type.png       ← By type
    ├── priority_levels.png        ← Pie chart
    └── criteria_heatmap.png       ← Heatmap

data/
└── prioritized_results.csv        ← Ranked complaints

reports/
└── summary_report.txt              ← Text report
```

### Dashboard Files

```
dashboard.py           ← Main dashboard code
run_dashboard.bat      ← Windows batch launcher
run_dashboard.ps1      ← PowerShell launcher
DASHBOARD_GUIDE.md     ← This guide
```

---

## System Requirements

- **OS**: Windows 7/8/10/11
- **Python**: 3.7 or higher
- **RAM**: 2GB minimum, 4GB recommended
- **Disk**: 100MB free space
- **Display**: 1024x768 minimum resolution

---

## Support & Help

### Check These First

1. **Output console**: Read error messages carefully
2. **Status bar**: Shows current operation status
3. **This guide**: Most issues covered here

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Python not found" | Python not installed | Install Python |
| "File not found" | Wrong directory | Check file locations |
| "Map not found" | Not generated yet | Generate map first |
| "Command failed" | Syntax error | Check main.py |

### Still Need Help?

1. Check `README.md` for system overview
2. Read `MAP_VISUALIZATION_GUIDE.md` for map details
3. Review `QUICKSTART.md` for basic usage
4. Check output console for specific errors

---

## Updating the System

### When New Data Added

1. Replace `data/sample_complaints.csv` with new data
2. Open dashboard
3. Run "Complete Analysis"
4. View updated map and charts

### When Code Updated

1. Get new version of files
2. Close dashboard if open
3. Replace old files
4. Reopen dashboard
5. Run analysis to test

---

## Security Notes

- Dashboard runs Python scripts locally
- No internet connection required (except for map tiles)
- All data stays on your computer
- Safe to use on corporate networks

---

**Happy analyzing! 🎉**

For more information, see other guides:
- `MAP_QUICKSTART.md` - Quick map guide
- `MAP_VISUALIZATION_GUIDE.md` - Detailed map guide
- `README.md` - System overview
