import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet.heat';
import * as turf from '@turf/turf';
import { useNavigate } from 'react-router-dom';
import { canAccessDrawingTools } from '../../utils/userPermissions';
import './LeafletMap.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Enhanced complaint marker creation with category-specific icons
const createComplaintMarker = (complaint) => {
  const statusColors = {
    open: '#ef4444',
    in_progress: '#f59e0b', 
    resolved: '#10b981',
    closed: '#6b7280',
    default: '#3b82f6'
  };
  
  const categoryIcons = {
    'Road Infrastructure': 'faRoad',
    'Water & Sewerage': 'faTint',
    'Public Safety': 'faShieldAlt',
    'Maintenance': 'faTools',
    'Street Lighting': 'faLightbulb',
    'Waste Management': 'faTrash',
    'Environmental': 'faLeaf',
    'default': 'faExclamationTriangle'
  };
  
  const getIconClass = (category) => {
    return categoryIcons[category] || categoryIcons.default;
  };
  
  const color = statusColors[complaint.status] || statusColors.default;
  const category = complaint.category || complaint.categories?.name || 'default';
  
  // Create custom HTML icon
  const iconHtml = `
    <div style="
      background-color: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    ">
      <i class="fas ${getIconClass(category) === 'faRoad' ? 'fa-road' : 
                     getIconClass(category) === 'faTint' ? 'fa-tint' :
                     getIconClass(category) === 'faShieldAlt' ? 'fa-shield-alt' :
                     getIconClass(category) === 'faTools' ? 'fa-tools' :
                     getIconClass(category) === 'faLightbulb' ? 'fa-lightbulb' :
                     getIconClass(category) === 'faTrash' ? 'fa-trash' :
                     getIconClass(category) === 'faLeaf' ? 'fa-leaf' :
                     'fa-exclamation-triangle'}"></i>
    </div>
  `;
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-complaint-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const LeafletMapComponent = forwardRef(({ 
  mapConfig = { center: { lat: 40.7128, lng: -74.0060 }, zoom: 12 }, 
  setMapLoaded, 
  complaints = [], 
  user, 
  onMapReady,
  showAnalysisTools = false,
  isAdmin = false,
  onAnalysisResults,
  onNearbyComplaintsUpdate,
  onUserLocationUpdate,
  onDrawingComplete
}, ref) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef(new Map());
  const clustersRef = useRef(null);
  const drawingRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const userLocationMarker = useRef(null);
  const heatMapLayer = useRef(null);
  const analysisPopupRef = useRef(null);
  const navigate = useNavigate();

  const [sourcesInitialized, setSourcesInitialized] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalysisInProgress, setIsAnalysisInProgress] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [drawingMode, setDrawingMode] = useState(null);
  const [drawnShapes, setDrawnShapes] = useState([]);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);

  // Simplified complaint popup content
  const createComplaintPopup = useCallback((complaint) => {
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString();
      } catch (error) {
        return 'Invalid date';
      }
    };

    const getStatusColor = (status) => {
      const colors = {
        open: '#ef4444',
        in_progress: '#f59e0b',
        resolved: '#10b981',
        closed: '#6b7280'
      };
      return colors[status] || '#3b82f6';
    };

    return `
      <div style="padding: 12px; min-width: 200px;">
        <h3 style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
          ${complaint.title || 'Untitled Complaint'}
        </h3>
        <div style="margin-bottom: 8px;">
          <span style="
            background: ${getStatusColor(complaint.status)}; 
            color: white; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-size: 12px;
            text-transform: capitalize;
          ">
            ${(complaint.status || 'open').replace('_', ' ')}
          </span>
        </div>
        <p style="margin: 8px 0; font-size: 13px; color: #666;">
          ${complaint.description || 'No description provided'}
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #888;">
          Created: ${formatDate(complaint.created_at)}
        </p>
        <button 
          onclick="window.dispatchEvent(new CustomEvent('viewComplaintDetails', {detail: {id: '${complaint.id}'}}))" 
          style="
            background: #3b82f6; 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 12px;
            margin-top: 8px;
          "
        >
          View Details
        </button>
      </div>
    `;
  }, []);

  // Coordinate extraction
  const extractCoordinates = useCallback((complaint) => {
    if (complaint.coordinates && Array.isArray(complaint.coordinates) && complaint.coordinates.length === 2) {
      const [lng, lat] = complaint.coordinates;
      return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    
    if (complaint.parsedLocation?.latitude && complaint.parsedLocation?.longitude) {
      return { 
        lat: parseFloat(complaint.parsedLocation.latitude), 
        lng: parseFloat(complaint.parsedLocation.longitude) 
      };
    }
    
    if (complaint.latitude && complaint.longitude) {
      return { 
        lat: parseFloat(complaint.latitude), 
        lng: parseFloat(complaint.longitude) 
      };
    }
    
    return null;
  }, []);

  // Heat map functionality
  const createHeatMap = useCallback(() => {
    if (!mapInstance.current) return;
    
    const heatMapData = complaints
      .map(complaint => {
        const coords = extractCoordinates(complaint);
        if (!coords) return null;
        
        // Weight based on status - open complaints are "hotter"
        const intensity = complaint.status === 'open' ? 1.0 : 
                         complaint.status === 'in_progress' ? 0.7 : 
                         0.3;
        
        return [coords.lat, coords.lng, intensity];
      })
      .filter(Boolean);
    
    if (heatMapData.length === 0) return;
    
    // Remove existing heat map
    if (heatMapLayer.current) {
      mapInstance.current.removeLayer(heatMapLayer.current);
    }
    
    // Create new heat map
    heatMapLayer.current = L.heatLayer(heatMapData, {
      radius: 25,
      blur: 35,
      maxZoom: 18,
      max: 1.0,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    });
    
    // Set z-index to ensure heatmap stays below markers
    if (heatMapLayer.current.getPane) {
      heatMapLayer.current.options.pane = 'overlayPane';
    }
    
    if (showHeatMap) {
      heatMapLayer.current.addTo(mapInstance.current);
    }
  }, [complaints, extractCoordinates, showHeatMap]);

  const toggleHeatMap = useCallback(() => {
    if (!mapInstance.current) return;
    
    if (showHeatMap) {
      if (heatMapLayer.current) {
        mapInstance.current.removeLayer(heatMapLayer.current);
      }
      setShowHeatMap(false);
    } else {
      createHeatMap();
      setShowHeatMap(true);
    }
  }, [showHeatMap, createHeatMap]);

  // Enhanced analysis popup
  const showAnalysisResultsPopup = useCallback((results, position) => {
    if (!mapInstance.current || !results) return;
    
    let popupContent = '';
    
    if (results.type === 'count') {
      const data = results.results[0];
      popupContent = `
        <div style="min-width: 250px; padding: 10px;">
          <h4 style="margin: 0 0 10px 0; color: #2563eb; font-size: 16px;">
            📊 Analysis Results
          </h4>
          <div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
            <div style="font-size: 24px; font-weight: bold; color: #1e40af; text-align: center;">
              ${data.totalComplaints}
            </div>
            <div style="text-align: center; color: #64748b; font-size: 12px;">
              Total Complaints in Area
            </div>
          </div>
          
          <div style="margin-bottom: 10px;">
            <strong>Status Breakdown:</strong>
          </div>
          
          <div style="display: grid; gap: 5px;">
            ${Object.entries(data.statusBreakdown || {}).map(([status, count]) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: ${
                status === 'open' ? '#fef2f2' : 
                status === 'in_progress' ? '#fefbf2' :
                status === 'resolved' ? '#f0fdf4' : '#f8fafc'
              }; border-radius: 4px; border-left: 3px solid ${
                status === 'open' ? '#ef4444' : 
                status === 'in_progress' ? '#f59e0b' :
                status === 'resolved' ? '#10b981' : '#6b7280'
              };">
                <span style="text-transform: capitalize; font-size: 13px;">
                  ${status.replace('_', ' ')}
                </span>
                <span style="font-weight: bold; color: #374151;">
                  ${count}
                </span>
              </div>
            `).join('')}
          </div>
          
          <div style="margin-top: 10px; text-align: center;">
            <small style="color: #6b7280;">
              Analysis completed at ${new Date(results.timestamp).toLocaleTimeString()}
            </small>
          </div>
        </div>
      `;
    } else if (results.type === 'density') {
      popupContent = `
        <div style="min-width: 250px; padding: 10px;">
          <h4 style="margin: 0 0 10px 0; color: #2563eb;">🔥 Enhanced Density Analysis</h4>
          <div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
            <div style="display: grid; gap: 8px;">
              <div><strong>Total Points:</strong> ${results.totalPoints}</div>
              <div><strong>Density:</strong> ${results.density?.toFixed(2)} per km²</div>
              <div><strong>Analysis Area:</strong> ${(results.area / 1000000).toFixed(2)} km²</div>
            </div>
          </div>
          
          ${results.categoryBreakdown ? `
            <div style="margin-bottom: 10px;">
              <strong>Category Breakdown:</strong>
            </div>
            <div style="display: grid; gap: 3px; margin-bottom: 10px;">
              ${Object.entries(results.categoryBreakdown).map(([category, count]) => `
                <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0;">
                  <span>${category}</span>
                  <span><strong>${count}</strong></span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 10px;">
            <small style="color: #6b7280;">
              Higher density = more complaints per area
            </small>
          </div>
        </div>
      `;
    } else if (results.type === 'hotspot') {
      popupContent = `
        <div style="min-width: 250px; padding: 10px;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">🔥 Hotspot Analysis</h4>
          <div style="background: #fef2f2; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 4px solid #dc2626;">
            <div style="font-size: 18px; font-weight: bold; color: #dc2626; text-align: center;">
              ${results.totalHotspots}
            </div>
            <div style="text-align: center; color: #991b1b; font-size: 12px;">
              Complaint Hotspots Found
            </div>
          </div>
          
          <div style="margin-bottom: 10px; font-size: 13px;">
            <strong>Hotspot Details:</strong>
          </div>
          
          <div style="max-height: 120px; overflow-y: auto;">
            ${results.hotspots.slice(0, 5).map((hotspot, index) => `
              <div style="display: flex; justify-content: between; align-items: center; padding: 4px 8px; background: #fef7f7; border-radius: 4px; margin-bottom: 3px; font-size: 12px;">
                <span>Hotspot ${index + 1}</span>
                <span style="color: #dc2626; font-weight: bold;">${hotspot.count} complaints</span>
                <span style="color: #6b7280; font-size: 10px;">${(hotspot.intensity * 100).toFixed(1)}%</span>
              </div>
            `).join('')}
            ${results.hotspots.length > 5 ? `<div style="text-align: center; color: #6b7280; font-size: 11px;">... and ${results.hotspots.length - 5} more</div>` : ''}
          </div>
          
          <div style="margin-top: 10px; padding: 8px; background: #fef9c3; border-radius: 4px; font-size: 11px; color: #92400e;">
            ⚠️ High complaint concentration detected. Consider priority response.
          </div>
        </div>
      `;
    } else if (results.type === 'buffer') {
      popupContent = `
        <div style="min-width: 200px; padding: 10px;">
          <h4 style="margin: 0 0 10px 0; color: #2563eb;">📏 Buffer Analysis</h4>
          <div style="background: #f8fafc; padding: 10px; border-radius: 6px;">
            <div><strong>Buffer Distance:</strong> ${results.distance}m</div>
            <div style="margin-top: 5px; font-size: 12px; color: #6b7280;">
              ${results.message}
            </div>
          </div>
        </div>
      `;
    }
    
    if (analysisPopupRef.current) {
      mapInstance.current.closePopup(analysisPopupRef.current);
    }
    
    const popup = L.popup({
      closeOnClick: false,
      autoClose: false,
      className: 'analysis-popup'
    })
    .setLatLng(position)
    .setContent(popupContent)
    .openOn(mapInstance.current);
    
    analysisPopupRef.current = popup;
    setShowAnalysisPopup(true);
  }, []);

  const closeAnalysisPopup = useCallback(() => {
    if (analysisPopupRef.current && mapInstance.current) {
      mapInstance.current.closePopup(analysisPopupRef.current);
      analysisPopupRef.current = null;
      setShowAnalysisPopup(false);
    }
  }, []);

  // Update map data - FIXED VERSION
  const updateMapData = useCallback((newComplaints) => {
    if (!mapInstance.current || !clustersRef.current) {
      return;
    }
    
    console.log('Updating map with complaints:', newComplaints?.length || 0);
    
    // Clear existing markers
    clustersRef.current.clearLayers();
    markersRef.current.clear();
    
    if (!newComplaints || newComplaints.length === 0) {
      return;
    }
    
    let validMarkers = 0;
    
    // Add markers for each complaint
    newComplaints.forEach(complaint => {
      const coords = extractCoordinates(complaint);
      
      if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) {
        console.warn('Invalid coordinates for complaint:', complaint.id);
        return;
      }
      
      // Validate coordinate ranges
      if (coords.lng < -180 || coords.lng > 180 || coords.lat < -90 || coords.lat > 90) {
        console.warn('Coordinates out of range for complaint:', complaint.id, coords);
        return;
      }
      
      // Create custom marker with icon
      const marker = L.marker([coords.lat, coords.lng], {
        icon: createComplaintMarker(complaint),
        zIndexOffset: 1000 // Ensure markers appear above other layers
      });
      
      // Add popup
      const popupContent = createComplaintPopup(complaint);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      
      // Add to cluster and store reference
      clustersRef.current.addLayer(marker);
      markersRef.current.set(complaint.id, marker);
      validMarkers++;
    });
    
    console.log(`Added ${validMarkers} valid markers to map`);
    
    // Update heat map if it's enabled
    if (showHeatMap) {
      createHeatMap();
    }
  }, [createComplaintPopup, extractCoordinates, showHeatMap, createHeatMap]);

  // Get user's current location
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          setUserLocation(location);
          
          // Center map on user location
          if (mapInstance.current) {
            mapInstance.current.setView([location.lat, location.lng], 13);
            
            // Add user location marker
            if (userLocationMarker.current) {
              mapInstance.current.removeLayer(userLocationMarker.current);
            }
            
            userLocationMarker.current = L.circleMarker([location.lat, location.lng], {
              radius: 8,
              fillColor: '#4285f4',
              color: 'white',
              weight: 3,
              opacity: 1,
              fillOpacity: 1
            }).addTo(mapInstance.current);
            
            userLocationMarker.current.bindPopup('Your Location');
          }
          
          if (onUserLocationUpdate) {
            onUserLocationUpdate(location);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          if (mapInstance.current) {
            mapInstance.current.setView([mapConfig.center.lat, mapConfig.center.lng], mapConfig.zoom);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    }
  }, [mapConfig, onUserLocationUpdate]);

  // Enhanced analysis functions with user location integration
  const runSpatialAnalysis = useCallback(async (type, params = {}) => {
    if (!isAdmin || !showAnalysisTools) {
      console.warn('Analysis tools not available');
      return null;
    }

    if (!mapInstance.current) {
      console.warn('Map not initialized');
      return null;
    }
    
    setIsAnalysisInProgress(true);
    
    try {
      let results = {};
      
      if (type === 'count') {
        const drawnLayers = [];
        if (drawnItemsRef.current) {
          drawnItemsRef.current.eachLayer(layer => drawnLayers.push(layer));
        }
        
        if (drawnLayers.length === 0) {
          throw new Error('Draw an area on the map to analyze complaints within that region');
        }
        
        const analysisResults = [];
        
        for (const layer of drawnLayers) {
          let complaintsInArea = [];
          let analysisArea = 0;
          
          if (layer instanceof L.Circle) {
            // Handle circle analysis
            const center = layer.getLatLng();
            const radius = layer.getRadius();
            analysisArea = Math.PI * radius * radius; // Area in square meters
            
            complaintsInArea = complaints.filter(complaint => {
              const coords = extractCoordinates(complaint);
              if (!coords) return false;
              
              const distance = mapInstance.current.distance(
                [coords.lat, coords.lng],
                [center.lat, center.lng]
              );
              return distance <= radius;
            });
            
          } else if (layer.getLatLngs) {
            // Handle polygon/rectangle analysis using Turf.js
            const coords = layer.getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
            coords.push(coords[0]); // Close the polygon
            const polygon = turf.polygon([coords]);
            analysisArea = turf.area(polygon); // Area in square meters
            
            complaintsInArea = complaints.filter(complaint => {
              const complaintCoords = extractCoordinates(complaint);
              if (!complaintCoords) return false;
              
              const point = turf.point([complaintCoords.lng, complaintCoords.lat]);
              return turf.booleanPointInPolygon(point, polygon);
            });
          }
          
          // Calculate status and category breakdowns
          const statusCounts = complaintsInArea.reduce((acc, complaint) => {
            acc[complaint.status] = (acc[complaint.status] || 0) + 1;
            return acc;
          }, {});
          
          const categoryCounts = complaintsInArea.reduce((acc, complaint) => {
            const category = complaint.category || complaint.categories?.name || 'Unknown';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {});
          
          // Calculate density (complaints per square kilometer)
          const densityPerKm2 = analysisArea > 0 ? (complaintsInArea.length / analysisArea) * 1000000 : 0;
          
          analysisResults.push({
            totalComplaints: complaintsInArea.length,
            statusBreakdown: statusCounts,
            categoryBreakdown: categoryCounts,
            complaints: complaintsInArea,
            shapeType: layer instanceof L.Circle ? 'circle' : 'polygon',
            area: analysisArea,
            density: densityPerKm2,
            userLocationDistance: userLocation ? mapInstance.current.distance(
              [userLocation.lat, userLocation.lng],
              layer instanceof L.Circle ? [layer.getLatLng().lat, layer.getLatLng().lng] : 
              layer.getBounds ? [layer.getBounds().getCenter().lat, layer.getBounds().getCenter().lng] : [0, 0]
            ) : null
          });
        }
        
        results = {
          type: 'count',
          timestamp: new Date().toISOString(),
          results: analysisResults,
          userLocation: userLocation
        };
        
      } else if (type === 'density') {
        // Enhanced density analysis with user location context
        const validComplaints = complaints.filter(c => extractCoordinates(c));
        const points = validComplaints.map(c => {
          const coords = extractCoordinates(c);
          return turf.point([coords.lng, coords.lat], { 
            status: c.status,
            category: c.category || c.categories?.name || 'unknown',
            id: c.id
          });
        });
        
        if (points.length > 0) {
          const collection = turf.featureCollection(points);
          let analysisArea, analysisCenter;
          
          // Use drawn area if available, otherwise use map bounds
          const drawnLayers = [];
          if (drawnItemsRef.current) {
            drawnItemsRef.current.eachLayer(layer => drawnLayers.push(layer));
          }
          
          if (drawnLayers.length > 0) {
            const layer = drawnLayers[0];
            if (layer instanceof L.Circle) {
              const center = layer.getLatLng();
              const radius = layer.getRadius();
              analysisArea = Math.PI * radius * radius;
              analysisCenter = center;
            } else if (layer.getLatLngs) {
              const coords = layer.getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
              coords.push(coords[0]);
              const polygon = turf.polygon([coords]);
              analysisArea = turf.area(polygon);
              analysisCenter = layer.getBounds().getCenter();
            }
          } else {
            // Use current map bounds
            const bounds = mapInstance.current.getBounds();
            analysisArea = turf.area(turf.bboxPolygon([
              bounds.getWest(), bounds.getSouth(), 
              bounds.getEast(), bounds.getNorth()
            ]));
            analysisCenter = bounds.getCenter();
          }
          
          // Calculate density per square kilometer
          const densityPerKm2 = (points.length / analysisArea) * 1000000;
          
          // Category breakdown
          const categoryBreakdown = points.reduce((acc, point) => {
            const category = point.properties.category;
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {});
          
          // Distance from user location if available
          const distanceFromUser = userLocation ? mapInstance.current.distance(
            [userLocation.lat, userLocation.lng],
            [analysisCenter.lat, analysisCenter.lng]
          ) : null;
          
          results = {
            type: 'density',
            timestamp: new Date().toISOString(),
            totalPoints: points.length,
            density: densityPerKm2,
            area: analysisArea,
            categoryBreakdown: categoryBreakdown,
            analysisCenter: analysisCenter,
            distanceFromUser: distanceFromUser,
            userLocation: userLocation
          };
        }
        
      } else if (type === 'hotspot') {
        // Enhanced hotspot analysis with user location integration
        const validComplaints = complaints.filter(c => extractCoordinates(c));
        if (validComplaints.length < 3) {
          throw new Error('Need at least 3 complaints for hotspot analysis');
        }
        
        const points = validComplaints.map(c => {
          const coords = extractCoordinates(c);
          return [coords.lat, coords.lng];
        });
        
        // Use current view bounds or drawn area for analysis
        let bounds = mapInstance.current.getBounds();
        const drawnLayers = [];
        if (drawnItemsRef.current) {
          drawnItemsRef.current.eachLayer(layer => drawnLayers.push(layer));
        }
        
        if (drawnLayers.length > 0 && drawnLayers[0].getBounds) {
          bounds = drawnLayers[0].getBounds();
        }
        
        // Create adaptive grid based on zoom level and area size
        const zoomLevel = mapInstance.current.getZoom();
        const gridSize = Math.max(0.0005, 0.002 / Math.pow(2, zoomLevel - 10)); // Adaptive grid size
        const hotspots = [];
        
        for (let lat = bounds.getSouth(); lat < bounds.getNorth(); lat += gridSize) {
          for (let lng = bounds.getWest(); lng < bounds.getEast(); lng += gridSize) {
            const gridCenter = [lat + gridSize/2, lng + gridSize/2];
            const searchRadius = gridSize * 111000; // Convert to meters approximately
            
            const pointsInGrid = points.filter(point => {
              const distance = mapInstance.current.distance(point, gridCenter);
              return distance <= searchRadius;
            });
            
            if (pointsInGrid.length >= 2) {
              const distanceFromUser = userLocation ? mapInstance.current.distance(
                [userLocation.lat, userLocation.lng],
                gridCenter
              ) : null;
              
              hotspots.push({
                center: gridCenter,
                count: pointsInGrid.length,
                intensity: pointsInGrid.length / validComplaints.length,
                distanceFromUser: distanceFromUser,
                radius: searchRadius
              });
            }
          }
        }
        
        // Sort hotspots by intensity and proximity to user
        hotspots.sort((a, b) => {
          if (userLocation && a.distanceFromUser && b.distanceFromUser) {
            // Weight by both intensity and proximity to user
            const scoreA = a.intensity * 0.7 + (1 / (a.distanceFromUser / 1000)) * 0.3;
            const scoreB = b.intensity * 0.7 + (1 / (b.distanceFromUser / 1000)) * 0.3;
            return scoreB - scoreA;
          }
          return b.intensity - a.intensity;
        });
        
        // Visualize top hotspots
        hotspots.slice(0, 10).forEach((hotspot, index) => {
          if (hotspot.count >= 2) {
            const circle = L.circle(hotspot.center, {
              radius: Math.max(100, hotspot.radius),
              color: hotspot.count >= 5 ? '#dc2626' : hotspot.count >= 3 ? '#f59e0b' : '#3b82f6',
              fillColor: hotspot.count >= 5 ? '#dc2626' : hotspot.count >= 3 ? '#f59e0b' : '#3b82f6',
              fillOpacity: 0.2 + (hotspot.intensity * 0.4),
              weight: 2
            });
            
            const distanceText = hotspot.distanceFromUser ? 
              `<br><small>📍 ${(hotspot.distanceFromUser / 1000).toFixed(1)}km from your location</small>` : '';
            
            circle.bindPopup(`
              <div style="text-align: center; padding: 5px;">
                <strong>🔥 Hotspot #${index + 1}</strong><br>
                ${hotspot.count} complaints<br>
                <small>Intensity: ${(hotspot.intensity * 100).toFixed(1)}%</small>
                ${distanceText}
              </div>
            `);
            
            if (drawnItemsRef.current) {
              drawnItemsRef.current.addLayer(circle);
            }
          }
        });
        
        results = {
          type: 'hotspot',
          timestamp: new Date().toISOString(),
          totalHotspots: hotspots.filter(h => h.count >= 2).length,
          hotspots: hotspots.filter(h => h.count >= 2),
          userLocation: userLocation,
          message: `Found ${hotspots.filter(h => h.count >= 2).length} complaint hotspots`
        };
        
      } else if (type === 'buffer') {
        // Enhanced buffer analysis around user location or drawn shapes
        const distance = params.distance || 500;
        let bufferCenter = params.center;
        
        // Use user location as default center if not specified
        if (!bufferCenter && userLocation) {
          bufferCenter = [userLocation.lat, userLocation.lng];
        }
        
        if (!bufferCenter) {
          throw new Error('No center point available for buffer analysis. Enable location services or draw a shape first.');
        }
        
        // Find complaints within buffer distance
        const complaintsInBuffer = complaints.filter(complaint => {
          const coords = extractCoordinates(complaint);
          if (!coords) return false;
          
          const distanceToComplaint = mapInstance.current.distance(
            [coords.lat, coords.lng],
            bufferCenter
          );
          return distanceToComplaint <= distance;
        });
        
        // Create or update buffer visualization
        const bufferCircle = L.circle(bufferCenter, {
          radius: distance,
          color: '#8b5cf6',
          fillColor: '#8b5cf6',
          fillOpacity: 0.1,
          weight: 3,
          dashArray: '10, 5'
        });
        
        if (drawnItemsRef.current) {
          drawnItemsRef.current.addLayer(bufferCircle);
        }
        
        // Calculate status breakdown
        const statusBreakdown = complaintsInBuffer.reduce((acc, complaint) => {
          acc[complaint.status] = (acc[complaint.status] || 0) + 1;
          return acc;
        }, {});
        
        results = {
          type: 'buffer',
          timestamp: new Date().toISOString(),
          distance: distance,
          center: bufferCenter,
          totalComplaints: complaintsInBuffer.length,
          statusBreakdown: statusBreakdown,
          complaints: complaintsInBuffer,
          userLocation: userLocation,
          isUserCentered: userLocation && 
            bufferCenter[0] === userLocation.lat && 
            bufferCenter[1] === userLocation.lng,
          message: `Found ${complaintsInBuffer.length} complaints within ${distance}m${
            userLocation && bufferCenter[0] === userLocation.lat && bufferCenter[1] === userLocation.lng ? 
            ' of your location' : ' of the selected point'
          }`
        };
        
      } else if (type === 'nearby') {
        // New analysis type: find complaints near user location
        if (!userLocation) {
          throw new Error('Location access required for nearby analysis');
        }
        
        const searchRadius = params.radius || 1000; // Default 1km
        
        const nearbyComplaints = complaints.filter(complaint => {
          const coords = extractCoordinates(complaint);
          if (!coords) return false;
          
          const distance = mapInstance.current.distance(
            [coords.lat, coords.lng],
            [userLocation.lat, userLocation.lng]
          );
          return distance <= searchRadius;
        }).map(complaint => {
          const coords = extractCoordinates(complaint);
          const distance = mapInstance.current.distance(
            [coords.lat, coords.lng],
            [userLocation.lat, userLocation.lng]
          );
          return { ...complaint, distance };
        }).sort((a, b) => a.distance - b.distance);
        
        // Create visualization circle
        const searchCircle = L.circle([userLocation.lat, userLocation.lng], {
          radius: searchRadius,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 5'
        });
        
        if (drawnItemsRef.current) {
          drawnItemsRef.current.addLayer(searchCircle);
        }
        
        results = {
          type: 'nearby',
          timestamp: new Date().toISOString(),
          searchRadius: searchRadius,
          userLocation: userLocation,
          totalNearby: nearbyComplaints.length,
          complaints: nearbyComplaints.slice(0, 20), // Limit to 20 closest
          message: `Found ${nearbyComplaints.length} complaints within ${searchRadius}m of your location`
        };
      }
      
      setAnalysisResults(results);
      if (onAnalysisResults) {
        onAnalysisResults(results);
      }
      
      // Show analysis popup if we have results and a center point
      if (results && !results.error) {
        let popupPosition = null;
        
        if (type === 'count' && drawnItemsRef.current) {
          const drawnLayers = [];
          drawnItemsRef.current.eachLayer(layer => drawnLayers.push(layer));
          
          if (drawnLayers.length > 0) {
            const firstLayer = drawnLayers[0];
            if (firstLayer instanceof L.Circle) {
              popupPosition = firstLayer.getLatLng();
            } else if (firstLayer.getBounds) {
              popupPosition = firstLayer.getBounds().getCenter();
            } else if (firstLayer.getLatLng) {
              popupPosition = firstLayer.getLatLng();
            }
          }
        } else if ((type === 'buffer' || type === 'nearby') && results.center) {
          popupPosition = { lat: results.center[0], lng: results.center[1] };
        } else if (type === 'buffer' && userLocation) {
          popupPosition = { lat: userLocation.lat, lng: userLocation.lng };
        }
        
        if (popupPosition) {
          setTimeout(() => showAnalysisResultsPopup(results, popupPosition), 100);
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Analysis error:', error);
      const errorResult = { 
        error: error.message,
        type: type,
        timestamp: new Date().toISOString(),
        userLocation: userLocation
      };
      setAnalysisResults(errorResult);
      return errorResult;
    } finally {
      setIsAnalysisInProgress(false);
    }
  }, [isAdmin, showAnalysisTools, complaints, extractCoordinates, onAnalysisResults, showAnalysisResultsPopup, userLocation]);

  // Enhanced drawing mode handlers
  const enableDrawingMode = useCallback((mode) => {
    if (!mapInstance.current) {
      console.warn('Map instance not initialized');
      return;
    }
    
    if (!drawingRef.current) {
      console.warn('Drawing controls not initialized - user may not have drawing permissions');
      return;
    }
    
    // Disable any currently active drawing mode first
    if (drawingRef.current._toolbars) {
      Object.values(drawingRef.current._toolbars).forEach(toolbar => {
        if (toolbar.disable) toolbar.disable();
      });
    }
    
    setDrawingMode(mode);
    console.log(`Enabling drawing mode: ${mode}`);
    
    try {
      // Enable the appropriate drawing tool with proper options
      switch (mode) {
        case 'polygon':
          const polygonDrawer = new L.Draw.Polygon(mapInstance.current, {
            allowIntersection: false,
            drawError: {
              color: '#e1e100',
              timeout: 3000,
              message: '<strong>Error:</strong> shape edges cannot cross!'
            },
            shapeOptions: {
              color: '#3b82f6',
              weight: 3,
              fillOpacity: 0.2,
              fillColor: '#3b82f6'
            },
            showArea: true,
            metric: true,
            feet: false,
            nautic: false
          });
          polygonDrawer.enable();
          console.log('Polygon drawing enabled - click on map to start drawing');
          break;
          
        case 'circle':
          const circleDrawer = new L.Draw.Circle(mapInstance.current, {
            shapeOptions: {
              color: '#f59e0b',
              weight: 3,
              fillOpacity: 0.2,
              fillColor: '#f59e0b'
            },
            showRadius: true,
            metric: true,
            feet: false,
            nautic: false
          });
          circleDrawer.enable();
          console.log('Circle drawing enabled - click and drag on map to create circle');
          break;
          
        case 'rectangle':
          const rectangleDrawer = new L.Draw.Rectangle(mapInstance.current, {
            shapeOptions: {
              color: '#10b981',
              weight: 3,
              fillOpacity: 0.2,
              fillColor: '#10b981'
            },
            showArea: true,
            metric: true,
            feet: false,
            nautic: false
          });
          rectangleDrawer.enable();
          console.log('Rectangle drawing enabled - click and drag on map to create rectangle');
          break;
          
        case 'marker':
          const markerDrawer = new L.Draw.Marker(mapInstance.current, {
            icon: new L.Icon.Default(),
            repeatMode: false
          });
          markerDrawer.enable();
          console.log('Marker drawing enabled - click on map to place marker');
          break;
          
        case 'buffer':
          // Special mode for buffer analysis around user location
          if (userLocation) {
            const bufferDistance = 500; // Default 500m
            const bufferCircle = L.circle([userLocation.lat, userLocation.lng], {
              radius: bufferDistance,
              color: '#8b5cf6',
              weight: 3,
              fillOpacity: 0.2,
              fillColor: '#8b5cf6'
            });
            
            if (drawnItemsRef.current) {
              drawnItemsRef.current.addLayer(bufferCircle);
              setDrawnShapes(prev => [...prev, {
                id: L.stamp(bufferCircle),
                type: 'buffer',
                layer: bufferCircle,
                distance: bufferDistance
              }]);
              
              // Auto-run buffer analysis
              setTimeout(() => runSpatialAnalysis('buffer', { distance: bufferDistance }), 100);
            }
          } else {
            console.warn('User location not available for buffer analysis');
          }
          setDrawingMode(null);
          break;
          
        default:
          console.warn('Unknown drawing mode:', mode);
      }
    } catch (error) {
      console.error('Error enabling drawing mode:', error);
      setDrawingMode(null);
    }
  }, [userLocation, runSpatialAnalysis]);

  const disableDrawingMode = useCallback(() => {
    setDrawingMode(null);
    
    // Properly disable all drawing tools
    if (drawingRef.current && drawingRef.current._toolbars) {
      Object.values(drawingRef.current._toolbars).forEach(toolbar => {
        if (toolbar.disable) toolbar.disable();
      });
    }
  }, []);

  // Clear analysis
  const clearAnalysisLayers = useCallback(() => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    setAnalysisResults(null);
    setDrawnShapes([]);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;
    
    console.log('Initializing map...');
    
    try {
      // Create map
      const map = L.map(mapContainer.current, {
        center: [mapConfig.center.lat, mapConfig.center.lng],
        zoom: mapConfig.zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        attributionControl: true
      });
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      
      // Initialize clustering with better options
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: false
      });
      
      // Ensure cluster group appears above base layers
      clusterGroup.on('add', function() {
        if (this.getPane) {
          this.options.pane = 'markerPane';
        }
      });
      
      map.addLayer(clusterGroup);
      
      // Initialize enhanced drawing controls for users with drawing access
      if (showAnalysisTools || canAccessDrawingTools(user)) {
        try {
          const drawnItems = new L.FeatureGroup();
          map.addLayer(drawnItems);
          
          // Store reference for analysis functions
          drawnItemsRef.current = drawnItems;
        
        const drawControl = new L.Control.Draw({
          position: 'topright',
          edit: {
            featureGroup: drawnItems,
            remove: true,
            edit: true
          },
          draw: {
            polygon: {
              allowIntersection: false,
              drawError: {
                color: '#e74c3c',
                timeout: 2500,
                message: '<strong>⚠️ Error:</strong> Shape edges cannot cross!'
              },
              shapeOptions: {
                color: '#3b82f6',
                weight: 3,
                fillOpacity: 0.15,
                fillColor: '#3b82f6'
              },
              showArea: true,
              metric: true,
              feet: false,
              nautic: false,
              precision: {
                km: 2,
                ha: 2,
                m: 0,
                mi: 2,
                ac: 2,
                yd: 0,
                ft: 0
              }
            },
            rectangle: {
              shapeOptions: {
                color: '#10b981',
                weight: 3,
                fillOpacity: 0.15,
                fillColor: '#10b981'
              },
              showArea: true,
              metric: true,
              feet: false,
              nautic: false
            },
            circle: {
              shapeOptions: {
                color: '#f59e0b',
                weight: 3,
                fillOpacity: 0.15,
                fillColor: '#f59e0b'
              },
              showRadius: true,
              metric: true,
              feet: false,
              nautic: false
            },
            marker: {
              icon: new L.Icon.Default(),
              repeatMode: false,
              zIndexOffset: 2000
            },
            polyline: false,
            circlemarker: false
          }
        });
        
        map.addControl(drawControl);
        
        // Enhanced drawing event handlers
        map.on('draw:drawstart', (e) => {
          console.log('Drawing started:', e.layerType);
          setDrawingMode(e.layerType);
          
          // Close any open analysis popups
          if (analysisPopupRef.current) {
            map.closePopup(analysisPopupRef.current);
            analysisPopupRef.current = null;
            setShowAnalysisPopup(false);
          }
        });
        
        map.on('draw:drawstop', (e) => {
          console.log('Drawing stopped');
          setDrawingMode(null);
        });
        
        map.on('draw:created', (e) => {
          console.log('Shape created:', e.layerType);
          const layer = e.layer;
          
          // Add created layer to the feature group
          drawnItems.addLayer(layer);
          
          // Calculate area or radius for display
          let areaInfo = '';
          if (layer instanceof L.Circle) {
            const radius = layer.getRadius();
            areaInfo = `Radius: ${radius.toFixed(0)}m`;
          } else if (layer.getArea) {
            const area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) : 0;
            areaInfo = area > 1000000 ? 
              `Area: ${(area / 1000000).toFixed(2)} km²` : 
              `Area: ${area.toFixed(0)} m²`;
          }
          
          // Store enhanced shape info
          const shapeInfo = {
            id: L.stamp(layer),
            type: e.layerType,
            layer: layer,
            created: new Date().toISOString(),
            areaInfo: areaInfo,
            userLocation: userLocation ? { ...userLocation } : null
          };
          
          setDrawnShapes(prev => [...prev, shapeInfo]);
          
          // Add popup to show shape info
          if (areaInfo) {
            layer.bindPopup(`
              <div style="text-align: center; padding: 8px;">
                <strong>📐 ${e.layerType.charAt(0).toUpperCase() + e.layerType.slice(1)}</strong><br>
                ${areaInfo}<br>
                <small style="color: #6b7280;">Click to analyze complaints</small>
              </div>
            `);
          }
          
          // Auto-open popup to show shape was created
          setTimeout(() => {
            if (layer.getLatLng) {
              layer.openPopup();
            } else if (layer.getBounds) {
              layer.openPopup(layer.getBounds().getCenter());
            }
          }, 100);
          
          // Trigger drawing complete callback
          if (onDrawingComplete) {
            onDrawingComplete({
              shape: layer,
              type: e.layerType,
              id: L.stamp(layer),
              areaInfo: areaInfo
            });
          }
          
          // Auto-analyze after a short delay
          setTimeout(() => {
            runSpatialAnalysis('count').then(results => {
              console.log('Auto-analysis completed:', results);
            }).catch(error => {
              console.error('Auto-analysis failed:', error);
            });
          }, 200);
          
          setDrawingMode(null);
        });
        
        map.on('draw:edited', (e) => {
          console.log('Shapes edited');
          
          // Update area info for edited shapes
          e.layers.eachLayer(layer => {
            let areaInfo = '';
            if (layer instanceof L.Circle) {
              const radius = layer.getRadius();
              areaInfo = `Radius: ${radius.toFixed(0)}m`;
            } else if (layer.getArea) {
              const area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) : 0;
              areaInfo = area > 1000000 ? 
                `Area: ${(area / 1000000).toFixed(2)} km²` : 
                `Area: ${area.toFixed(0)} m²`;
            }
            
            // Update stored shape info
            setDrawnShapes(prev => prev.map(shape => 
              shape.id === L.stamp(layer) ? 
              { ...shape, areaInfo, lastEdited: new Date().toISOString() } : 
              shape
            ));
            
            // Update popup content
            if (areaInfo && layer.getPopup()) {
              layer.setPopupContent(`
                <div style="text-align: center; padding: 8px;">
                  <strong>📐 Edited Shape</strong><br>
                  ${areaInfo}<br>
                  <small style="color: #6b7280;">Analysis will update automatically</small>
                </div>
              `);
            }
          });
          
          // Re-run analysis when shapes are edited
          setTimeout(() => {
            runSpatialAnalysis('count').then(results => {
              console.log('Analysis updated after edit:', results);
            }).catch(error => {
              console.error('Analysis update failed:', error);
            });
          }, 200);
        });
        
        map.on('draw:deleted', (e) => {
          console.log('Shapes deleted');
          
          // Update drawn shapes list
          const deletedIds = [];
          e.layers.eachLayer(layer => {
            deletedIds.push(L.stamp(layer));
          });
          
          setDrawnShapes(prev => {
            const remaining = prev.filter(shape => !deletedIds.includes(shape.id));
            console.log(`Removed ${deletedIds.length} shapes, ${remaining.length} remaining`);
            return remaining;
          });
          
          // Re-run analysis if there are still shapes, otherwise clear results
          if (drawnItems.getLayers().length > 0) {
            setTimeout(() => {
              runSpatialAnalysis('count').then(results => {
                console.log('Analysis updated after deletion:', results);
              }).catch(error => {
                console.error('Analysis update failed:', error);
              });
            }, 200);
          } else {
            console.log('All shapes deleted, clearing analysis results');
            setAnalysisResults(null);
            if (analysisPopupRef.current) {
              map.closePopup(analysisPopupRef.current);
              analysisPopupRef.current = null;
              setShowAnalysisPopup(false);
            }
          }
        });
        
        // Handle drawing errors
        map.on('draw:drawvertex', (e) => {
          // Provide feedback during polygon drawing
          const vertexCount = e.layers.getLayers().length;
          if (vertexCount >= 3) {
            // Could show a temporary tooltip about completing the polygon
          }
        });

        // Handle shape creation
        map.on('draw:created', (e) => {
          const layer = e.layer;
          const type = e.layerType;
          
          console.log(`Shape created: ${type}`, layer);
          
          // Add the shape to the drawn items layer
          drawnItems.addLayer(layer);
          
          // Generate unique ID for the shape
          const shapeId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          layer.shapeId = shapeId;
          
          // Store shape data
          let shapeData = {
            id: shapeId,
            type: type,
            layer: layer
          };
          
          // Get geometry data based on shape type
          if (type === 'polygon') {
            shapeData.coordinates = layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]);
            shapeData.area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]) : 0;
          } else if (type === 'circle') {
            shapeData.center = [layer.getLatLng().lat, layer.getLatLng().lng];
            shapeData.radius = layer.getRadius();
            shapeData.area = Math.PI * layer.getRadius() * layer.getRadius();
          } else if (type === 'rectangle') {
            shapeData.bounds = layer.getBounds();
            shapeData.coordinates = [
              [layer.getBounds().getNorth(), layer.getBounds().getWest()],
              [layer.getBounds().getNorth(), layer.getBounds().getEast()],
              [layer.getBounds().getSouth(), layer.getBounds().getEast()],
              [layer.getBounds().getSouth(), layer.getBounds().getWest()]
            ];
          } else if (type === 'marker') {
            shapeData.coordinates = [layer.getLatLng().lat, layer.getLatLng().lng];
          }
          
          // Update drawn shapes state
          setDrawnShapes(prev => [...prev, shapeData]);
          
          // Disable current drawing mode
          setDrawingMode(null);
          
          // Notify parent component if callback provided
          if (onDrawingComplete) {
            onDrawingComplete(shapeData);
          }
          
          console.log('Drawing completed:', shapeData);
        });
        
        drawingRef.current = drawControl;
        drawnItemsRef.current = drawnItems;
        
        console.log('Drawing controls initialized successfully');
        } catch (drawingError) {
          console.error('Error initializing drawing controls:', drawingError);
          // Drawing controls optional - don't block map initialization
        }
      }
      
      // Store references
      mapInstance.current = map;
      clustersRef.current = clusterGroup;
      
      if (setMapLoaded) {
        setMapLoaded(true);
      }
      if (onMapReady) {
        onMapReady(map);
      }
      
      // Get user location after map is ready
      setTimeout(() => {
        getUserLocation();
      }, 500);
      
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [mapConfig, isAdmin, showAnalysisTools, setMapLoaded, onMapReady, getUserLocation, runSpatialAnalysis, onDrawingComplete]);

  // Update map data when complaints change
  useEffect(() => {
    if (!sourcesInitialized) return;
    updateMapData(complaints);
  }, [complaints, sourcesInitialized, updateMapData]);

  // Update heat map when showHeatMap or complaints change
  useEffect(() => {
    if (sourcesInitialized && mapInstance.current) {
      createHeatMap();
    }
  }, [showHeatMap, complaints, sourcesInitialized, createHeatMap]);

  // Initialize sources once map is ready
  useEffect(() => {
    if (mapInstance.current && !sourcesInitialized) {
      setSourcesInitialized(true);
      
      // Setup event listeners
      const handleViewDetails = (event) => {
        const complaintId = event.detail.id;
        if (navigate) {
          navigate(`/complaint/${complaintId}`);
        }
      };
      
      window.addEventListener('viewComplaintDetails', handleViewDetails);
      
      return () => {
        window.removeEventListener('viewComplaintDetails', handleViewDetails);
      };
    }
  }, [mapInstance.current, sourcesInitialized, navigate]);

  // Enhanced API for parent components
  useImperativeHandle(ref, () => ({
    getMap: () => mapInstance.current,
    
    fitBounds: (bounds) => {
      if (mapInstance.current && bounds) {
        mapInstance.current.fitBounds(bounds);
      }
    },
    
    setView: (center, zoom) => {
      if (mapInstance.current) {
        mapInstance.current.setView(center, zoom);
      }
    },
    
    focusOnComplaint: (complaintId) => {
      const marker = markersRef.current.get(complaintId);
      if (marker && mapInstance.current) {
        mapInstance.current.setView(marker.getLatLng(), 16);
        marker.openPopup();
      }
    },
    
    // Enhanced location methods
    getUserLocation: getUserLocation,
    getCurrentUserLocation: () => userLocation,
    centerOnUserLocation: () => {
      if (userLocation && mapInstance.current) {
        mapInstance.current.setView([userLocation.lat, userLocation.lng], 15);
      }
    },
    
    refreshData: () => updateMapData(complaints),
    
    // Data export methods
    getComplaintsData: () => complaints,
    getAllComplaintData: () => {
      // Return enhanced complaint data for export
      return complaints.map(complaint => ({
        ...complaint,
        coordinates: complaint.coordinates || [null, null],
        locationName: complaint.locationName || 'Location unavailable',
        categoryName: complaint.categories?.name || 'Uncategorized',
        statusDisplay: complaint.status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN',
        priorityLevel: complaint.priority || 'Not specified',
        reporterInfo: complaint.anonymous ? 'Anonymous User' : (complaint.reported_by_name || `User #${complaint.reported_by}`),
        createdDate: complaint.created_at ? new Date(complaint.created_at).toISOString() : null,
        updatedDate: complaint.updated_at ? new Date(complaint.updated_at).toISOString() : null
      }));
    },
    
    // Enhanced drawing methods
    enableDrawingMode: enableDrawingMode,
    disableDrawingMode: disableDrawingMode,
    clearAllDrawings: () => {
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
        setDrawnShapes([]);
        setAnalysisResults(null);
        closeAnalysisPopup();
      }
    },
    getDrawnShapes: () => drawnShapes,
    getDrawingMode: () => drawingMode,
    
    // Enhanced analysis methods
    runSpatialAnalysis: runSpatialAnalysis,
    runNearbyAnalysis: (radius = 1000) => runSpatialAnalysis('nearby', { radius }),
    runBufferAnalysis: (distance = 500, center = null) => {
      const bufferCenter = center || (userLocation ? [userLocation.lat, userLocation.lng] : null);
      return runSpatialAnalysis('buffer', { distance, center: bufferCenter });
    },
    runDensityAnalysis: () => runSpatialAnalysis('density'),
    runHotspotAnalysis: () => runSpatialAnalysis('hotspot'),
    clearAnalysisLayers: clearAnalysisLayers,
    getAnalysisResults: () => analysisResults,
    isAnalysisInProgress: () => isAnalysisInProgress,
    
    // Heat map methods
    toggleHeatMap: toggleHeatMap,
    createHeatMap: createHeatMap,
    getShowHeatMap: () => showHeatMap,
    
    // Popup and UI methods
    showAnalysisResultsPopup: showAnalysisResultsPopup,
    closeAnalysisPopup: closeAnalysisPopup,
    isAnalysisPopupOpen: () => showAnalysisPopup,
    
    // Quick action methods
    quickAnalyzeNearbyComplaints: (radius = 1000) => {
      if (!userLocation) {
        console.warn('User location required for nearby analysis');
        return Promise.reject(new Error('Location access required'));
      }
      return runSpatialAnalysis('nearby', { radius });
    },
    
    quickCreateBufferAroundUser: (distance = 500) => {
      if (!userLocation) {
        console.warn('User location required for buffer analysis');
        return Promise.reject(new Error('Location access required'));
      }
      return enableDrawingMode('buffer');
    },
    
    // State getters
    getMapState: () => ({
      center: mapInstance.current ? mapInstance.current.getCenter() : null,
      zoom: mapInstance.current ? mapInstance.current.getZoom() : null,
      bounds: mapInstance.current ? mapInstance.current.getBounds() : null,
      userLocation: userLocation,
      drawingMode: drawingMode,
      drawnShapes: drawnShapes,
      analysisResults: analysisResults,
      showHeatMap: showHeatMap,
      isAnalysisInProgress: isAnalysisInProgress
    }),
    
    // Utility methods
    distanceBetweenPoints: (point1, point2) => {
      if (!mapInstance.current) return null;
      return mapInstance.current.distance(point1, point2);
    },
    
    isPointInView: (lat, lng) => {
      if (!mapInstance.current) return false;
      const bounds = mapInstance.current.getBounds();
      return bounds.contains([lat, lng]);
    },
    
    // Legacy methods for backward compatibility
    createBuffer: (distance) => runSpatialAnalysis('buffer', { distance })
  }));

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="h-full w-full" />
      
      {/* Enhanced Heat Map Toggle with Location Integration */}
      {isAdmin && complaints.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000] space-y-2">
          <button
            onClick={toggleHeatMap}
            className={`px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-200 ${
              showHeatMap 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
            title={showHeatMap ? 'Hide Heat Map' : 'Show Heat Map'}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xs">🔥</span>
              <span>{showHeatMap ? 'Hide' : 'Show'} Heat Map</span>
            </div>
          </button>
          
          {/* Quick Analysis Buttons */}
          {userLocation && (
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => runSpatialAnalysis('nearby', { radius: 1000 })}
                disabled={isAnalysisInProgress}
                className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md shadow hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Find complaints within 1km of your location"
              >
                📍 Nearby (1km)
              </button>
              <button
                onClick={() => enableDrawingMode('buffer')}
                disabled={isAnalysisInProgress}
                className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-md shadow hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Create buffer around your location"
              >
                ⭕ Buffer Zone
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Enhanced Analysis Results Panel */}
      {isAdmin && analysisResults && !showAnalysisPopup && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg max-w-sm z-[1000] border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm flex items-center">
              {analysisResults.type === 'count' && '📊 Area Analysis'}
              {analysisResults.type === 'buffer' && '⭕ Buffer Analysis'}
              {analysisResults.type === 'density' && '🔥 Density Analysis'}
              {analysisResults.type === 'hotspot' && '🎯 Hotspot Analysis'}
              {analysisResults.type === 'nearby' && '📍 Nearby Analysis'}
            </h3>
            <button
              onClick={() => setAnalysisResults(null)}
              className="text-gray-400 hover:text-gray-600 text-lg"
            >
              ×
            </button>
          </div>
          
          {analysisResults.error ? (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
              <strong>⚠️ Error:</strong> {analysisResults.error}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {analysisResults.type === 'count' && analysisResults.results?.[0] && (
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <p className="font-medium text-blue-900 mb-2">
                    🎯 {analysisResults.results[0].totalComplaints} complaints found
                  </p>
                  {analysisResults.results[0].density && (
                    <p className="text-blue-700 text-xs mb-2">
                      Density: {analysisResults.results[0].density.toFixed(2)} per km²
                    </p>
                  )}
                  <div className="mt-2">
                    <p className="text-blue-800 font-medium text-xs">Status Breakdown:</p>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      {Object.entries(analysisResults.results[0].statusBreakdown || {}).map(([status, count]) => (
                        <div key={status} className="text-xs flex justify-between">
                          <span className="capitalize">{status.replace('_', ' ')}:</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {analysisResults.results[0].userLocationDistance && (
                    <p className="text-blue-600 text-xs mt-2">
                      📏 {(analysisResults.results[0].userLocationDistance / 1000).toFixed(1)}km from your location
                    </p>
                  )}
                </div>
              )}
              
              {analysisResults.type === 'buffer' && (
                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                  <p className="font-medium text-purple-900">
                    ⭕ Buffer Zone Analysis
                  </p>
                  <p className="text-purple-700 text-xs">
                    📏 {analysisResults.distance}m radius
                  </p>
                  <p className="text-purple-700 text-xs">
                    🎯 {analysisResults.totalComplaints} complaints found
                  </p>
                  {analysisResults.isUserCentered && (
                    <p className="text-purple-600 text-xs mt-1">
                      📍 Centered on your location
                    </p>
                  )}
                </div>
              )}
              
              {analysisResults.type === 'nearby' && (
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <p className="font-medium text-green-900">
                    📍 Nearby Complaints
                  </p>
                  <p className="text-green-700 text-xs">
                    📏 Within {analysisResults.searchRadius}m
                  </p>
                  <p className="text-green-700 text-xs">
                    🎯 {analysisResults.totalNearby} complaints found
                  </p>
                  {analysisResults.complaints?.length > 0 && (
                    <p className="text-green-600 text-xs mt-1">
                      🚶‍♂️ Closest: {(analysisResults.complaints[0].distance).toFixed(0)}m away
                    </p>
                  )}
                </div>
              )}
              
              {analysisResults.type === 'density' && (
                <div className="bg-orange-50 p-3 rounded border border-orange-200">
                  <p className="font-medium text-orange-900">🔥 Density Analysis</p>
                  <p className="text-orange-700 text-xs">Total Points: {analysisResults.totalPoints}</p>
                  <p className="text-orange-700 text-xs">
                    Density: {analysisResults.density?.toFixed(2)} per km²
                  </p>
                  {analysisResults.distanceFromUser && (
                    <p className="text-orange-600 text-xs mt-1">
                      📏 {(analysisResults.distanceFromUser / 1000).toFixed(1)}km from your location
                    </p>
                  )}
                </div>
              )}
              
              {analysisResults.type === 'hotspot' && (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <p className="font-medium text-red-900">🎯 Hotspot Analysis</p>
                  <p className="text-red-700 text-xs">
                    🔥 {analysisResults.totalHotspots} hotspots detected
                  </p>
                  {analysisResults.hotspots?.length > 0 && (
                    <p className="text-red-600 text-xs mt-1">
                      📊 Highest intensity: {(analysisResults.hotspots[0].intensity * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              )}
              
              <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                ⏰ {new Date(analysisResults.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Enhanced Loading indicator with progress */}
      {isAnalysisInProgress && (
        <div className="absolute top-20 left-4 bg-white p-4 rounded-lg shadow-lg z-[1000] border border-blue-200 min-w-[250px]">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">Running spatial analysis...</div>
              <div className="text-xs text-blue-600 mt-1">
                {userLocation ? '📍 Including location context' : '🗺️ Processing spatial data'}
              </div>
              {drawnShapes.length > 0 && (
                <div className="text-xs text-blue-500 mt-0.5">
                  📐 Analyzing {drawnShapes.length} drawn shape{drawnShapes.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Heat Map Legend */}
      {showHeatMap && complaints.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] heat-map-legend">
          <div className="legend-title">🔥 Complaint Heat Map</div>
          <div className="legend-scale">
            <div className="legend-color" style={{background: 'linear-gradient(to right, blue, cyan, lime, yellow, red)'}}></div>
            <span>Low → High Density</span>
          </div>
          <div style={{fontSize: '10px', color: '#6b7280', marginTop: '4px'}}>
            Open complaints have higher intensity
          </div>
        </div>
      )}
      
      {/* Enhanced Drawing mode indicator with user guidance */}
      {drawingMode && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 text-blue-900 px-6 py-4 rounded-xl shadow-lg z-[1000] max-w-md">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <span className="text-2xl">
                {drawingMode === 'polygon' && '🔷'}
                {drawingMode === 'circle' && '⭕'}
                {drawingMode === 'rectangle' && '🔲'}
                {drawingMode === 'marker' && '📍'}
                {drawingMode === 'buffer' && '🎯'}
              </span>
              <span className="font-bold text-lg">
                Drawing {drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1)}
              </span>
            </div>
            
            <div className="text-sm space-y-1">
              {drawingMode === 'polygon' && (
                <div>
                  <p className="font-medium">🖱️ Click to add points • Double-click to finish</p>
                  <p className="text-blue-700 text-xs">
                    💡 Tip: Draw around areas with high complaint density for detailed analysis
                  </p>
                </div>
              )}
              {drawingMode === 'circle' && (
                <div>
                  <p className="font-medium">🖱️ Click center • Drag to set radius • Release to finish</p>
                  <p className="text-blue-700 text-xs">
                    💡 Tip: Perfect for analyzing complaints within a specific distance
                  </p>
                </div>
              )}
              {drawingMode === 'rectangle' && (
                <div>
                  <p className="font-medium">🖱️ Click and drag to create rectangle</p>
                  <p className="text-blue-700 text-xs">
                    💡 Tip: Great for analyzing rectangular areas like city blocks
                  </p>
                </div>
              )}
              {drawingMode === 'marker' && (
                <div>
                  <p className="font-medium">🖱️ Click anywhere on the map to place marker</p>
                  <p className="text-blue-700 text-xs">
                    💡 Tip: Mark important locations for reference
                  </p>
                </div>
              )}
              
              {userLocation && drawingMode !== 'buffer' && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-blue-600 text-xs">
                    📍 Your location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-center space-x-2 mt-3">
              <button
                onClick={disableDrawingMode}
                className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
              >
                ❌ Cancel
              </button>
              {drawnShapes.length > 0 && (
                <button
                  onClick={() => {
                    if (drawnItemsRef.current) {
                      drawnItemsRef.current.clearLayers();
                      setDrawnShapes([]);
                      setAnalysisResults(null);
                    }
                  }}
                  className="px-3 py-1 bg-gray-500 text-white text-xs rounded-md hover:bg-gray-600 transition-colors"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

LeafletMapComponent.displayName = 'LeafletMapComponent';

export default LeafletMapComponent;
