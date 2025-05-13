/**
 * Helper functions for map drawing operations
 */

/**
 * Initialize drawing capabilities on a Mapbox map instance
 * @param {Object} map - The Mapbox map instance
 * @param {Function} onDrawComplete - Callback when drawing completes
 * @returns {Object} - Drawing control methods
 */
export const initializeDrawingCapabilities = (map, onDrawComplete = () => {}) => {
  // Ensure the map is loaded
  if (!map) {
    console.error('Map instance is required');
    return null;
  }
  
  console.log('Initializing drawing capabilities');
  
  try {
    // Create source for drawn features if it doesn't exist
    if (!map.getSource('drawing-source')) {
      map.addSource('drawing-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      console.log('Created drawing source');
    }
    
    // Create layers for drawn features if they don't exist
    if (!map.getLayer('drawing-polygon')) {
      map.addLayer({
        id: 'drawing-polygon',
        type: 'fill',
        source: 'drawing-source',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': 'rgba(0, 123, 255, 0.2)',
          'fill-outline-color': '#0069e0'
        }
      });
      console.log('Created drawing-polygon layer');
    }
    
    if (!map.getLayer('drawing-line')) {
      map.addLayer({
        id: 'drawing-line',
        type: 'line',
        source: 'drawing-source',
        filter: ['in', '$type', 'LineString', 'Polygon'],
        paint: {
          'line-color': '#0069e0',
          'line-width': 2
        }
      });
      console.log('Created drawing-line layer');
    }
    
    if (!map.getLayer('drawing-point')) {
      map.addLayer({
        id: 'drawing-point',
        type: 'circle',
        source: 'drawing-source',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#0069e0',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      console.log('Created drawing-point layer');
    }
  } catch (error) {
    console.error('Error setting up drawing layers:', error);
  }
  
  // Drawing state
  let isDrawing = false;
  let currentMode = null;
  let currentFeature = null;
  let currentPoints = [];
  
  // Clean up any existing listeners
  const cleanup = () => {
    try {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.off('dblclick', handleDoubleClick);
      console.log('Cleaned up drawing listeners');
    } catch (error) {
      console.error('Error cleaning up listeners:', error);
    }
  };
  
  // Handle clicks when drawing
  const handleClick = (e) => {
    if (!isDrawing) return;
    console.log('Click in drawing mode:', e.lngLat);
    
    const { lng, lat } = e.lngLat;
    
    if (currentMode === 'point') {
      // For points, we just add the point and complete
      currentFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        properties: {}
      };
      
      // Update the drawing source
      try {
        const source = map.getSource('drawing-source');
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: [currentFeature]
          });
          console.log('Point created at:', [lng, lat]);
        }
      } catch (error) {
        console.error('Error updating source with point:', error);
      }
      
      // Notify completion
      onDrawComplete({
        type: 'point',
        feature: currentFeature
      });
      
      // Keep drawing mode active
      
    } else if (currentMode === 'polygon') {
      // For polygons, add point to current points
      currentPoints.push([lng, lat]);
      console.log('Added point to polygon:', [lng, lat]);
      
      // Check if we're closing the polygon
      if (currentPoints.length >= 3) {
        const firstPoint = currentPoints[0];
        const lastPoint = [lng, lat];
        const distance = Math.sqrt(
          Math.pow(firstPoint[0] - lastPoint[0], 2) + 
          Math.pow(firstPoint[1] - lastPoint[1], 2)
        );
        
        // If clicking near the first point, close the polygon
        if (distance < 0.0001) { // Small threshold
          console.log('Closing polygon - clicked near first point');
          // Use all but this last point, and add the exact first point to close
          currentPoints.pop(); // Remove the approximate closing click
          
          // Create a closed polygon
          const polygonCoords = [...currentPoints, currentPoints[0]];
          
          currentFeature = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [polygonCoords]
            },
            properties: {}
          };
          
          // Update source
          try {
            const source = map.getSource('drawing-source');
            if (source) {
              source.setData({
                type: 'FeatureCollection',
                features: [currentFeature]
              });
              console.log('Polygon completed with', currentPoints.length, 'points');
            }
          } catch (error) {
            console.error('Error updating source with polygon:', error);
          }
          
          // Notify completion
          onDrawComplete({
            type: 'polygon',
            feature: currentFeature
          });
          
          // Reset points for next drawing
          currentPoints = [];
          return;
        }
      }
      
      // If we have at least 3 points, we can form a polygon
      if (currentPoints.length >= 3) {
        // Create a closed polygon
        const polygonCoords = [...currentPoints, currentPoints[0]];
        
        currentFeature = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [polygonCoords]
          },
          properties: {}
        };
        
        // Update the drawing source with both the polygon and the line string
        const lineFeature = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [...currentPoints]
          },
          properties: {}
        };
        
        try {
          const source = map.getSource('drawing-source');
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: [currentFeature, lineFeature]
            });
          }
        } catch (error) {
          console.error('Error updating source with polygon and line:', error);
        }
      } else {
        // Just show the line string if we have less than 3 points
        const lineFeature = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [...currentPoints]
          },
          properties: {}
        };
        
        try {
          const source = map.getSource('drawing-source');
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: [lineFeature]
            });
          }
        } catch (error) {
          console.error('Error updating source with line:', error);
        }
      }
    }
  };
  
  // Handle mouse move for drawing
  const handleMouseMove = (e) => {
    if (!isDrawing || currentMode !== 'polygon' || currentPoints.length === 0) return;
    
    const { lng, lat } = e.lngLat;
    
    // Show a preview line from the last point to the current mouse position
    const lineFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [...currentPoints, [lng, lat]]
      },
      properties: {}
    };
    
    try {
      const source = map.getSource('drawing-source');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: currentFeature ? [currentFeature, lineFeature] : [lineFeature]
        });
      }
    } catch (error) {
      console.error('Error updating preview line:', error);
    }
  };
  
  // Handle double click to complete polygon
  const handleDoubleClick = (e) => {
    if (!isDrawing || currentMode !== 'polygon' || currentPoints.length < 3) return;
    
    // Prevent default behavior
    e.preventDefault();
    
    console.log('Double click - completing polygon with', currentPoints.length, 'points');
    
    // Create final polygon
    const polygonCoords = [...currentPoints, currentPoints[0]];
    
    currentFeature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [polygonCoords]
      },
      properties: {}
    };
    
    // Update source
    try {
      const source = map.getSource('drawing-source');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [currentFeature]
        });
      }
    } catch (error) {
      console.error('Error updating final polygon:', error);
    }
    
    // Notify completion
    onDrawComplete({
      type: 'polygon',
      feature: currentFeature
    });
    
    // Keep drawing mode active but reset points
    currentPoints = [];
  };
  
  // Enable drawing mode
  const enableDrawing = (mode) => {
    console.log(`Enabling drawing mode: ${mode}`);
    
    // Clean up first
    cleanup();
    
    // Set drawing state
    isDrawing = true;
    currentMode = mode;
    currentPoints = [];
    currentFeature = null;
    
    // Clear existing features
    try {
      const source = map.getSource('drawing-source');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    } catch (error) {
      console.error('Error clearing drawing source:', error);
    }
    
    // Change cursor
    map.getCanvas().style.cursor = 'crosshair';
    
    // Add event listeners
    map.on('click', handleClick);
    
    if (mode === 'polygon') {
      map.on('mousemove', handleMouseMove);
      map.on('dblclick', handleDoubleClick);
    }
    
    console.log(`Drawing mode ${mode} enabled`);
    return true;
  };
  
  // Disable drawing mode
  const disableDrawing = () => {
    console.log('Disabling drawing mode');
    cleanup();
    isDrawing = false;
    currentMode = null;
    map.getCanvas().style.cursor = '';
    return true;
  };
  
  // Clear all drawn features
  const clearDrawing = () => {
    console.log('Clearing drawing');
    try {
      const source = map.getSource('drawing-source');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    } catch (error) {
      console.error('Error clearing drawing:', error);
    }
    currentFeature = null;
    currentPoints = [];
    return true;
  };
  
  // Check if we have drawn features
  const hasDrawnFeatures = (type) => {
    if (!currentFeature) return false;
    
    if (type) {
      return currentFeature.geometry.type.toLowerCase().includes(type.toLowerCase());
    }
    
    return true;
  };
  
  // Return interface
  return {
    enableDrawing,
    disableDrawing,
    clearDrawing,
    hasDrawnFeatures,
    getCurrentFeature: () => currentFeature
  };
};
