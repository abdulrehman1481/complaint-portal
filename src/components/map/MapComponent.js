import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import * as turf from '@turf/turf';
import { useNavigate } from 'react-router-dom';
import { parseLocation } from '../../utils/locationFormatter';
import { X } from 'lucide-react';  // Import the X icon from lucide-react
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
// Mapbox token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJyZWhtYW4xMTIyIiwiYSI6ImNtNHlrY3Q2cTBuYmsyaXIweDZrZG9yZnoifQ.FkDynV0HksdN7ICBxt2uPg';

// Category to icon & color mapping
const categoryIcons = {
  'Potholes': { icon: 'roadblock', color: '#e67e22' },
  'Traffic Light Issues': { icon: 'traffic-light', color: '#e74c3c' },
  'Street Lighting': { icon: 'lightbulb', color: '#f39c12' },
  'Garbage Collection': { icon: 'trash', color: '#8e44ad' },
  'Graffiti': { icon: 'paintbucket', color: '#3498db' },
  'Water Supply': { icon: 'water', color: '#2980b9' },
  'Sewage Issues': { icon: 'droplet', color: '#27ae60' },
  'Parks & Recreation': { icon: 'park', color: '#16a085' },
  'Public Transport': { icon: 'bus', color: '#f1c40f' },
  'Other': { icon: 'alert-triangle', color: '#95a5a6' }
};

// Default icon for categories not in the mapping
const defaultCategoryIcon = { icon: 'map-pin', color: '#3498db' };

const MapComponent = forwardRef(({ 
  mapConfig, 
  setMapLoaded, 
  complaints, 
  setSelectedComplaint, 
  user,
  departments = [],
  onMapReady
}, ref) => {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const drawInstance = useRef(null);
  const popupInstance = useRef(null);
  const mapStyleChangeRef = useRef(null);  // Added missing ref for debouncing style changes
  const [sourcesInitialized, setSourcesInitialized] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analysisLayer, setAnalysisLayer] = useState(null);
  const [isAnalysisInProgress, setIsAnalysisInProgress] = useState(false);

  // Helper function to count points within an area
// Fix the countPointsInArea function
// Fix the countPointsInArea function to properly handle turf.js polygon analysis

const countPointsInArea = (feature) => {
  if (!mapInstance.current) return { totalPoints: 0 };
  
  try {
    console.log("Starting area analysis with feature:", feature);
    
    // Get complaints source
    const complaintsSource = mapInstance.current.getSource('complaints');
    if (!complaintsSource || !complaintsSource._data) {
      console.warn("No complaints data available for analysis");
      return { totalPoints: 0 };
    }
    
    // Filter only point features
    const points = complaintsSource._data.features.filter(
      f => f.geometry && f.geometry.type === 'Point'
    );
    
    console.log(`Found ${points.length} total complaints points to test against polygon`);
    
    // Ensure we have a valid polygon
    if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
      console.warn("Invalid polygon for analysis:", feature);
      return { totalPoints: 0, error: "Invalid polygon geometry" };
    }
    
    // Print raw coordinates for debugging
    console.log("Polygon coordinates:", JSON.stringify(feature.geometry.coordinates).substring(0, 100) + "...");
    
    // Find points that are within the polygon
    const pointsWithin = [];
    for (const point of points) {
      try {
        // Use turf.js to check if point is in polygon
        const isInside = turf.booleanPointInPolygon(
          point.geometry.coordinates, 
          feature.geometry
        );
        
        if (isInside) {
          pointsWithin.push(point);
        }
      } catch (err) {
        console.error("Error in point-in-polygon test for point:", err);
        console.log("Problem point:", JSON.stringify(point.geometry.coordinates));
      }
    }
    
    console.log(`Found ${pointsWithin.length} points within the polygon`);
    
    // Calculate statistics
    const totalComplaints = points.length;
    const pointsByStatus = {open: 0, in_progress: 0, resolved: 0};
    const pointsByCategory = {};
    const pointsByPriority = {1: 0, 2: 0, 3: 0};
    
    // Count by status and category
    pointsWithin.forEach(point => {
      const status = point.properties.status || 'unknown';
      const category = point.properties.category_name || 'Other';
      const priority = point.properties.priority || 1;
      
      pointsByStatus[status] = (pointsByStatus[status] || 0) + 1;
      pointsByCategory[category] = (pointsByCategory[category] || 0) + 1;
      pointsByPriority[priority] = (pointsByPriority[priority] || 0) + 1;
    });
    
    // Calculate area in square kilometers
    const area = turf.area(feature) / 1000000; // convert from m² to km²
    
    // Calculate density (complaints per sq km)
    const density = area > 0 ? (pointsWithin.length / area) : 0;
    
    return {
      totalPoints: pointsWithin.length,
      pointsByStatus,
      pointsByCategory,
      pointsByPriority,
      area: Number(area.toFixed(4)),
      density: Number(density.toFixed(2)),
      percentOfTotal: totalComplaints > 0 
        ? Number(((pointsWithin.length / totalComplaints) * 100).toFixed(1))
        : 0
    };
  } catch (error) {
    console.error('Error in countPointsInArea:', error);
    return { totalPoints: 0, error: error.message };
  }
};

  // Helper function to count points in buffer zone - fixed version
  const countPointsInBufferZone = (bufferFeature) => {
    if (!mapInstance.current) return { totalPoints: 0 };
    
    try {
      // Get complaints source
      const complaintsSource = mapInstance.current.getSource('complaints');
      if (!complaintsSource || !complaintsSource._data) {
        return { totalPoints: 0 };
      }
      
      // Ensure we have valid geometry
      if (!bufferFeature || (!bufferFeature.geometry && !bufferFeature.type)) {
        console.error('Invalid buffer feature', bufferFeature);
        return { totalPoints: 0, error: 'Invalid buffer geometry' };
      }
      
      // Extract the actual geometry to test against
      const testGeometry = bufferFeature.geometry || bufferFeature;
      
      const points = complaintsSource._data.features.filter(
        f => f.geometry && f.geometry.type === 'Point'
      );
      
      const pointsWithin = points.filter(point => {
        try {
          return turf.booleanPointInPolygon(
            point.geometry.coordinates, 
            testGeometry
          );
        } catch (err) {
          console.error('Error testing point in buffer:', err);
          return false;
        }
      });
      
      const pointsByCategory = {};
      const pointsByStatus = {};
      const pointsByPriority = {1: 0, 2: 0, 3: 0};
      
      pointsWithin.forEach(point => {
        const category = point.properties.category_name || 'Other';
        const status = point.properties.status || 'unknown';
        const priority = point.properties.priority || 1;
        
        pointsByCategory[category] = (pointsByCategory[category] || 0) + 1;
        pointsByStatus[status] = (pointsByStatus[status] || 0) + 1;
        pointsByPriority[priority] = (pointsByPriority[priority] || 0) + 1;
      });
      
      // Calculate area safely
      let area = 0;
      try {
        area = turf.area(bufferFeature) / 1000000; // convert to km²
      } catch (err) {
        console.error('Error calculating buffer area:', err);
        // Try to calculate with a different approach
        if (bufferFeature.geometry) {
          area = turf.area(bufferFeature.geometry) / 1000000;
        }
      }
      
      const density = area > 0 ? (pointsWithin.length / area) : 0;
      
      return {
        totalPoints: pointsWithin.length,
        pointsByCategory,
        pointsByStatus,
        pointsByPriority,
        area,
        density: Number(density.toFixed(2))
      };
    } catch (error) {
      console.error('Error in countPointsInBufferZone:', error);
      return { totalPoints: 0, error: error.message };
    }
  };

  // Define the methods to expose via ref
  useImperativeHandle(ref, () => ({
    // Get the map instance
    getMapInstance: () => mapInstance.current,
    
    // Get the center of the map
    getCenter: () => {
      if (!mapInstance.current) return { lng: 0, lat: 0 };
      const center = mapInstance.current.getCenter();
      return { lng: center.lng, lat: center.lat };
    },
    
    // Fly to a specific location
    flyTo: (lng, lat, zoom = 15) => {
      if (!mapInstance.current) return;
      mapInstance.current.flyTo({
        center: [lng, lat],
        zoom: zoom,
        essential: true
      });
    },
    
    // Enable drawing mode - improved implementation
// Improve the enableDrawingMode method in your useImperativeHandle ref object
filterComplaints: (filters) => {
  if (!mapInstance.current || !mapInstance.current.getSource('complaints')) {
    console.warn('Map source not available for filtering');
    return;
  }
  
  try {
    // Get current data
    const source = mapInstance.current.getSource('complaints');
    const currentData = source._data;
    
    if (!currentData || !currentData.features) {
      console.warn('No complaints data available for filtering');
      return;
    }
    
    // Start with all features
    let filteredFeatures = [...currentData.features];
    
    // Apply category filter
    if (filters.category && filters.category.length > 0) {
      filteredFeatures = filteredFeatures.filter(feature => {
        const categoryId = feature.properties.category_id;
        return filters.category.includes(categoryId.toString());
      });
    }
    
    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      filteredFeatures = filteredFeatures.filter(feature => {
        const status = feature.properties.status;
        return filters.status.includes(status);
      });
    }
    
    // Apply date range filter
    if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
      filteredFeatures = filteredFeatures.filter(feature => {
        try {
          const complaintDate = new Date(feature.properties.created_at_raw);
          
          if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start);
            if (complaintDate < startDate) return false;
          }
          
          if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end);
            // Add 1 day to end date for inclusive filtering
            endDate.setDate(endDate.getDate() + 1);
            if (complaintDate > endDate) return false;
          }
          
          return true;
        } catch (err) {
          console.warn('Error parsing date for filtering:', err);
          return true; // Include if date parsing fails
        }
      });
    }
    
    // Apply keyword filter
    if (filters.keyword && filters.keyword.trim() !== '') {
      const keyword = filters.keyword.toLowerCase().trim();
      filteredFeatures = filteredFeatures.filter(feature => {
        const title = (feature.properties.title || '').toLowerCase();
        const description = (feature.properties.description || '').toLowerCase();
        return title.includes(keyword) || description.includes(keyword);
      });
    }
    
    // Update the source with filtered data
    source.setData({
      type: 'FeatureCollection',
      features: filteredFeatures
    });
    
    console.log(`Filtered complaints: ${filteredFeatures.length} matching out of ${currentData.features.length} total`);
    return filteredFeatures.length;
  } catch (error) {
    console.error('Error filtering complaints:', error);
  }
},
enableDrawingMode: (mode = 'simple_select') => {
  if (!mapInstance.current) {
    console.warn('Map instance not available');
    return false;
  }
  
  // If drawing instance doesn't exist, create it
  if (!drawInstance.current) {
    console.log('Creating new drawing instance');
    
    try {
      drawInstance.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          point: true,
          line_string: true,
          polygon: true,
          trash: true
        }
      });
      
      mapInstance.current.addControl(drawInstance.current, 'top-left');
      
      // Set up draw events
