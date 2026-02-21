# 🗺️ Quick Start: Map Visualization

## Fastest Way to See the Map

```bash
# 1. Install dependencies (first time only)
pip install folium

# 2. Generate map with all visualizations
python main.py --visualize --map

# 3. View the map
python view_map.py
```

**OR** just open directly:
```bash
start reports\charts\priority_map.html
```

## What You'll See

An **interactive map of Islamabad** showing **80 complaints** color-coded by priority:
- 🔴 **Red markers** = Top 10 most critical (Fire hazards, structural damage)
- 🟠 **Orange markers** = High priority (11-25)
- 🟡 **Yellow markers** = Medium priority (26-50)
- 🟢 **Green markers** = Low priority (51+)

## Map Features

### Click any marker to see:
- Complaint ID and title
- Priority score (0-1) and rank (#1-80)
- Location name (e.g., "Blue Area", "F-10 Markaz")
- Type (gas_leak, pothole, electrical_hazard, etc.)
- Severity (critical, high, medium, low)
- Department (Public Works, Roads, Water Supply, etc.)
- Number of affected people
- Description

### Map Controls (top right):
- 🖼️ **Layers**: Switch between map styles
- 🔍 **Zoom**: + and - buttons
- ⛶ **Fullscreen**: Expand to full screen
- 🧭 **Pan**: Click and drag to move around

### Legend (bottom right):
Shows what each color means with total complaint count

## Sample High-Priority Complaints on Map

Look for these RED markers:

1. **Fire Hazard I-9 Market** (Priority: 0.7310)
   - Location: I-9 Markaz (33.6632°N, 73.0617°E)
   - 800 people affected
   
2. **Bridge Structural Issue Faizabad** (Priority: 0.7138)
   - Location: Faizabad Interchange (33.6538°N, 73.0854°E)
   - 2000 people affected
   
3. **Railway Crossing Gate Fault** (Priority: 0.6967)
   - Location: Golra Railway Station (33.6215°N, 73.0718°E)
   - 1000 people affected

4. **Electrical Hazard G-6** (Priority: 0.6861)
   - Location: G-6 Markaz (33.7075°N, 73.0831°E)
   - 120 people affected

5. **Fire Hydrant Malfunction F-7** (Priority: 0.6761)
   - Location: F-7 Markaz (33.7213°N, 73.0533°E)
   - 600 people affected

## Islamabad Areas Covered

The map includes complaints from:

**Commercial Areas:**
- Blue Area (city center)
- Aabpara Market
- Melody Market

**Residential Sectors:**
- F Series: F-6, F-7, F-8, F-9, F-10, F-11
- G Series: G-6, G-7, G-8, G-9, G-10, G-11
- I Series: I-8, I-9, I-10, I-11
- H Series: H-8, H-9
- E Series: E-7, E-11

**Landmarks:**
- Zero Point
- Centaurus Mall
- Faizabad Interchange
- Serena Chowk

**Parks:**
- F-6 Park (Fatima Jinnah Park)
- F-7 Park
- Rose Garden
- Japan Park
- Shakarparian
- Lake View Park
- Daman-e-Koh

**Major Roads:**
- Jinnah Avenue
- Constitution Avenue
- Faisal Avenue
- Kashmir Highway
- Murree Road
- Islamabad Expressway
- Margalla Road

## Command Line Options

```bash
# Just the map
python main.py --map

# Map + all charts
python main.py --visualize --map

# Specify input/output files
python main.py --map --input data/complaints.csv --output results.csv

# Show top N complaints
python main.py --map --top-n 20
```

## Output Location

All visualizations are saved in:
```
reports/charts/
├── priority_map.html          ← Open this in browser!
├── criteria_weights.png
├── priority_distribution.png
├── priority_by_type.png
├── priority_levels.png
└── criteria_heatmap.png
```

## How AHP Prioritization Works

The map colors are based on **AHP (Analytic Hierarchy Process)** scores:

### Criteria Weights:
- 🛡️ **Public Safety Risk**: 42.4% (highest weight)
- 👥 **Scale of Impact**: 18.7%
- ⏰ **Urgency Level**: 23.2%
- 💰 **Resource Requirements**: 7.2%
- 🏛️ **Department Capacity**: 8.6%

Each complaint gets a score (0-1) based on these criteria, then ranked #1-80.

## Troubleshooting

**Map won't open?**
```bash
# Install folium first
pip install folium

# Make sure you generated the map
python main.py --map
```

**No markers showing?**
- Check that CSV has latitude/longitude columns
- Verify coordinates are valid decimal degrees
- Look at console for error messages

**Map performance slow?**
- The system automatically uses marker clustering for 100+ complaints
- Try viewing fewer complaints: `python main.py --map --top-n 50`

## For Developers

Want to customize? Edit these files:
- `src/visualizer.py`: Map generation logic
- `data/sample_complaints.csv`: Add more complaints with coordinates
- `main.py`: Change default behavior

See `MAP_VISUALIZATION_GUIDE.md` for detailed customization options.

## Need Help?

1. Check `MAP_VISUALIZATION_GUIDE.md` for detailed docs
2. Read `MAP_UPDATE_SUMMARY.md` for technical details
3. View `README.md` for general system info
4. Check `QUICKSTART.md` for basic usage

---

**Enjoy exploring Islamabad's complaints on the interactive map! 🗺️🇵🇰**
