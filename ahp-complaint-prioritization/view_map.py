"""
Quick Map Viewer
Opens the generated priority map in the default browser
"""

import os
import sys
import webbrowser
from pathlib import Path

def open_map():
    """Open the priority map in the default browser."""
    map_path = Path('reports/charts/priority_map.html')
    
    if not map_path.exists():
        print("[ERROR] Map not found!")
        print("Please generate the map first by running:")
        print("   python main.py --map")
        return False
    
    # Get absolute path
    abs_path = map_path.resolve()
    
    print(f"Opening map: {abs_path}")
    
    # Open in browser
    webbrowser.open(f'file:///{abs_path}')
    
    print("[OK] Map opened in your default browser")
    print()
    print("Map Features:")
    print("  • Click markers for complaint details")
    print("  • Use zoom controls to navigate")
    print("  • Switch map styles using layer control")
    print("  • Legend shows priority color codes")
    
    return True

if __name__ == "__main__":
    open_map()