// Add draw event handlers to capture analysis data

// Add this to your map initialization code, after drawInstance is created
mapInstance.current.on('draw.create', (e) => {
  try {
    console.log('Feature created:', e.features);
    const feature = e.features[0];
    
    // If a polygon was drawn, automatically run point count analysis
    if (feature.geometry.type === 'Polygon') {
      // Delay analysis to let the UI update
      setTimeout(() => {
        const result = countPointsInArea(feature);
        if (result && result.totalPoints !== undefined) {
          setAnalysisResults({
            type: 'pointCount',
            data: result,
            feature: feature,
            timestamp: new Date().toISOString()
          });
        }
      }, 200);
    }
  } catch (err) {
    console.error('Error handling draw.create event:', err);
  }
});

// Handle draw complete event
mapInstance.current.on('draw.update', (e) => {
  try {
    console.log('Feature updated:', e.features);
    // If a polygon was updated, rerun analysis
    const feature = e.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      setTimeout(() => {
        const result = countPointsInArea(feature);
        if (result) {
          setAnalysisResults({
            type: 'pointCount',
            data: result,
            feature: feature,
            timestamp: new Date().toISOString()
          });
        }
      }, 200);
    }
  } catch (err) {
    console.error('Error handling draw.update event:', err);
  }
});
    } catch (err) {
      console.error('Failed to create drawing instance:', err);
      return false;
    }
  }
  
  try {
    console.log('Activating drawing mode:', mode);
    
    // First cancel any active drawing modes
    if (drawInstance.current) {
      drawInstance.current.changeMode('simple_select');
      
      // Allow a brief moment before changing to the new mode
      setTimeout(() => {
        // Then activate the requested mode
        switch (mode) {
          case 'point':
            drawInstance.current.changeMode('draw_point');
            break;
          case 'line':
            drawInstance.current.changeMode('draw_line_string');
            break;
          case 'polygon':
            drawInstance.current.changeMode('draw_polygon');
            break;
          case 'select':
          default:
            drawInstance.current.changeMode('simple_select');
            break;
        }
      }, 50);
    }
    
    return true;
  } catch (error) {
    console.error('Error enabling drawing mode:', error);
    return false;
  }
},

// Update the deleteAllDrawings method
deleteAllDrawings: () => {
  if (drawInstance.current) {
    try {
      // First switch to simple select mode to clear any active drawing
      drawInstance.current.changeMode('simple_select');
      
      // Then delete after a brief delay
      setTimeout(() => {
        drawInstance.current.deleteAll();
      }, 50);
      
      return true;
    } catch (error) {
      console.error('Error deleting drawings:', error);
      return false;
    }
  }
  return false;
},
    
    // Create a buffer around selected features - fixed implementation
    createBuffer: (distance) => {
      if (!mapInstance.current || !drawInstance.current) return null;
      
      try {
        setIsAnalysisInProgress(true);
        
        // Get selected features
        let features = drawInstance.current.getSelected().features;
        
        // If no features are selected, check if we have any drawn features
        if (features.length === 0) {
          const allFeatures = drawInstance.current.getAll().features;
          
          if (allFeatures.length > 0) {
            // Select the first feature automatically
            drawInstance.current.changeMode('simple_select', { 
              featureIds: [allFeatures[0].id] 
            });
            features = [allFeatures[0]];
            console.log("Auto-selected first drawn feature for buffer analysis");
          } else {
            // If no drawn features, use the current map center
            const center = mapInstance.current.getCenter();
            
            // Create a point feature at map center
            const centerFeature = {
              type: 'Feature',
              id: 'center-point-' + Date.now(),
              properties: { 
                source: 'map-center',
                description: 'Auto-created point for buffer analysis'
              },
              geometry: {
                type: 'Point',
                coordinates: [center.lng, center.lat]
              }
            };
            
            // Add this feature to the draw instance and select it
            const addedFeatures = drawInstance.current.add(centerFeature);
            
            if (addedFeatures.length > 0) {
              drawInstance.current.changeMode('simple_select', { 
                featureIds: [addedFeatures[0]]
              });
              features = [centerFeature];
              console.log("Created and selected map center point for buffer analysis");
            }
          }
        }
        
        if (features.length === 0) {
          alert('Could not select or create a feature for buffer analysis.');
          setIsAnalysisInProgress(false);
          return null;
        }
        
        console.log("Creating buffer for features:", features);
        console.log("Buffer distance:", distance);
        
        // Rest of the existing buffer creation code
        const bufferedFeatures = [];
        for (const feature of features) {
          try {
            // Convert distance from meters to kilometers for turf
            const distanceKm = distance / 1000;
            const buffered = turf.buffer(feature, distanceKm, { units: 'kilometers' });
            console.log("Created buffer:", buffered);
            bufferedFeatures.push(buffered);
          } catch (err) {
            console.error('Error creating buffer with turf:', err, feature);
          }
        }
        
        if (bufferedFeatures.length === 0) {
          alert('Failed to create buffer. Please try again with a different feature.');
          setIsAnalysisInProgress(false);
          return null;
        }
        
        // Merge buffers if there are multiple
        let finalBuffer;
        if (bufferedFeatures.length === 1) {
          finalBuffer = bufferedFeatures[0];
        } else {
          try {
            // For multiple buffers, try to use union operation
            console.log("Merging multiple buffers");
            finalBuffer = bufferedFeatures[0]; // Start with the first buffer
            
            for (let i = 1; i < bufferedFeatures.length; i++) {
              try {
                finalBuffer = turf.union(finalBuffer, bufferedFeatures[i]);
              } catch (unionErr) {
                console.error('Error in buffer union operation:', unionErr);
              }
            }
          } catch (err) {
            console.error('Error merging buffers:', err);
            // Fallback to just using the first buffer if union fails
            finalBuffer = bufferedFeatures[0];
          }
        }
        
        console.log("Final buffer:", finalBuffer);
        
        // Add a property to identify this feature as a buffer
        finalBuffer.properties = finalBuffer.properties || {};
        finalBuffer.properties.analysisType = 'buffer';
        finalBuffer.properties.bufferDistance = distance;
        
        // First update the buffer source
        if (mapInstance.current.getSource('buffers')) {
          mapInstance.current.getSource('buffers').setData(finalBuffer);
          
          // Ensure buffer layer is visible
          const bufferLayers = ['buffer-fill', 'buffer-outline'];
          bufferLayers.forEach(layer => {
            if (mapInstance.current.getLayer(layer)) {
              mapInstance.current.setLayoutProperty(layer, 'visibility', 'visible');
            }
          });
        }
        
        // Then create a visualization using our highlight function
        highlightAnalysisArea(finalBuffer, 'buffer');
        
        // Count points within this buffer for analysis
        const result = countPointsInBufferZone(finalBuffer);
        result.bufferDistance = distance;
        
        setAnalysisResults({
          type: 'buffer',
          data: result,
          bufferDistance: distance,
          feature: finalBuffer
        });
        
        setIsAnalysisInProgress(false);
        return finalBuffer;
      } catch (error) {
        console.error('Error creating buffer:', error);
        alert('Error creating buffer. Please try again with a simpler feature.');
        setIsAnalysisInProgress(false);
        return null;
      }
    },
    
    // Count points within a selected polygon
// Fix the countPointsInPolygon function
// Update the countPointsInPolygon function to properly get drawn features

