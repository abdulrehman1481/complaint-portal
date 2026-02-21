# Map Visualization Guide

## Overview
The AHP Complaint Prioritization System now includes interactive map visualization that displays complaints on an Islamabad map, color-coded by their priority scores calculated using the AHP algorithm.

## Features

### Interactive Map Display
- **Color-coded markers** based on priority ranking:
  - 🔴 **Red**: Top 1-10 (Critical Priority)
  - 🟠 **Orange**: Top 11-25 (High Priority)
  - 🟡 **Yellow**: Top 26-50 (Medium Priority)
  - 🟢 **Green**: 51+ (Low Priority)

### Marker Details
Each marker shows detailed complaint information when clicked:
- Complaint ID and title
- Priority score and rank
- Location name
- Complaint type
- Severity level
- Assigned department
- Number of affected people
- Description

### Map Controls
- **Multiple map styles**: Switch between OpenStreetMap, Light, and Dark themes
- **Fullscreen mode**: View complaints in fullscreen
- **Legend**: Shows priority level color codes
- **Zoom and pan**: Navigate through Islamabad

## Usage

### Basic Usage
```bash
python main.py --map
```

### With All Visualizations
```bash
python main.py --visualize --map
```

### Output
The interactive map is saved as `reports/charts/priority_map.html`

Open it in any web browser to explore the complaints interactively.

## Data Requirements

The CSV file must include these columns for map visualization:
- `id`: Complaint identifier
- `title`: Complaint title
- `latitude`: Geographic latitude (decimal degrees)
- `longitude`: Geographic longitude (decimal degrees)
- `priority_score`: Calculated AHP priority score
- `priority_rank`: Priority ranking
- `type`: Complaint type
- `severity`: Severity level
- `department`: Responsible department
- `affected_people`: Number of people affected
- `location_name`: Human-readable location name
- `description`: Complaint description

## Islamabad Coverage

The sample data includes **80 complaints** across Islamabad, covering:
- **Commercial areas**: Blue Area, Aabpara, Melody Market
- **Residential sectors**: F-6, F-7, F-8, F-9, F-10, F-11, G-6, G-7, G-8, G-9, G-10, G-11, H-8, H-9, I-8, I-9, I-10, E-7, E-11
- **Landmarks**: Zero Point, Faisal Avenue, Jinnah Avenue, Constitution Avenue
- **Parks**: F-6 Park, F-7 Park, Rose Garden, Shakarparian, Lake View Park, Daman-e-Koh
- **Major roads**: Margalla Road, Kashmir Highway, Murree Road, Islamabad Expressway

### Coordinate System
- **Projection**: WGS 84 (EPSG:4326)
- **Center**: ~33.6844°N, 73.0479°E (Islamabad center)
- **Zoom level**: 12 (city-wide view)

## Installation

Make sure you have the required dependencies:

```bash
pip install folium
```

Or install all requirements:

```bash
pip install -r requirements.txt
```

## How It Works

1. **Data Loading**: Reads complaint data with coordinates from CSV
2. **AHP Prioritization**: Calculates priority scores using AHP algorithm
3. **Map Generation**: Creates interactive map using Folium library
4. **Marker Placement**: Places color-coded markers based on priority
5. **HTML Export**: Saves as standalone HTML file

## Customization

### Change Map Center
Edit the `plot_priority_map` function in `src/visualizer.py`:
```python
center_lat = 33.6844  # Islamabad center
center_lon = 73.0479
```

### Adjust Color Thresholds
Modify the `get_marker_color` function:
```python
def get_marker_color(priority_score, priority_rank):
    if priority_rank <= 10:  # Top 10 = red
        return 'red'
    elif priority_rank <= 25:  # 11-25 = orange
        return 'orange'
    # ... etc
```

### Change Marker Sizes
Modify the `get_marker_size` function:
```python
def get_marker_size(priority_score, priority_rank):
    if priority_rank <= 10:
        return 12  # Larger for critical
    # ... etc
```

## Examples

### View Top 50 Complaints on Map
```bash
python main.py --map --top-n 50
```

### Generate Complete Report with Map
```bash
python main.py --visualize --map --output results.csv --report report.txt
```

## Benefits

1. **Geographic Context**: See where high-priority complaints are clustered
2. **Spatial Analysis**: Identify problem areas in the city
3. **Resource Allocation**: Plan field agent routes efficiently
4. **Decision Support**: Visualize priority distribution across Islamabad
5. **Stakeholder Communication**: Share interactive maps with management

## Troubleshooting

### Map Not Loading
- Check if `folium` is installed: `pip install folium`
- Verify the HTML file was created: `reports/charts/priority_map.html`
- Open directly in browser if command fails

### Missing Coordinates
- Ensure CSV has `latitude` and `longitude` columns
- Check for null/empty coordinate values
- Verify coordinates are in decimal degree format

### Performance Issues
For large datasets (>500 complaints), the map uses marker clustering automatically.

## Future Enhancements

Potential improvements:
- Heat map overlay for complaint density
- Time-based animation showing complaint trends
- Clustering by department or type
- Route optimization for field agents
- Real-time updates with live data
- District/sector boundaries overlay
- Integration with Supabase for live data

## Related Files

- `src/visualizer.py`: Map generation code
- `data/sample_complaints.csv`: Complaint data with coordinates
- `main.py`: Main application with --map flag
- `requirements.txt`: Dependencies including folium

## Support

For issues or questions:
1. Check that all dependencies are installed
2. Verify CSV format matches requirements
3. Review the generated HTML file for errors
4. Check browser console for JavaScript errors