countPointsInPolygon: () => {
  if (!mapInstance.current || !drawInstance.current) {
    alert('Please draw a polygon first');
    return 0;
  }
  
  try {
    setIsAnalysisInProgress(true);
    
    // Get selected polygon
    const selected = drawInstance.current.getSelected().features;
    if (selected.length === 0) {
      // If nothing is selected, try to get all drawn features
      const allFeatures = drawInstance.current.getAll().features;
      if (allFeatures.length === 0) {
        alert('Please draw or select a polygon first');
        setIsAnalysisInProgress(false);
        return 0;
      }
      
      // Look for a polygon in the drawn features
      const polygonFeature = allFeatures.find(f => 
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );
      
      if (!polygonFeature) {
        alert('Please draw a polygon for this analysis');
        setIsAnalysisInProgress(false);
        return 0;
      }
      
      // Select this polygon automatically
      drawInstance.current.changeMode('simple_select', { featureIds: [polygonFeature.id] });
      
      // Use this polygon for analysis
      console.log("Found non-selected polygon for analysis:", polygonFeature);
      processPolygonAnalysis(polygonFeature);
      return;
    }
    
    let selectedFeature = selected[0];
    
    // Verify polygon type
    if (selectedFeature.geometry.type !== 'Polygon' && 
        selectedFeature.geometry.type !== 'MultiPolygon') {
      alert('Please select a polygon for this analysis');
      setIsAnalysisInProgress(false);
      return 0;
    }
    
    console.log("Processing polygon analysis for feature:", selectedFeature);
    processPolygonAnalysis(selectedFeature);
  } catch (error) {
    console.error('Error counting points in polygon:', error);
    alert('Error performing analysis. Please try again.');
    setIsAnalysisInProgress(false);
    return 0;
  }
  
  // Helper function to process the analysis once we have a valid polygon
  function processPolygonAnalysis(feature) {
    // Make sure the feature has proper GeoJSON structure
    if (!feature.type) {
      feature = {
        type: 'Feature',
        properties: feature.properties || {},
        geometry: feature.geometry
      };
    }
    
    // Highlight the selected polygon
    highlightAnalysisArea(feature);
    
    // Run the analysis
    const result = countPointsInArea(feature);
    console.log("Analysis result:", result);
    
    // Store the results for display
    setAnalysisResults({
      type: 'pointCount',
      data: result,
      feature: feature,
      timestamp: new Date().toISOString()
    });
    
    setIsAnalysisInProgress(false);
    return result.totalPoints;
  }
},
    
    // Calculate average distance between points - robust implementation
    calculateAverageDistance: () => {
      if (!mapInstance.current) return 0;
      
      try {
        setIsAnalysisInProgress(true);
        
        // Get complaints source
        const complaintsSource = mapInstance.current.getSource('complaints');
        if (!complaintsSource || !complaintsSource._data) {
          alert('No complaint data available for distance analysis');
          setIsAnalysisInProgress(false);
          return 0;
        }
        
        // Filter only point features
        const points = complaintsSource._data.features.filter(
          f => f.geometry && f.geometry.type === 'Point'
        );
        
        if (points.length < 2) {
          alert('Need at least 2 complaints to calculate distance');
          setIsAnalysisInProgress(false);
          return 0;
        }
        
        console.log(`Distance analysis: Processing ${points.length} points`);
        
        // For large datasets, limit the number of points to prevent performance issues
        let pointsToAnalyze = points;
        const maxPointsForFullAnalysis = 100;
        let limitedAnalysis = false;
        
        if (points.length > maxPointsForFullAnalysis) {
          limitedAnalysis = true;
          // Use strategic sampling instead of just taking first N points
          // Get every Nth point to cover the whole dataset better
          const samplingRate = Math.ceil(points.length / maxPointsForFullAnalysis);
          pointsToAnalyze = points.filter((_, index) => index % samplingRate === 0);
          
          if (pointsToAnalyze.length > maxPointsForFullAnalysis) {
            pointsToAnalyze = pointsToAnalyze.slice(0, maxPointsForFullAnalysis);
          }
          
          console.log(`Limited analysis to ${pointsToAnalyze.length} points (sampling rate: ${samplingRate})`);
        }
        
        // Calculate distances between all point pairs
        const distances = [];
        let totalDistance = 0;
        let count = 0;
        
        for (let i = 0; i < pointsToAnalyze.length; i++) {
          for (let j = i + 1; j < pointsToAnalyze.length; j++) {
            try {
              const from = pointsToAnalyze[i].geometry.coordinates;
              const to = pointsToAnalyze[j].geometry.coordinates;
              
              if (!from || !to || from.length < 2 || to.length < 2) {
                console.warn('Invalid coordinates, skipping:', from, to);
                continue;
              }
              
              const distance = turf.distance(from, to, {units: 'kilometers'});
              
              if (isNaN(distance)) {
                console.warn('Invalid distance calculation, skipping');
                continue;
              }
              
              distances.push({
                from: pointsToAnalyze[i].properties.id,
                to: pointsToAnalyze[j].properties.id,
                fromCoords: from,
                toCoords: to,
                fromTitle: pointsToAnalyze[i].properties.title || `Complaint #${pointsToAnalyze[i].properties.id}`,
                toTitle: pointsToAnalyze[j].properties.title || `Complaint #${pointsToAnalyze[j].properties.id}`,
                distance: distance
              });
              
              totalDistance += distance;
              count++;
            } catch (err) {
              console.error('Error calculating specific distance:', err);
            }
          }
        }
        
        if (distances.length === 0) {
          alert('Could not calculate distances between points');
          setIsAnalysisInProgress(false);
          return 0;
        }
        
        // Sort distances by distance value (descending)
        distances.sort((a, b) => b.distance - a.distance);
        
        // Create features for visualization (top 3 longest distances)
        const topDistances = distances.slice(0, 3);
        const distanceFeatures = {
          type: 'FeatureCollection',
          features: topDistances.map((d, idx) => ({
            type: 'Feature',
            properties: {
              distance: d.distance,
              fromId: d.from,
              toId: d.to,
              fromTitle: d.fromTitle,
              toTitle: d.toTitle,
              rank: idx + 1
            },
            geometry: {
              type: 'LineString',
              coordinates: [d.fromCoords, d.toCoords]
            }
          }))
        };
        
        console.log('Visualizing top distances:', topDistances);
        
        // Highlight the distance lines
        highlightAnalysisArea(distanceFeatures, 'distance');
        
        // Calculate the bounding box to ensure we can see all the lines
        try {
          const bbox = turf.bbox(distanceFeatures);
          mapInstance.current.fitBounds(bbox, {
            padding: 100,
            maxZoom: 14
          });
        } catch (err) {
          console.error('Error fitting map to distance lines:', err);
        }
        
        // Store full analysis results
        const result = {
          averageDistance: count > 0 ? totalDistance / count : 0,
          maxDistance: distances.length > 0 ? distances[0].distance : 0,
          minDistance: distances.length > 0 ? distances[distances.length - 1].distance : 0,
          totalComplaints: pointsToAnalyze.length,
          totalPairs: count,
          allDistances: topDistances, // Top distances for display
          totalOriginalPoints: points.length, // Store original count if we limited the analysis
          limitedAnalysis: limitedAnalysis
        };
        
        setAnalysisResults({
          type: 'distance',
          data: result
        });
        
        setIsAnalysisInProgress(false);
        return result.averageDistance;
      } catch (error) {
        console.error('Error calculating average distance:', error);
        alert('Error in distance analysis. Please try again.');
        setIsAnalysisInProgress(false);
        return 0;
      }
    },
    
    // Calculate density heat map - robust implementation
    calculateDensity: () => {
      if (!mapInstance.current) return;
      
      try {
        setIsAnalysisInProgress(true);
        
        // Check if heatmap layer exists and create it if it doesn't
        if (!mapInstance.current.getLayer('complaints-heat')) {
          console.warn("Density heatmap layer not found, recreating it");
          if (mapInstance.current.getSource('complaints')) {
            mapInstance.current.addLayer({
              id: 'complaints-heat',
              type: 'heatmap',
              source: 'complaints',
              layout: {
                visibility: 'visible'
              },
              paint: {
                'heatmap-weight': [
                  'interpolate',
                  ['linear'],
                  ['get', 'priority'],
                  1, 0.7,
                  3, 1.5
                ],
                'heatmap-intensity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 1.5,
                  9, 4
                ],
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'rgba(0, 0, 255, 0)',
                  0.2, 'rgba(0, 0, 255, 0.5)',
                  0.4, 'rgba(0, 255, 0, 0.5)',
                  0.6, 'rgba(255, 255, 0, 0.5)',
                  0.8, 'rgba(255, 0, 0, 0.5)',
                  1, 'rgba(255, 0, 0, 1)'
                ],
                'heatmap-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 5,
                  9, 25
                ],
                'heatmap-opacity': 0.9
              }
            });
          } else {
            alert('Cannot create heatmap: complaint data source not found');
            setIsAnalysisInProgress(false);
            return;
          }
        }
        
        // Get complaints source
        const complaintsSource = mapInstance.current.getSource('complaints');
        if (!complaintsSource || !complaintsSource._data) {
          alert('No complaint data available for density analysis');
          setIsAnalysisInProgress(false);
          return;
        }
        
        const points = complaintsSource._data.features.filter(
          f => f.geometry && f.geometry.type === 'Point'
        );
        
        if (points.length < 5) {
          alert('Need at least 5 complaints for meaningful density analysis');
          setIsAnalysisInProgress(false);
          return;
        }
        
        // Log the number of points to help with debugging
        console.log(`Density analysis: Processing ${points.length} points`);
        
        // Get the current map bounds
        const bounds = mapInstance.current.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        
        // Create a bounding box
        const bbox = [sw.lng, sw.lat, ne.lng, ne.lat];
        
        // Determine appropriate cell size based on the extent of the area
        const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'kilometers' });
        const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'kilometers' });
        const area = width * height;
        
        // Adjust cell size based on area and number of points
        let cellSize;
        if (area > 1000) cellSize = 2.0; // large area
        else if (area > 100) cellSize = 1.0; // medium area
        else if (area < 10) cellSize = 0.2; // very small area
        else cellSize = 0.5; // default
        
        // Further adjust cell size based on number of points
        if (points.length > 500) cellSize *= 1.5; // Many points, use larger cells
        else if (points.length < 20) cellSize *= 0.5; // Few points, use smaller cells
        
        console.log(`Density analysis: area=${area.toFixed(2)} km², cellSize=${cellSize} km`);
        
        // Create a grid of points for the heat map analysis
        const options = { units: 'kilometers' };
        const grid = turf.pointGrid(bbox, cellSize, options);
        
        // For each point in the grid, calculate the density of complaints
        grid.features.forEach(point => {
          const searchRadius = cellSize * 1.2; // Use slightly larger radius than cell size
          
          const countInRadius = points.filter(complaint => {
            return turf.distance(
              point.geometry.coordinates, 
              complaint.geometry.coordinates, 
              options
            ) <= searchRadius;
          }).length;
          
          point.properties.density = countInRadius;
        });
        
        // Filter out grid points with no complaints nearby
        const densityPoints = grid.features.filter(point => point.properties.density > 0);
        
        if (densityPoints.length === 0) {
          alert('No density patterns detected in the current view');
          setIsAnalysisInProgress(false);
          return;
        }
        
        // Find maximum density for normalization
        const maxDensity = Math.max(...densityPoints.map(p => p.properties.density));
        
        // Make sure heatmap is visible and properly configured
        if (mapInstance.current.getLayer('complaints-heat')) {
          // Make heatmap more visible by optimizing parameters
          mapInstance.current.setPaintProperty('complaints-heat', 'heatmap-weight', [
            'interpolate',
            ['linear'],
            ['get', 'priority'],
            1, 0.8,  // increased weight
            3, 1.8
          ]);
          
          mapInstance.current.setPaintProperty('complaints-heat', 'heatmap-intensity', [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1.5, 
            9, 4.5  // increased intensity for better visibility
          ]);
          
          mapInstance.current.setPaintProperty('complaints-heat', 'heatmap-radius', [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 5,   // slightly increased radius
            9, 25
          ]);
          
          // Make it more visible
          mapInstance.current.setPaintProperty('complaints-heat', 'heatmap-opacity', 0.9);
          
          // Ensure heatmap is visible
          mapInstance.current.setLayoutProperty('complaints-heat', 'visibility', 'visible');
          
          // Update mapConfig to reflect that heatmap is now visible
          if (onMapReady && typeof onMapReady === 'function') {
            onMapReady({
              showHeatmap: true
            });
          }
          
          console.log("Heatmap activated and optimized");
        } else {
          console.error("Failed to find heatmap layer after attempted creation");
        }
        
        // Calculate hotspots (high density areas)
        const threshold = maxDensity * 0.6; // 60% of max density considered a hotspot
        const hotspots = densityPoints
          .filter(point => point.properties.density >= threshold)
          .map(point => ({
            location: point.geometry.coordinates,
            count: point.properties.density
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // Top 5 hotspots
        
        // Create a feature collection for hotspot visualization
        if (hotspots.length > 0) {
          console.log(`Found ${hotspots.length} hotspots`);
          
          // Create points for hotspots
          const hotspotFeatures = {
            type: 'FeatureCollection',
            features: hotspots.map((hotspot, idx) => ({
              type: 'Feature',
              properties: {
                count: hotspot.count,
                rank: idx + 1,
                type: 'hotspot'
              },
              geometry: {
                type: 'Point',
                coordinates: hotspot.location
              }
            }))
          };
          
          // Try to create a convex hull around hotspots for better visualization
          if (hotspots.length >= 3) {
            try {
              const hotspotPoints = {
                type: 'FeatureCollection',
                features: hotspots.map(h => ({
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Point',
                    coordinates: h.location
                  }
                }))
              };
              
              const hull = turf.convex(hotspotPoints);
              
              if (hull) {
                hull.properties = { type: 'hotspot-area' };
                highlightAnalysisArea(hull, 'density');
                console.log("Created density hotspot region visualization");
              } else {
                highlightAnalysisArea(hotspotFeatures, 'density-points');
              }
            } catch (error) {
              console.error('Error creating density visualization:', error);
              highlightAnalysisArea(hotspotFeatures, 'density-points');
            }
          } else {
            highlightAnalysisArea(hotspotFeatures, 'density-points');
          }
        }
        
        // Store analysis results
        const avgDensity = densityPoints.reduce((sum, pt) => sum + pt.properties.density, 0) / 
                         (densityPoints.length || 1);
        
        setAnalysisResults({
          type: 'density',
          data: {
            totalPoints: points.length,
            hotspots: hotspots,
            maxDensity: maxDensity,
            averageDensity: avgDensity,
            cellSize: cellSize,
            totalCells: densityPoints.length,
            area: area.toFixed(2)
          }
        });
        
        setIsAnalysisInProgress(false);
        return hotspots;
      } catch (error) {
        console.error('Error calculating density:', error);
        alert('Error during density analysis. Please try again with a different view.');
        setIsAnalysisInProgress(false);
        return null;
      }
    },
    
    // Clear analysis results
    clearAnalysis: () => {
      setAnalysisResults(null);
      
      // Clear drawn features if they exist
      if (drawInstance.current) {
        drawInstance.current.deleteAll();
      }
      
      // Clear buffers
      if (mapInstance.current && mapInstance.current.getSource('buffers')) {
        mapInstance.current.getSource('buffers').setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      
      // Remove any analysis layer
      if (analysisLayer && mapInstance.current) {
        try {
          // Remove the analysis layer and source if they exist
          if (mapInstance.current.getLayer('analysis-fill')) {
            mapInstance.current.removeLayer('analysis-fill');
          }
          if (mapInstance.current.getLayer('analysis-outline')) {
            mapInstance.current.removeLayer('analysis-outline');
          }
          if (mapInstance.current.getLayer('analysis-points')) {
            mapInstance.current.removeLayer('analysis-points');
          }
          if (mapInstance.current.getLayer('analysis-lines')) {
            mapInstance.current.removeLayer('analysis-lines');
          }
          if (mapInstance.current.getSource('analysis-source')) {
            mapInstance.current.removeSource('analysis-source');
          }
        } catch (e) {
          console.error('Error removing analysis layers:', e);
        }
      }
      
      setAnalysisLayer(null);
      setIsAnalysisInProgress(false);
    },
    
    // Get current analysis results
    getAnalysisResults: () => {
      return analysisResults;
    }
  }));

  // Enhanced function to highlight the area being analyzed
  const highlightAnalysisArea = (feature, analysisType = 'default') => {
    if (!mapInstance.current) return;
    
    try {
      // Remove existing analysis layers if they exist
      if (mapInstance.current.getLayer('analysis-fill')) {
        mapInstance.current.removeLayer('analysis-fill');
      }
      if (mapInstance.current.getLayer('analysis-outline')) {
        mapInstance.current.removeLayer('analysis-outline');
      }
      if (mapInstance.current.getLayer('analysis-points')) {
        mapInstance.current.removeLayer('analysis-points');
      }
      if (mapInstance.current.getLayer('analysis-lines')) {
        mapInstance.current.removeLayer('analysis-lines');
      }
      
      // Remove sources if they exist
      if (mapInstance.current.getSource('analysis-source')) {
        // We need to remove all layers that use this source first
        try {
          mapInstance.current.removeSource('analysis-source');
        } catch (e) {
          console.log('Source was already removed or does not exist');
        }
      }
      
      // Create the analysis source
      mapInstance.current.addSource('analysis-source', {
        type: 'geojson',
        data: feature
      });
      
      // Set colors based on analysis type
      let fillColor = '#0088ff';  // default blue
      let strokeColor = '#0088ff';
      let pointColor = '#ff9900';  // default orange for points
      
      switch (analysisType) {
        case 'buffer':
          fillColor = '#4264fb';
          strokeColor = '#4264fb';
          break;
        case 'distance':
          strokeColor = '#ff3300';  // red for distance lines
          break;
        case 'density':
          fillColor = '#ff5500';  // orange/red for density areas
          strokeColor = '#ff5500';
          break;
        case 'density-points':
          pointColor = '#ff0000';  // bright red for density hotspots
          break;
        default:
          // Use defaults
          break;
      }
      
      // Add appropriate layers based on the geometry type and analysis type
      if (feature.type === 'FeatureCollection') {
        // Handle collections with mixed geometry types
        const hasPolygons = feature.features.some(f => 
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        );
        
        const hasLines = feature.features.some(f => 
          f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
        );
        
        const hasPoints = feature.features.some(f => 
          f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint'
        );
        
        if (hasPolygons) {
          // Add fill layer
          mapInstance.current.addLayer({
            id: 'analysis-fill',
            type: 'fill',
            source: 'analysis-source',
            filter: ['any', 
              ['==', ['geometry-type'], 'Polygon'], 
              ['==', ['geometry-type'], 'MultiPolygon']
            ],
            paint: {
              'fill-color': fillColor,
              'fill-opacity': 0.4
            }
          });
          
          // Add outline layer
          mapInstance.current.addLayer({
            id: 'analysis-outline',
            type: 'line',
            source: 'analysis-source',
            filter: ['any', 
              ['==', ['geometry-type'], 'Polygon'], 
              ['==', ['geometry-type'], 'MultiPolygon']
            ],
            paint: {
              'line-color': strokeColor,
              'line-width': 2,
              'line-dasharray': [2, 1]
            }
          });
        }
        
        if (hasLines || analysisType === 'distance') {
          // Add line layer
          mapInstance.current.addLayer({
            id: 'analysis-lines',
            type: 'line',
            source: 'analysis-source',
            filter: ['any', 
              ['==', ['geometry-type'], 'LineString'],
              ['==', ['geometry-type'], 'MultiLineString']
            ],
            paint: {
              'line-color': strokeColor,
              'line-width': 3,
              'line-dasharray': [3, 1]
            }
          });
          
          // For distance analysis, add labels for distances
          if (analysisType === 'distance') {
            mapInstance.current.addLayer({
              id: 'analysis-distance-labels',
              type: 'symbol',
              source: 'analysis-source',
              filter: ['==', ['geometry-type'], 'LineString'],
              layout: {
                'text-field': [
                  'concat',
                  ['to-string', ['number-format', ['get', 'distance'], { 'min-fraction-digits': 1, 'max-fraction-digits': 1 }]],
                  ' km'
                ],
                'text-size': 12,
                'text-anchor': 'center',
                'text-offset': [0, -0.5],
                'text-allow-overlap': true
              },
              paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#ff3300',
                'text-halo-width': 2
              }
            });
          }
        }
        
        if (hasPoints || analysisType === 'density-points') {
          // Add point layer
          mapInstance.current.addLayer({
            id: 'analysis-points',
            type: 'circle',
            source: 'analysis-source',
            filter: ['any', 
              ['==', ['geometry-type'], 'Point'],
              ['==', ['geometry-type'], 'MultiPoint']
            ],
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['get', 'count'],
                1, 8,
                10, 15,
                20, 20
              ],
              'circle-color': pointColor,
              'circle-opacity': 0.7,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
          
          // Add labels for density hotspots
          if (analysisType === 'density-points') {
            mapInstance.current.addLayer({
              id: 'analysis-point-labels',
              type: 'symbol',
              source: 'analysis-source',
              filter: ['==', ['geometry-type'], 'Point'],
              layout: {
                'text-field': ['to-string', ['get', 'count']],
                'text-size': 12,
                'text-anchor': 'center',
                'text-allow-overlap': true
              },
              paint: {
                'text-color': '#ffffff'
              }
            });
          }
        }
      } else {
        // Handle single feature
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          // Add fill layer
          mapInstance.current.addLayer({
            id: 'analysis-fill',
            type: 'fill',
            source: 'analysis-source',
            paint: {
              'fill-color': fillColor,
              'fill-opacity': 0.4
            }
          });
          
          // Add outline layer
          mapInstance.current.addLayer({
            id: 'analysis-outline',
            type: 'line',
            source: 'analysis-source',
            paint: {
              'line-color': strokeColor,
              'line-width': 2,
              'line-dasharray': [2, 1]
            }
          });
        } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
          // Add line layer
          mapInstance.current.addLayer({
            id: 'analysis-lines',
            type: 'line',
            source: 'analysis-source',
            paint: {
              'line-color': strokeColor,
              'line-width': 3,
              'line-dasharray': [3, 1]
            }
          });
        } else if (feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint') {
          // Add point layer
          mapInstance.current.addLayer({
            id: 'analysis-points',
            type: 'circle',
            source: 'analysis-source',
            paint: {
              'circle-radius': 8,
              'circle-color': pointColor,
              'circle-opacity': 0.7,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
        }
      }
      
      // Store the created layer reference
      setAnalysisLayer(feature);
      
    } catch (error) {
      console.error('Error highlighting analysis area:', error);
    }
  };

  // Helper function to remove source if it exists - fixed implementation
  const removeSourceIfExists = (sourceId) => {
    try {
      if (mapInstance.current.getSource(sourceId)) {
        // First remove any layers that use this source
        const layersToRemove = [];
        mapInstance.current.getStyle().layers.forEach(layer => {
          if (layer.source === sourceId) {
            layersToRemove.push(layer.id);
          }
        });
        
        // Now remove the layers
        layersToRemove.forEach(layer => {
          if (mapInstance.current.getLayer(layer)) {
            mapInstance.current.removeLayer(layer);
          }
        });
        
        // Finally remove the source
        mapInstance.current.removeSource(sourceId);
      }
    } catch (e) {
      console.log(`Source ${sourceId} doesn't exist or cannot be removed:`, e);
    }
  };

  // Initialize map on component mount
  useEffect(() => {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    window.mapboxgl = mapboxgl; // Make available globally for geocoding
    
    // Only initialize map if it doesn't exist yet
    if (!mapInstance.current) {
      console.log('Initializing map...');
      
      // Create map instance
      mapInstance.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: getStyleUrlFromType(mapConfig.baseLayerType),
        center: [mapConfig.longitude || -74.0060, mapConfig.latitude || 40.7128],
        zoom: mapConfig.zoom || 12,
        attributionControl: false,
        preserveDrawingBuffer: true
      });
      
      // Initialize popup
      popupInstance.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '400px',
        className: 'custom-popup'
      });

      // Add navigation control
      mapInstance.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Add attribution control
      mapInstance.current.addControl(new mapboxgl.AttributionControl({
        compact: true
      }), 'bottom-right');
      
      // Add geolocate control
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });
      
      mapInstance.current.addControl(geolocateControl, 'top-right');
      
      // Add scale
      mapInstance.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
      
      // Set up event handlers when map loads
      mapInstance.current.on('load', () => {
        console.log('Map loaded successfully');
        setupSourcesAndLayers();
        
        // Initialize drawing controls for all users
        drawInstance.current = new MapboxDraw({
          displayControlsDefault: false,
          controls: {
            point: true,
            line_string: true,
            polygon: true,
            trash: true
          },
          styles: [
            {
              "id": "gl-draw-polygon-fill-active",
              "type": "fill",
              "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
              "paint": {
                "fill-color": "#fbb03b",
                "fill-outline-color": "#fbb03b",
                "fill-opacity": 0.3
              }
            },
            {
              "id": "gl-draw-polygon-stroke-active",
              "type": "line",
              "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
              "paint": {
                "line-color": "#fbb03b",
                "line-dasharray": [0.2, 2],
                "line-width": 3
              }
            },
            {
              "id": "gl-draw-line-active",
              "type": "line",
              "filter": ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
              "paint": {
                "line-color": "#3bb2d0",
                "line-width": 3
              }
            },
            {
              "id": "gl-draw-point-active",
              "type": "circle",
              "filter": ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
              "paint": {
                "circle-radius": 6,
                "circle-color": "#3bb2d0"
              }
            }
          ]
        });
        
        // Add the draw controls to the map
        mapInstance.current.addControl(drawInstance.current, 'top-left');
        
        // Log that drawing tools have been initialized
        console.log('Drawing tools initialized:', drawInstance.current);
        
        setupEventHandlers();
        
        // Enable geolocate after a delay
        setTimeout(() => {
          try {
            geolocateControl.trigger();
          } catch (e) {
            console.error('Error triggering geolocate:', e);
          }
        }, 1000);
        
        // Update map loaded state
        setMapLoaded(true);
        setSourcesInitialized(true);
        
        if (onMapReady && typeof onMapReady === 'function') {
          onMapReady(mapInstance.current);
        }
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map data when complaints change - fixed implementation with proper date handling
// Update the updateMapData function

const updateMapData = (complaintsData) => {
  console.log('updateMapData called with:', 
  complaintsData ? 
  `${complaintsData.length} complaints (first id: ${complaintsData[0]?.id})` : 
  'no data'
);
  if (!mapInstance.current) {
    console.warn('Map instance not available for updating data');
    return;
  }
  
  try {
    if (!complaintsData || !Array.isArray(complaintsData)) {
      console.warn('Invalid complaints data provided', complaintsData);
      return;
    }
    
    const validComplaints = complaintsData.filter(complaint => 
      complaint && complaint.parsedLocation && 
      complaint.parsedLocation.longitude && 
      complaint.parsedLocation.latitude
    );
    
    console.log(`Found ${validComplaints.length} valid complaints out of ${complaintsData.length}`);
    
    if (validComplaints.length === 0) {
      console.warn('No valid complaints with location data');
      return;
    }
    
    // Check if source exists, if not create it
    if (!mapInstance.current.getSource('complaints')) {
      console.log("Complaints source missing, re-creating it");
      mapInstance.current.addSource('complaints', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });
      
      // Re-add the layers that use this source
      setupSourcesAndLayers();
    }
    
    // Now update the data
// Update the date formatting in the updateMapData function

// Now update the data
const features = validComplaints.map(complaint => {
  // Ensure proper date formatting
  let formattedDate = 'Unknown';
  if (complaint.created_at) {
    try {
      // Try to parse the date properly using ISO format first
      const date = new Date(complaint.created_at);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (err) {
      console.warn('Error formatting date:', err);
    }
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [complaint.parsedLocation.longitude, complaint.parsedLocation.latitude]
    },
    properties: {
      id: complaint.id,
      title: complaint.title || 'Untitled Complaint',
      description: complaint.description || '',
      status: complaint.status || 'open',
      category_id: complaint.category_id,
      category_name: complaint.categories?.name || 'Uncategorized',
      category_icon: complaint.categories?.icon || '📍',
      category_color: getCategoryColor(complaint.categories?.name),
      reported_by: complaint.reported_by,
      anonymous: complaint.anonymous,
      created_at: formattedDate,
      // Also store the raw date for filtering
      created_at_raw: complaint.created_at,
      updated_at: complaint.updated_at,
      resolved_at: complaint.resolved_at,
      priority: complaint.priority || 1,
      // Store original coordinates for analysis functions
      longitude: complaint.parsedLocation.longitude,
      latitude: complaint.parsedLocation.latitude
    }
  };
});

    const geojson = {
      type: 'FeatureCollection',
      features
    };

    try {
      if (mapInstance.current.getSource('complaints')) {
        mapInstance.current.getSource('complaints').setData(geojson);
        console.log(`Updated map with ${features.length} complaints`);
      } else {
        console.error('Complaints source not found when trying to update data');
      }
    } catch (err) {
      console.error('Error setting complaints data:', err);
      // Attempt recovery
      setTimeout(() => {
        try {
          if (mapInstance.current && mapInstance.current.getSource('complaints')) {
            mapInstance.current.getSource('complaints').setData(geojson);
            console.log('Successfully updated complaints data on retry');
          }
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
        }
      }, 500);
    }
  } catch (error) {
    console.error('Error updating map data:', error);
  }
};
  // Update department boundaries when they change
  useEffect(() => {
    if (mapInstance.current && sourcesInitialized && departments.length > 0) {
      addDepartmentBoundaries(departments);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, sourcesInitialized]);
useEffect(() => {
  if (!mapInstance.current) return;
  
  // When map is ready and we have complaints, update the map
  if (complaints && Array.isArray(complaints) && complaints.length > 0 && sourcesInitialized) {
    console.log(`Processing ${complaints.length} complaints in dedicated effect`);
    
    // Ensure markers are loaded before displaying points
    const loadIconsAndUpdateMap = async () => {
      try {
        // Add a small delay to ensure the map is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Load custom icons if needed
        await loadCustomIcons();
        
        // Update map with complaints
        updateMapData(complaints);
      } catch (error) {
        console.error('Error in loadIconsAndUpdateMap:', error);
      }
    };
    
    loadIconsAndUpdateMap();
  }
}, [complaints, sourcesInitialized]);
  // Handle map config changes
  useEffect(() => {
    if (!mapInstance.current || !sourcesInitialized) return;
    
    try {
      console.log("Updating map configuration:", mapConfig);
      
      // Check if map has the required layers before trying to modify them
      const hasHeatmap = mapInstance.current.getLayer('complaints-heat');
      const hasUnclustered = mapInstance.current.getLayer('unclustered-point');
      
      // Toggle heatmap visibility if it exists
      if (hasHeatmap) {
        mapInstance.current.setLayoutProperty(
          'complaints-heat',
          'visibility',
          mapConfig.showHeatmap ? 'visible' : 'none'
        );
      }
      
      if (hasUnclustered) {
        mapInstance.current.setLayoutProperty(
          'unclustered-point',
          'visibility',
          mapConfig.showClusters ? 'visible' : 'none'
        );
        
        // For clusters, we need to check each layer
        const clusterLayers = ['clusters', 'cluster-count'];
        clusterLayers.forEach(layer => {
          if (mapInstance.current.getLayer(layer)) {
            mapInstance.current.setLayoutProperty(
              layer,
              'visibility',
              mapConfig.showClusters ? 'visible' : 'none'
            );
          }
        });
      }

      // Update buffers visibility
      const hasBufferFill = mapInstance.current.getLayer('buffer-fill');
      if (hasBufferFill) {
        const bufferLayers = ['buffer-fill', 'buffer-outline'];
        bufferLayers.forEach(layer => {
          if (mapInstance.current.getLayer(layer)) {
            mapInstance.current.setLayoutProperty(
              layer,
              'visibility',
              mapConfig.showBuffers ? 'visible' : 'none'
            );
          }
        });
      }

      // Update boundaries visibility
      const hasBoundaryFill = mapInstance.current.getLayer('department-boundaries-fill');
      if (hasBoundaryFill) {
        const boundaryLayers = ['department-boundaries-fill', 'department-boundaries-line'];
        boundaryLayers.forEach(layer => {
          if (mapInstance.current.getLayer(layer)) {
            mapInstance.current.setLayoutProperty(
              layer,
              'visibility',
              mapConfig.showBoundaries ? 'visible' : 'none'
            );
          }
        });
      }
      
      // Handle drawing mode changes
      if (drawInstance.current) {
        if (mapConfig.drawingMode === 'polygon') {
          drawInstance.current.changeMode('draw_polygon');
        } else if (mapConfig.drawingMode === 'point') {
          drawInstance.current.changeMode('draw_point');
        } else if (mapConfig.drawingMode === 'line') {
          drawInstance.current.changeMode('draw_line_string');
        } else if (mapConfig.drawingMode === null) {
          drawInstance.current.deleteAll();
          drawInstance.current.changeMode('simple_select');
        }
      }

if (mapConfig.baseLayerType && mapConfig.prevBaseLayerType !== mapConfig.baseLayerType) {
  // Use existing style URL function, but don't call changeBaseMap immediately
  const styleUrl = getStyleUrlFromType(mapConfig.baseLayerType);
  
  // Store in ref to prevent re-renders
  if (!mapStyleChangeRef.current) {
    mapStyleChangeRef.current = debounce((url) => {
      changeBaseMap(url);
    }, 300);
  }
  
  mapStyleChangeRef.current(styleUrl);
}
      
    } catch (error) {
      console.error('Error updating map config:', error);
      
      // If we encounter errors, try to rebuild the map layers
      console.warn("Attempting to rebuild map layers due to error");
      try {
        setupSourcesAndLayers();
      } catch (rebuildError) {
        console.error("Failed to rebuild map layers:", rebuildError);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapConfig, sourcesInitialized]);

  // Helper functions
  const isAdminUser = (user) => {
    return user?.roles?.name === 'Super Admin' || 
           user?.roles?.name === 'Department Admin' || 
           user?.roles?.name === 'Field Agent';
  };

  const getStyleUrlFromType = (type) => {
    switch (type) {
      case 'satellite': return 'mapbox://styles/mapbox/satellite-v9';
      case 'dark': return 'mapbox://styles/mapbox/dark-v10';
      case 'light': return 'mapbox://styles/mapbox/light-v10';
      case 'outdoors': return 'mapbox://styles/mapbox/outdoors-v11';
      case 'streets':
      default: return 'mapbox://styles/mapbox/streets-v11';
    }
  };

  const setupSourcesAndLayers = () => {
    if (!mapInstance.current) return;
    
    try {
      // Load custom icons for complaint categories
      loadCustomIcons();
      
      // Check if sources already exist and remove them to prevent duplicates
      removeSourceIfExists('complaints');
      removeSourceIfExists('buffers');
      removeSourceIfExists('department-boundaries');
      
      // Add complaints source
      mapInstance.current.addSource('complaints', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      // Add heatmap layer
      mapInstance.current.addLayer({
        id: 'complaints-heat',
        type: 'heatmap',
        source: 'complaints',
        layout: {
          visibility: mapConfig.showHeatmap ? 'visible' : 'none'
        },
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'priority'],
            1, 0.5,
            3, 1
          ],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            9, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 255, 0)',
            0.2, 'rgba(0, 0, 255, 0.5)',
            0.4, 'rgba(0, 255, 0, 0.5)',
            0.6, 'rgba(255, 255, 0, 0.5)',
            0.8, 'rgba(255, 0, 0, 0.5)',
            1, 'rgba(255, 0, 0, 1)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            9, 20
          ],
          'heatmap-opacity': 0.7
        }
      });

      // Add clusters layer
      mapInstance.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'complaints',
        filter: ['has', 'point_count'],
        layout: {
          visibility: mapConfig.showClusters ? 'visible' : 'none'
        },
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            10, '#f1f075',
            30, '#f28cb1'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            10, 30,
            30, 40
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      // Add cluster count layer
      mapInstance.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'complaints',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
          'visibility': mapConfig.showClusters ? 'visible' : 'none'
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Add unclustered points layer with symbols
      mapInstance.current.addLayer({
        id: 'unclustered-point',
        type: 'symbol',
        source: 'complaints',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'visibility': mapConfig.showClusters ? 'visible' : 'none',
          'icon-image': [
            'match',
            ['get', 'status'],
            'open', 'marker-red',
            'in_progress', 'marker-yellow',
            'resolved', 'marker-green',
            'marker-blue' // default
          ],
          'icon-size': 0.7,
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true
        }
      });

      // Add buffers source and layers
      mapInstance.current.addSource('buffers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      mapInstance.current.addLayer({
        id: 'buffer-fill',
        type: 'fill',
        source: 'buffers',
        layout: {
          visibility: mapConfig.showBuffers ? 'visible' : 'none'
        },
        paint: {
          'fill-color': '#4264fb',
          'fill-opacity': 0.3
        }
      });
      
      mapInstance.current.addLayer({
        id: 'buffer-outline',
        type: 'line',
        source: 'buffers',
        layout: {
          visibility: mapConfig.showBuffers ? 'visible' : 'none'
        },
        paint: {
          'line-color': '#4264fb',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });

      // Add department boundaries source and layers
      mapInstance.current.addSource('department-boundaries', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      mapInstance.current.addLayer({
        id: 'department-boundaries-fill',
        type: 'fill',
        source: 'department-boundaries',
        layout: {
          visibility: mapConfig.showBoundaries ? 'visible' : 'none'
        },
        paint: {
          'fill-color': '#00ff00',
          'fill-opacity': 0.1,
          'fill-outline-color': '#00ff00'
        }
      });

      mapInstance.current.addLayer({
        id: 'department-boundaries-line',
        type: 'line',
        source: 'department-boundaries',
        layout: {
          visibility: mapConfig.showBoundaries ? 'visible' : 'none'
        },
        paint: {
          'line-color': '#00ff00',
          'line-width': 2,
          'line-dasharray': [2, 2]
        }
      });

      // Initialize sources to true
      setSourcesInitialized(true);
      
      // Update map data if we already have complaints
      if (complaints.length > 0) {
        updateMapData(complaints);
      }
      
      // Add department boundaries if available
      if (departments.length > 0) {
        addDepartmentBoundaries(departments);
      }

    } catch (error) {
      console.error('Error setting up sources and layers:', error);
    }
  };

  // Load custom map markers for complaint categories
// Update loadCustomIcons to use Promises and be more resilient

const loadCustomIcons = () => {
  return new Promise((resolve) => {
    if (!mapInstance.current) {
      console.error('Map instance not available for loading icons');
      resolve();
      return;
    }
    
    let iconsLoaded = 0;
    const totalIcons = 4; // We're loading 4 icons
    
    const checkAllLoaded = () => {
      iconsLoaded++;
      if (iconsLoaded >= totalIcons) {
        console.log('All map icons loaded successfully');
        resolve();
      }
    };
    
    // Load blue marker (default)
    mapInstance.current.loadImage(
      'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
      (error, image) => {
        if (error) {
          console.error('Error loading blue marker:', error);
        } else if (!mapInstance.current.hasImage('marker-blue')) {
          mapInstance.current.addImage('marker-blue', image);
        }
        checkAllLoaded();
      }
    );
    
    // Red marker for open complaints
    mapInstance.current.loadImage(
      'https://cdn.mapmarker.io/api/v1/pin?size=50&background=%23e74c3c&icon=fa-exclamation&color=%23FFFFFF',
      (error, image) => {
        if (error) {
          console.error('Error loading red marker:', error);
        } else if (!mapInstance.current.hasImage('marker-red')) {
          mapInstance.current.addImage('marker-red', image);
        }
        checkAllLoaded();
      }
    );
    
    // Yellow marker for in-progress complaints
    mapInstance.current.loadImage(
      'https://cdn.mapmarker.io/api/v1/pin?size=50&background=%23f39c12&icon=fa-clock&color=%23FFFFFF',
      (error, image) => {
        if (error) {
          console.error('Error loading yellow marker:', error);
        } else if (!mapInstance.current.hasImage('marker-yellow')) {
          mapInstance.current.addImage('marker-yellow', image);
        }
        checkAllLoaded();
      }
    );
    
    // Green marker for resolved complaints
    mapInstance.current.loadImage(
      'https://cdn.mapmarker.io/api/v1/pin?size=50&background=%232ecc71&icon=fa-check&color=%23FFFFFF',
      (error, image) => {
        if (error) {
          console.error('Error loading green marker:', error);
        } else if (!mapInstance.current.hasImage('marker-green')) {
          mapInstance.current.addImage('marker-green', image);
        }
        checkAllLoaded();
      }
    );
    
    // Safety timeout in case some icons fail to load
    setTimeout(() => {
      if (iconsLoaded < totalIcons) {
        console.warn(`Only ${iconsLoaded}/${totalIcons} icons loaded. Proceeding anyway.`);
        resolve();
      }
    }, 2000);
  });
};

// Fix the setupEventHandlers function with proper click handler for points
const setupEventHandlers = () => {
  if (!mapInstance.current) return;

  try {
    // Click event for clusters
    mapInstance.current.on('click', 'clusters', (e) => {
      try {
        const features = mapInstance.current.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        
        const clusterId = features[0].properties.cluster_id;
        const source = mapInstance.current.getSource('complaints');
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          mapInstance.current.flyTo({
            center: features[0].geometry.coordinates,
            zoom: zoom + 0.5
          });
        });
      } catch (error) {
        console.error('Error handling cluster click:', error);
      }
    });
    
    // Click event for unclustered points
    mapInstance.current.on('click', 'unclustered-point', (e) => {
      try {
        if (e.features && e.features.length > 0) {
          const properties = e.features[0].properties;
          const complaintId = parseInt(properties.id, 10);
          
          console.log(`Clicked on complaint #${complaintId}`);
          
          // Find the full complaint object
          const complaintObj = complaints.find(c => c.id === complaintId);
          
          if (complaintObj && setSelectedComplaint) {
            console.log('Setting selected complaint:', complaintObj);
            setSelectedComplaint(complaintObj);
          } else {
            console.warn('Could not find complaint with ID:', complaintId);
          }
        }
      } catch (error) {
        console.error('Error handling point click:', error);
      }
    });
    
    // Mouse enter for individual complaints
// Update the popup display in the setupEventHandlers function

// Mouse enter for individual complaints
mapInstance.current.on('mouseenter', 'unclustered-point', (e) => {
  try {
    if (!e.features || !e.features.length) return;
    
    mapInstance.current.getCanvas().style.cursor = 'pointer';
    
    const coordinates = [...e.features[0].geometry.coordinates];
    const properties = e.features[0].properties;
    
    const title = properties.title || 'Untitled Complaint';
    const status = properties.status || 'unknown';
    const categoryName = properties.category_name || 'Uncategorized';
    const categoryIcon = properties.category_icon || '📍';
    const date = properties.created_at || 'Unknown date';
    
    // Ensure that if the map is zoomed out such that multiple copies of the feature are visible,
    // the popup appears over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    
    // Create popup with improved HTML content
    const statusColor = status === 'open' ? 'bg-red-100 text-red-800' :
                        status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800';
                    
    const popupContent = `
      <div class="complaint-popup">
        <h4 class="popup-title text-sm font-semibold">${title}</h4>
        <div class="popup-info flex justify-between items-center mt-1">
          <span class="text-xs text-gray-600">${categoryIcon} ${categoryName}</span>
          <span class="text-xs px-2 py-1 rounded-full ${statusColor}">${status.replace('_', ' ')}</span>
        </div>
        <div class="popup-date text-xs text-gray-500 mt-1">Reported: ${date}</div>
        <div class="popup-footer text-xs font-medium text-blue-600 mt-1">Click for details</div>
      </div>
    `;
    
    // Add popup to the map
    popupInstance.current
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(mapInstance.current);
  } catch (error) {
    console.error('Error displaying popup:', error);
  }
});

// Click event for unclustered points with improved handling
mapInstance.current.on('click', 'unclustered-point', (e) => {
  try {
    if (e.features && e.features.length > 0) {
      const properties = e.features[0].properties;
      const complaintId = parseInt(properties.id, 10);
      
      console.log(`Clicked on complaint #${complaintId}`);
      
      // Find the full complaint object
      const complaintObj = complaints.find(c => c.id === complaintId);
      
      if (complaintObj && setSelectedComplaint) {
        console.log('Setting selected complaint:', complaintObj);
        
        // First remove popup if present
        if (popupInstance.current) {
          popupInstance.current.remove();
        }
        
        // Then set selected complaint to show detail panel
        setSelectedComplaint(complaintObj);
        
        // Keep the map centered on the point
        const coordinates = e.features[0].geometry.coordinates;
        mapInstance.current.flyTo({
          center: coordinates,
          zoom: Math.max(mapInstance.current.getZoom(), 14),
          duration: 500
        });
      } else {
        console.warn('Could not find complaint with ID:', complaintId);
      }
    }
  } catch (error) {
    console.error('Error handling point click:', error);
  }
});
  } catch (error) {
    console.error('Error setting up event handlers:', error);
  }
};

  // Helper function to get color for category
  const getCategoryColor = (categoryName) => {
    if (!categoryName) return '#3498db'; // default blue
    
    const categoryMapping = categoryIcons[categoryName] || defaultCategoryIcon;
    return categoryMapping.color;
  };

  const addDepartmentBoundaries = (departments) => {
    if (!mapInstance.current || !mapInstance.current.getSource('department-boundaries')) return;
    
    try {
      // Convert department boundaries to GeoJSON
      const features = departments.map(dept => {
        if (!dept.jurisdiction) return null;
        
        let geometry;
        try {
          // Parse jurisdiction geometry
          if (typeof dept.jurisdiction === 'string') {
            geometry = JSON.parse(dept.jurisdiction);
          } else {
            geometry = dept.jurisdiction;
          }
          
          return {
            type: 'Feature',
            geometry: geometry,
            properties: {
              id: dept.id,
              name: dept.name,
              color: `#${Math.floor(Math.random()*16777215).toString(16)}` // Random color
            }
          };
        } catch (error) {
          console.error(`Error parsing jurisdiction for department ${dept.id}:`, error);
          return null;
        }
      }).filter(f => f !== null);

      const geojson = {
        type: 'FeatureCollection',
        features: features
      };

      // Update the map source
      mapInstance.current.getSource('department-boundaries').setData(geojson);
      console.log(`Updated map with ${features.length} department boundaries`);
    } catch (error) {
      console.error('Error updating department boundaries:', error);
    }
  };

// Completely replaced changeBaseMap function
const changeBaseMap = (styleUrl) => {
  if (!mapInstance.current) return;
  
  try {
    console.log('Changing map style to:', styleUrl);
    
    // Store current camera position
    const zoom = mapInstance.current.getZoom();
    const center = mapInstance.current.getCenter();
    const bearing = mapInstance.current.getBearing();
    const pitch = mapInstance.current.getPitch();
    
    // Save existing data before style change
    let complaintsData = null;
    let buffersData = null;
    let boundariesData = null;
    
    try {
      if (mapInstance.current.getSource('complaints')) {
        complaintsData = mapInstance.current.getSource('complaints')._data;
      }
      if (mapInstance.current.getSource('buffers')) {
        buffersData = mapInstance.current.getSource('buffers')._data;
      }
      if (mapInstance.current.getSource('department-boundaries')) {
        boundariesData = mapInstance.current.getSource('department-boundaries')._data;
      }
    } catch (err) {
      console.warn('Error saving source data before style change:', err);
    }
    
    // Change the style
    mapInstance.current.setStyle(styleUrl);
    
    // Setup everything again when the style loads
    mapInstance.current.once('style.load', () => {
      console.log('New style loaded, restoring map state');
      
      // Restore camera position
      mapInstance.current.setCenter(center);
      mapInstance.current.setZoom(zoom);
      mapInstance.current.setBearing(bearing);
      mapInstance.current.setPitch(pitch);
      
      // Re-create sources and layers
      loadCustomIcons().then(() => {
        setupSourcesAndLayers();
        
        // Re-add event handlers
        setupEventHandlers();
        
        // Restore data with short delay to ensure sources are ready
        setTimeout(() => {
          // Restore complaints data
          if (complaintsData && mapInstance.current.getSource('complaints')) {
            mapInstance.current.getSource('complaints').setData(complaintsData);
          } else if (complaints && complaints.length > 0) {
            updateMapData(complaints);
          }
          
          // Restore buffer data
          if (buffersData && mapInstance.current.getSource('buffers')) {
            mapInstance.current.getSource('buffers').setData(buffersData);
          }
          
          // Restore department boundaries
          if (boundariesData && mapInstance.current.getSource('department-boundaries')) {
            mapInstance.current.getSource('department-boundaries').setData(boundariesData);
          }
          
          console.log('Map data and state fully restored');
        }, 100);
      });
    });
    
  } catch (error) {
    console.error('Error changing base map:', error);
    
    // Recovery attempt
    setTimeout(() => {
      setupSourcesAndLayers();
      
      // Try to restore the complaints data after recovery
      if (complaints && complaints.length > 0) {
        updateMapData(complaints);
      }
    }, 1000);
  }
};

  // Helper function to restore layer visibility after style change
  const restoreLayerVisibility = (config) => {
    try {
      // Safely set layer visibility, checking if each layer exists first
      const safeSetVisibility = (layerId, visible) => {
        if (mapInstance.current && mapInstance.current.getLayer(layerId)) {
          mapInstance.current.setLayoutProperty(
            layerId,
            'visibility',
            visible ? 'visible' : 'none'
          );
        }
      };
      
      // Heatmap
      safeSetVisibility('complaints-heat', config.showHeatmap);
      
      // Clusters
      ['clusters', 'cluster-count', 'unclustered-point'].forEach(layer => {
        safeSetVisibility(layer, config.showClusters);
      });
      
      // Buffers
      ['buffer-fill', 'buffer-outline'].forEach(layer => {
        safeSetVisibility(layer, config.showBuffers);
      });
      
      // Boundaries
      ['department-boundaries-fill', 'department-boundaries-line'].forEach(layer => {
        safeSetVisibility(layer, config.showBoundaries);
      });
      
      // Analysis layers should always be visible if they exist
      ['analysis-fill', 'analysis-outline', 'analysis-points', 'analysis-lines'].forEach(layer => {
        safeSetVisibility(layer, true);
      });
    } catch (error) {
      console.error('Error restoring layer visibility:', error);
    }
  };

  return (
    <>
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Loading indicator for analysis */}
      {isAnalysisInProgress && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-20">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center">
            <svg className="animate-spin h-5 w-5 mr-3 text-blue-500" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              ></circle>
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Running analysis...</span>
          </div>
        </div>
      )}
      
      {/* Analysis Results Display - Enhanced version */}
      {analysisResults && (
        <div className="absolute bottom-6 left-6 right-6 lg:left-auto lg:right-6 lg:w-96 bg-white shadow-lg rounded-lg p-4 z-10">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-900">
              {analysisResults.type === 'pointCount' && 'Point Count Analysis'}
              {analysisResults.type === 'distance' && 'Distance Analysis'}
              {analysisResults.type === 'buffer' && `Buffer Analysis (${analysisResults.bufferDistance}m)`}
              {analysisResults.type === 'density' && 'Density Analysis'}
              {analysisResults.type === 'areaSelection' && 'Area Analysis'}
            </h3>
            <button 
              onClick={() => {
                setAnalysisResults(null);
                // Clear any analysis layers
                if (mapInstance.current) {
                  if (mapInstance.current.getLayer('analysis-fill')) {
                    mapInstance.current.removeLayer('analysis-fill');
                  }
                  if (mapInstance.current.getLayer('analysis-outline')) {
                    mapInstance.current.removeLayer('analysis-outline');
                  }
                  if (mapInstance.current.getLayer('analysis-points')) {
                    mapInstance.current.removeLayer('analysis-points');
                  }
                  if (mapInstance.current.getLayer('analysis-lines')) {
                    mapInstance.current.removeLayer('analysis-lines');
                  }
                }
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="text-xs text-gray-700 max-h-56 overflow-auto">
            {/* Point Count Results */}
            {analysisResults.type === 'pointCount' && (
              <div>
                <p className="font-bold">Found {analysisResults.data.totalPoints} complaints in selected area</p>
                <p>Area: {analysisResults.data.area.toFixed(2)} km²</p>
                <p>Density: {analysisResults.data.density} complaints/km²</p>
                <p>{analysisResults.data.percentOfTotal}% of total complaints</p>
                
                <div className="mt-2">
                  <p className="font-semibold">Status breakdown:</p>
                  <ul className="ml-2">
                    <li>• Open: {analysisResults.data.pointsByStatus.open || 0}</li>
                    <li>• In Progress: {analysisResults.data.pointsByStatus.in_progress || 0}</li>
                    <li>• Resolved: {analysisResults.data.pointsByStatus.resolved || 0}</li>
                  </ul>
                </div>
                
                <div className="mt-2">
                  <p className="font-semibold">Priority breakdown:</p>
                  <ul className="ml-2">
                    <li>• Low: {analysisResults.data.pointsByPriority[1] || 0}</li>
                    <li>• Medium: {analysisResults.data.pointsByPriority[2] || 0}</li>
                    <li>• High: {analysisResults.data.pointsByPriority[3] || 0}</li>
                  </ul>
                </div>
                
                <div className="mt-2">
                  <p className="font-semibold">Category breakdown:</p>
                  <ul className="ml-2">
                    {Object.entries(analysisResults.data.pointsByCategory || {})
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, count]) => (
                        <li key={category}>• {category}: {count}</li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
            
            {/* Distance Analysis Results */}
            {analysisResults.type === 'distance' && (
              <div>
                <p className="font-bold">Distance Analysis Results</p>
                <p>Average Distance: {analysisResults.data.averageDistance.toFixed(2)} km</p>
                <p>Maximum Distance: {analysisResults.data.maxDistance.toFixed(2)} km</p>
                <p>Minimum Distance: {analysisResults.data.minDistance.toFixed(2)} km</p>
                <p>Analyzed: {analysisResults.data.totalComplaints} complaints</p>
                {analysisResults.data.totalOriginalPoints > analysisResults.data.totalComplaints && (
                  <p className="text-xs text-amber-600">* Limited to {analysisResults.data.totalComplaints} out of {analysisResults.data.totalOriginalPoints} total points for performance</p>
                )}
                
                <div className="mt-2">
                  <p className="font-semibold">Top Distances (highlighted on map):</p>
                  <ul className="ml-2 text-xs">
                    {analysisResults.data.allDistances.map((d, i) => (
                      <li key={i}>
                        • {i+1}. {d.distance.toFixed(2)} km: #{d.from} to #{d.to}
                        {d.fromTitle && d.toTitle && (
                          <div className="ml-3 text-gray-500">
                            "{d.fromTitle.substring(0, 15)}{d.fromTitle.length > 15 ? '...' : ''}" to "{d.toTitle.substring(0, 15)}{d.toTitle.length > 15 ? '...' : ''}"
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {/* Buffer Analysis Results */}
            {analysisResults.type === 'buffer' && (
              <div>
                <p className="font-bold">Buffer Analysis Results ({analysisResults.data.bufferDistance || ''}m)</p>
                <p>Complaints within buffer: {analysisResults.data.totalPoints}</p>
                <p>Buffer Area: {analysisResults.data.area.toFixed(2)} km²</p>
                <p>Density: {analysisResults.data.density || 0} complaints/km²</p>
                
                <div className="mt-2">
                  <p className="font-semibold">Status breakdown:</p>
                  <ul className="ml-2">
                    <li>• Open: {analysisResults.data.pointsByStatus?.open || 0}</li>
                    <li>• In Progress: {analysisResults.data.pointsByStatus?.in_progress || 0}</li>
                    <li>• Resolved: {analysisResults.data.pointsByStatus?.resolved || 0}</li>
                  </ul>
                </div>
                
                <div className="mt-2">
                  <p className="font-semibold">Category breakdown:</p>
                  <ul className="ml-2">
                    {Object.entries(analysisResults.data.pointsByCategory || {})
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, count]) => (
                        <li key={category}>• {category}: {count}</li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
            
            {/* Density Analysis Results */}
            {analysisResults.type === 'density' && (
              <div>
                <p className="font-bold">Density Analysis Results</p>
                <p>Total Complaints: {analysisResults.data.totalPoints}</p>
                <p>Analysis Area: {analysisResults.data.area} km²</p>
                <p>Cell Size: {analysisResults.data.cellSize} km</p>
                <p>Max Density: {analysisResults.data.maxDensity} complaints per cell</p>
                <p>Average Density: {analysisResults.data.averageDensity.toFixed(2)} complaints per cell</p>
                
                <div className="mt-2">
                  <p className="font-semibold">Top Hotspots:</p>
                  <ul className="ml-2">
                    {analysisResults.data.hotspots.map((spot, i) => (
                      <li key={i}>
                        • Hotspot {i+1}: {spot.count} complaints
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                  <p>The highlighted area shows the highest density region.</p>
                  <p>Enable the heatmap layer for a complete density visualization.</p>
                </div>
              </div>
            )}
            
            {/* Area Selection Results */}
            {analysisResults.type === 'areaSelection' && (
              <div>
                <p className="font-bold">Selected Area Analysis</p>
                <p>Found {analysisResults.data.totalPoints} complaints in selected area</p>
                <p>Area: {analysisResults.data.area.toFixed(2)} km²</p>
                <p>Density: {analysisResults.data.density} complaints/km²</p>
                <p>{analysisResults.data.percentOfTotal}% of total complaints</p>
                
                <div className="mt-2">
                  <p className="font-semibold">Status breakdown:</p>
                  <ul className="ml-2">
                    <li>• Open: {analysisResults.data.pointsByStatus.open || 0}</li>
                    <li>• In Progress: {analysisResults.data.pointsByStatus.in_progress || 0}</li>
                    <li>• Resolved: {analysisResults.data.pointsByStatus.resolved || 0}</li>
                  </ul>
                </div>
                
                <div className="mt-2">
                  <p className="font-semibold">Category breakdown:</p>
                  <ul className="ml-2">
                    {Object.entries(analysisResults.data.pointsByCategory || {})
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([category, count]) => (
                        <li key={category}>• {category}: {count}</li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          {/* Analysis actions */}
          <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between">
            <button 
              onClick={() => {
                // Clear analysis results and layers but keep the drawn shapes
                setAnalysisResults(null);
                if (mapInstance.current) {
                  if (mapInstance.current.getLayer('analysis-fill')) {
                    mapInstance.current.removeLayer('analysis-fill');
                  }
                  if (mapInstance.current.getLayer('analysis-outline')) {
                    mapInstance.current.removeLayer('analysis-outline');
                  }
                  if (mapInstance.current.getLayer('analysis-points')) {
                    mapInstance.current.removeLayer('analysis-points');
                  }
                  if (mapInstance.current.getLayer('analysis-lines')) {
                    mapInstance.current.removeLayer('analysis-lines');
                  }
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear Results
            </button>
            
            <button 
              onClick={() => {
                // Export analysis results to CSV
                try {
                  const resultType = analysisResults.type;
                  const data = analysisResults.data;
                  
                  // Create CSV content based on analysis type
                  let csvContent = "data:text/csv;charset=utf-8,";
                  
                  if (resultType === 'pointCount' || resultType === 'areaSelection') {
                    csvContent += "Analysis Type,Total Points,Area (km²),Density (points/km²),Percentage of Total\n";
                    csvContent += `${resultType},${data.totalPoints},${data.area.toFixed(2)},${data.density},${data.percentOfTotal}%\n\n`;
                    
                    csvContent += "Status,Count\n";
                    Object.entries(data.pointsByStatus || {}).forEach(([status, count]) => {
                      csvContent += `${status},${count}\n`;
                    });
                    
                    csvContent += "\nCategory,Count\n";
                    Object.entries(data.pointsByCategory || {}).forEach(([category, count]) => {
                      csvContent += `${category},${count}\n`;
                    });
                  } 
                  else if (resultType === 'distance') {
                    csvContent += "Average Distance (km),Max Distance (km),Min Distance (km),Total Complaints,Total Pairs\n";
                    csvContent += `${data.averageDistance.toFixed(2)},${data.maxDistance.toFixed(2)},${data.minDistance.toFixed(2)},${data.totalComplaints},${data.totalPairs}\n\n`;
                    
                    csvContent += "From Complaint ID,To Complaint ID,Distance (km)\n";
                    data.allDistances.forEach(d => {
                      csvContent += `${d.from},${d.to},${d.distance.toFixed(2)}\n`;
                    });
                  }
                  else if (resultType === 'buffer') {
                    csvContent += "Buffer Distance (m),Total Points,Area (km²),Density (points/km²)\n";
                    csvContent += `${data.bufferDistance},${data.totalPoints},${data.area.toFixed(2)},${data.density}\n\n`;
                    
                    csvContent += "Category,Count\n";
                    Object.entries(data.pointsByCategory || {}).forEach(([category, count]) => {
                      csvContent += `${category},${count}\n`;
                    });
                  }
                  else if (resultType === 'density') {
                    csvContent += "Total Points,Max Density,Average Density\n";
                    csvContent += `${data.totalPoints},${data.maxDensity},${data.averageDensity.toFixed(2)}\n\n`;
                    
                    csvContent += "Hotspot Location,Count\n";
                    data.hotspots.forEach((spot, i) => {
                      csvContent += `${spot.location[0].toFixed(4)},${spot.location[1].toFixed(4)},${spot.count}\n`;
                    });
                  }
                  
                  // Create download link
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `map-analysis-${resultType}-${new Date().toISOString().slice(0,10)}.csv`);
                  document.body.appendChild(link);
                  
                  link.click();
                  document.body.removeChild(link);
                } catch (error) {
                  console.error('Error exporting analysis results:', error);
                  alert('Failed to export analysis results');
                }
              }}
              className="text-xs text-green-600 hover:text-green-800"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}
    </>
  );
});

export default MapComponent;
