import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Settings, X, Plus, Map, MapPin
} from 'lucide-react';

// Import components
import LeafletMapComponent from '../components/map/LeafletMapComponent';
import SidebarComponent from '../components/sidebar/SidebarComponent';
import MapControls from '../components/map/MapControls';
import NearbyComplaintsPanel from '../components/map/NearbyComplaintsPanel';
import DrawingInstructions from '../components/map/DrawingInstructions';
import * as turf from '@turf/turf';
import { parseLocation } from '../utils/locationFormatter';
import { canAccessAnalysisTools, canAccessDrawingTools } from '../utils/userPermissions';
import { 
  isWithinAllowedArea, 
  validateComplaintLocation, 
  getServiceAreaCenter, 
  getServiceAreaBounds,
  enforceLocationGeofencing 
} from '../utils/geofencing';
import '../styles/map-custom.css';
import '../styles/leaflet-custom.css';
import { getCachedLocationName } from '../utils/locationUtils';

// Add this function to get user location
const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by your browser');
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Error getting user location:', error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};

const MapScreen = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);

  // State management
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('complaints');
  const [showControls, setShowControls] = useState(true);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [nearbyComplaintsInfo, setNearbyComplaintsInfo] = useState(null);
  
  // Location tracking state
  const [isLocationTracking, setIsLocationTracking] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [nearbyRadius, setNearbyRadius] = useState(1000);

  // Handle complaint details view
  const handleViewComplaintDetails = useCallback((complaintId) => {
    navigate(`/complaint/${complaintId}`);
  }, [navigate]);

  // Add event listener for complaint popup view details
  useEffect(() => {
    const handleComplaintDetailsEvent = (event) => {
      if (event.detail && event.detail.id) {
        handleViewComplaintDetails(event.detail.id);
      }
    };

    window.addEventListener('viewComplaintDetails', handleComplaintDetailsEvent);
    
    return () => {
      window.removeEventListener('viewComplaintDetails', handleComplaintDetailsEvent);
    };
  }, [handleViewComplaintDetails]); // meters
  
  // Analysis state
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalysisInProgress, setIsAnalysisInProgress] = useState(false);
  const [showBufferControl, setShowBufferControl] = useState(false);

  // Map configuration options
  const [mapConfig, setMapConfig] = useState({
    style: 'mapbox://styles/mapbox/streets-v11',
    center: {
      lat: 33.6, // Default to service area center (RWP/ISB)
      lng: 73.1  // Default to service area center (RWP/ISB)
    },
    zoom: 12,
    showHeatmap: false,
    showClusters: true, // Default to showing clusters
    showBuffers: false,
    drawingMode: null,
    bufferDistance: 500, // meters
    filterCategory: '',
    filterStatus: '',
    filterDateRange: null,
    baseLayerType: 'streets',
    prevBaseLayerType: 'streets',
    showBoundaries: false,
    showAnalysis: false // Add this to track analysis state
  });

  // Add state to track drawing instructions
  const [drawingState, setDrawingState] = useState({
    active: false,
    mode: null,
    instructions: ''
  });

  // Capture map reference when it's ready
  const handleMapReady = (mapInstance) => {
    mapRef.current = mapInstance;
  };

  // Location tracking handlers
  const handleStartLocationTracking = useCallback(() => {
    if (mapRef.current?.startLocationTracking) {
      mapRef.current.startLocationTracking();
      setIsLocationTracking(true);
    }
  }, []);

  const handleStopLocationTracking = useCallback(() => {
    if (mapRef.current?.stopLocationTracking) {
      mapRef.current.stopLocationTracking();
      setIsLocationTracking(false);
      setUserLocation(null);
      setNearbyComplaints([]);
    }
  }, []);

  const handleCenterOnUser = useCallback(() => {
    if (mapRef.current?.centerMapOnUser) {
      mapRef.current.centerMapOnUser();
    }
  }, []);

  const handleNearbyComplaintsUpdate = useCallback((nearby) => {
    setNearbyComplaints(nearby);
  }, []);

  const handleUserLocationUpdate = useCallback((location) => {
    setUserLocation(location);
  }, []);

  // Analysis and drawing handlers
  const handleAnalysisResults = useCallback((results) => {
    setAnalysisResults(results);
    setIsAnalysisInProgress(false);
  }, []);

  const handleClearAnalysis = useCallback(() => {
    setAnalysisResults(null);
    setIsAnalysisInProgress(false);
    
    // Clear drawn items from map
    if (mapRef.current?.drawnItemsRef?.current) {
      mapRef.current.drawnItemsRef.current.clearLayers();
    }
  }, []);

  const userHasAnalysisAccess = useCallback(() => {
    // Only allow admins to access drawing tools and spatial analysis
    return canAccessAnalysisTools(user);
  }, [user]);

  const userHasDrawingAccess = useCallback(() => {
    // Only allow admins to access drawing tools
    return canAccessDrawingTools(user);
  }, [user]);

  const toggleDrawingMode = useCallback((mode) => {
    // Check if user has permission for drawing tools
    if (mode !== null && !userHasDrawingAccess()) {
      alert('You do not have permission to use drawing tools. Only administrators can access spatial analysis features.');
      return;
    }
    
    console.log(`Toggling drawing mode: ${mode}`);
    
    // Make sure the map ref exists
    if (!mapRef.current) {
      console.error("Map reference not available");
      return;
    }
    
    try {
      // Update drawing state first
      if (mode === null) {
        setDrawingState({
          active: false,
          mode: null,
          instructions: ''
        });
        setMapConfig(prev => ({ ...prev, drawingMode: null }));
        
        // Disable drawing on map
        if (mapRef.current.disableDrawingMode) {
          mapRef.current.disableDrawingMode();
        }
        return;
      }
      
      // Set drawing instructions
      let instructions = '';
      switch (mode) {
        case 'polygon':
          instructions = 'Click on the map to place points. Double-click to complete the polygon.';
          break;
        case 'circle':
          instructions = 'Click and drag to create a circle for radius analysis.';
          break;
        case 'rectangle':
          instructions = 'Click and drag to create a rectangle for area analysis.';
          break;
        case 'marker':
          instructions = 'Click anywhere on the map to place a marker.';
          break;
        default:
          instructions = `Drawing ${mode} mode active`;
      }
      
      // Update drawing state
      setDrawingState({
        active: true,
        mode,
        instructions
      });
      
      // Update config
      setMapConfig(prev => ({ ...prev, drawingMode: mode }));
      
      // Enable drawing mode on map
      if (mapRef.current.enableDrawingMode) {
        mapRef.current.enableDrawingMode(mode);
        console.log(`Drawing mode ${mode} activated on map`);
      } else {
        console.error("Map reference doesn't have enableDrawingMode method");
      }
    } catch (error) {
      console.error("Error toggling drawing mode:", error);
      setDrawingState({
        active: false,
        mode: null,
        instructions: ''
      });
    }
  }, [userHasDrawingAccess]);

  // Enhanced version of toggleDrawingMode with additional features
  const enhancedToggleDrawingMode = useCallback((mode) => {
    if (mode !== null && !userHasDrawingAccess()) {
      alert('You do not have permission to use drawing tools. Only administrators can access spatial analysis features.');
      return;
    }
    
    // Use the existing toggleDrawingMode function
    toggleDrawingMode(mode);
    
    // Additional enhancements for buffer control
    if (mode === 'circle' || mode === 'polygon') {
      // Show buffer control panel for these modes
      setShowBufferControl(true);
    } else {
      setShowBufferControl(false);
    }
  }, [toggleDrawingMode, userHasDrawingAccess]);

  const runSpatialAnalysis = useCallback((analysisType) => {
    if (!userHasAnalysisAccess()) {
      alert('You do not have permission to use spatial analysis tools. Only administrators can access these features.');
      return;
    }

    if (!mapRef.current) {
      alert('Map not fully initialized yet. Please try again in a moment.');
      return;
    }
    
    try {
      switch (analysisType) {
        case 'countPoints':
          if (mapRef.current.countPointsInPolygon) {
            const count = mapRef.current.countPointsInPolygon();
            if (count !== undefined) {
              // Update map config to show analysis
              setMapConfig(prev => ({
                ...prev,
                showAnalysis: true
              }));
              console.log(`Analysis found ${count} complaints in the selected area`);
            }
          } else {
            throw new Error('Count points analysis method not available');
          }
          break;
          
        case 'averageDistance':
          if (mapRef.current.calculateAverageDistance) {
            const averageDist = mapRef.current.calculateAverageDistance();
            if (averageDist !== undefined) {
              // Update map config to show analysis
              setMapConfig(prev => ({
                ...prev,
                showAnalysis: true
              }));
              console.log(`Average distance between complaints: ${averageDist.toFixed(2)} km`);
            }
          } else {
            throw new Error('Distance analysis method not available');
          }
          break;
          
        case 'density':
          if (mapRef.current.calculateDensity) {
            const results = mapRef.current.calculateDensity();
            if (results) {
              // Enable heatmap to show density
              setMapConfig(prev => ({
                ...prev,
                showHeatmap: true,
                showAnalysis: true
              }));
            }
          } else {
            throw new Error('Density analysis method not available');
          }
          break;
          
        case 'buffer':
          // Create buffer with default distance
          if (mapRef.current?.createBuffer) {
            mapRef.current.createBuffer(500); // 500m default
          }
          break;
          
        case 'clearAnalysis':
          if (mapRef.current?.clearAnalysisLayers) {
            mapRef.current.clearAnalysisLayers();
            setMapConfig(prev => ({
              ...prev,
              showAnalysis: false
            }));
          }
          break;
          
        default:
          alert('Unknown analysis type: ' + analysisType);
      }
    } catch (err) {
      console.error('Error running spatial analysis:', err);
      alert('Error running analysis: ' + (err.message || 'Please try again.'));
    }
  }, [userHasAnalysisAccess]);

  const enhancedRunSpatialAnalysis = useCallback(async (type, params = {}) => {
    setIsAnalysisInProgress(true);
    
    try {
      // Use map reference to run analysis
      if (mapRef.current?.runSpatialAnalysis) {
        const results = await mapRef.current.runSpatialAnalysis(type, params);
        setAnalysisResults(results);
      } else if (runSpatialAnalysis) {
        await runSpatialAnalysis(type, params);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalysisInProgress(false);
    }
  }, [runSpatialAnalysis]);

  const handleNearbyRadiusChange = useCallback((radius) => {
    setNearbyRadius(radius);
    if (mapRef.current?.setNearbyRadius) {
      mapRef.current.setNearbyRadius(radius);
    }
  }, []);

  // Helper function to calculate distance between two points
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }, []);

  useEffect(() => {
    // Get user location when the component mounts with geofencing
    const setInitialLocation = async () => {
      try {
        const location = await getUserLocation();
        console.log('Got user location:', location);
        
        // Check if user location is within allowed area (RWP/ISB)
        const geofenceResult = enforceLocationGeofencing(location);
        
        if (!geofenceResult.allowed) {
          console.warn('User location outside service area:', geofenceResult.message);
          
          // Use service area center as fallback
          const serviceCenter = getServiceAreaCenter();
          const fallbackLocation = {
            latitude: serviceCenter[1],
            longitude: serviceCenter[0]
          };
          
          // Show user a notification about geofencing
          if (geofenceResult.code === 'OUTSIDE_SERVICE_AREA') {
            alert(`${geofenceResult.message}\n\nMap will be centered on the service area (Rawalpindi/Islamabad).`);
          }
          
          // Update map configuration with service area center
          setMapConfig(prevConfig => ({
            ...prevConfig,
            center: {
              lat: fallbackLocation.latitude,
              lng: fallbackLocation.longitude
            }
          }));
          
          location.latitude = fallbackLocation.latitude;
          location.longitude = fallbackLocation.longitude;
        } else {
          console.log(`User location validated: ${geofenceResult.message}`);
          
          // Update map configuration with user's location
          setMapConfig(prevConfig => ({
            ...prevConfig,
            center: {
              lat: location.latitude,
              lng: location.longitude
            }
          }));
        }
        
        // If map is already loaded, center it on the location
        if (mapRef.current && mapLoaded && location) {
          try {
            // Use the proper flyTo method for Leaflet (latitude first, then longitude)
            if (mapRef.current.flyTo) {
              mapRef.current.flyTo(location.latitude, location.longitude, 14);
              console.log('Map centered on validated location');
            } else if (mapRef.current.setView) {
              mapRef.current.setView([location.latitude, location.longitude], 14);
              console.log('Map view set to validated location');
            }
          } catch (error) {
            console.error('Error centering map on location:', error);
          }
        }
      } catch (error) {
        console.warn('Could not get user location, using service area center:', error);
        
        // Use service area center as fallback
        const serviceCenter = getServiceAreaCenter();
        const fallbackLocation = {
          latitude: serviceCenter[1],
          longitude: serviceCenter[0]
        };
        
        setMapConfig(prevConfig => ({
          ...prevConfig,
          center: {
            lat: fallbackLocation.latitude,
            lng: fallbackLocation.longitude
          }
        }));
      }
    };
    
    setInitialLocation();
  }, [mapLoaded]); // Only run when mapLoaded changes to true

useEffect(() => {
  // Check if we have the map reference and complaints with location names
  if (mapRef.current && complaints.length > 0 && mapLoaded) {
    // Check if there's been a change in location names
    const locationNamesLoaded = complaints.some(c => c.locationName && !c.needsLocationName);
    
    if (locationNamesLoaded) {
      // Update the map with the new data including location names
      console.log('Updating map with location names');
      mapRef.current.updateMapData(complaints);
    }
  }
}, [complaints, mapLoaded]);
  // Fetch data on component mount
// In your useEffect that fetches user and data
useEffect(() => {
  const fetchUserAndData = async () => {
    try {
      setLoading(true);
      // Get the current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        navigate('/');
        return;
      }

      // Fetch user details with role information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name, permissions),
          departments (id, name, jurisdiction)
        `)
        .eq('id', authUser.id)
        .single();

      if (userError) throw userError;
      
      setUser({ ...authUser, ...userData });

      // Now fetch categories and complaints
      await fetchCategories();
      await fetchComplaints(userData); // Pass the userData to fetchComplaints
      
      // Fetch department boundaries if user is admin
      if (userData?.roles?.name === 'Super Admin' || userData?.roles?.name === 'Department Admin') {
        await fetchDepartmentBoundaries(userData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchUserAndData();
}, [navigate]);

// Add a separate effect to refetch complaints periodically or when needed
useEffect(() => {
  if (user && !loading) {
    // Set up an interval to refetch complaints every 30 seconds
    const intervalId = setInterval(() => {
      console.log('Refreshing complaints data...');
      fetchComplaints(user);
    }, 30000);

    return () => clearInterval(intervalId);
  }
}, [user, loading]);
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };
// Fix the useEffect that updates map when location names are loaded
useEffect(() => {
  // Check if we have complaints with location names
  if (complaints.length > 0 && mapRef.current && mapLoaded) {
    // Check if there are complaints with location names
    const hasLocationNames = complaints.some(c => c.locationName);
    
    // Only update if we have location names to display
    if (hasLocationNames) {
      console.log('Location names loaded, updating map data');
      
      // For Leaflet, we need to update the markers directly
      try {
        if (mapRef.current && typeof mapRef.current.updateComplaintsData === 'function') {
          // Use the proper Leaflet update method
          mapRef.current.updateComplaintsData(complaints);
          console.log(`Updated Leaflet map with ${complaints.length} complaints`);
        } else {
          console.warn('updateComplaintsData method not available on map reference');
        }
      } catch (err) {
        console.error('Error updating map with location names:', err);
      }
    }
  }
}, [complaints, mapLoaded]);

// Helper function to get status color
const getStatusColor = (status) => {
  switch (status) {
    case 'open': return '#e74c3c';
    case 'in_progress': return '#f39c12';
    case 'resolved': return '#2ecc71';
    default: return '#95a5a6';
  }
};
  // Add this utility function to the MapScreen component
// Add this utility function to the MapScreen component
const ensureComplaintsHaveValidLocations = useCallback((complaintsToCheck) => {
  // Only run this if we have complaints and they don't all have valid locations
  if (!complaintsToCheck || complaintsToCheck.length === 0) return complaintsToCheck;
  
  const validLocationCount = complaintsToCheck.filter(c => 
    c.parsedLocation && c.coordinates && c.coordinates.length === 2
  ).length;
  
  if (validLocationCount === complaintsToCheck.length) {
    return complaintsToCheck; // All valid, no need for further processing
  }
  
  console.log(`Re-processing locations: ${validLocationCount}/${complaintsToCheck.length} are currently valid`);
  
  return complaintsToCheck.map(complaint => {
    // Skip if already has valid location
    if (complaint.parsedLocation && 
        complaint.coordinates && 
        complaint.coordinates.length === 2) {
      return complaint;
    }
    
    try {
      if (complaint.location) {
        // Special handling for PostGIS WKB hex format
        if (typeof complaint.location === 'string' && 
            complaint.location.startsWith('0101000020E6100000')) {
          
          // Parse the WKB hex string for EWKB format from PostGIS
          // Format: 0101000020E6100000[X COORDINATE (8 bytes)][Y COORDINATE (8 bytes)]
          try {
            const str = complaint.location;
            // Extract X and Y from specific positions in the string
            if (str.length >= 42) {
              // Get the two 8-byte double values after the header
              const xHex = str.substring(18, 34);
              const yHex = str.substring(34, 50);
              
              // Need to handle endianness by reversing byte order
              const getDoubleFromHex = (hex) => {
                // Group by byte pairs
                const bytes = [];
                for (let i = 0; i < hex.length; i += 2) {
                  bytes.push(parseInt(hex.substring(i, i + 2), 16));
                }
                
                // Create a buffer to read as a double
                const buffer = new ArrayBuffer(8);
                const view = new DataView(buffer);
                
                // PostGIS uses little-endian format
                for (let i = 0; i < 8; i++) {
                  view.setUint8(i, bytes[i]);
                }
                
                return view.getFloat64(0, true); // true = little endian
              };
              
              // The order is longitude, latitude in PostGIS
              const lng = getDoubleFromHex(xHex);
              const lat = getDoubleFromHex(yHex);
              
              // Validate coordinates
              if (!isNaN(lat) && !isNaN(lng) && 
                  Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                complaint.parsedLocation = { latitude: lat, longitude: lng };
                complaint.coordinates = [lng, lat]; // GeoJSON format [lng, lat]
                console.log(`Successfully parsed WKB hex for complaint ${complaint.id}: ${lat}, ${lng}`);
              }
            }
          } catch (wkbError) {
            console.error(`Error parsing WKB for complaint ${complaint.id}:`, wkbError);
          }
        } else {
          // Try standard location parsing approaches
          let parsedLocation = parseLocation(complaint.location);
          
          // Apply if valid
          if (parsedLocation && 
              parsedLocation.latitude && 
              parsedLocation.longitude &&
              !isNaN(parsedLocation.latitude) && 
              !isNaN(parsedLocation.longitude) &&
              Math.abs(parsedLocation.latitude) <= 90 &&
              Math.abs(parsedLocation.longitude) <= 180) {
              
            complaint.parsedLocation = parsedLocation;
            complaint.coordinates = [parsedLocation.longitude, parsedLocation.latitude];
          }
        }
      }
    } catch (error) {
      console.error(`Error re-parsing location for complaint ${complaint.id}:`, error);
    }
    return complaint;
  });
}, []);
const fetchComplaints = async (userData) => {
  try {
    // Start with loading state
    setLoading(true);
    console.log("Fetching complaints...");
    
    // Fetch complaints with categories and add reporter info if available
    let query = supabase
      .from('complaints')
      .select(`
        *,
        categories (*)
      `);

    // If user is Department Admin, filter complaints by their department
    if (userData?.roles?.name === 'Department Admin' && userData?.department_id) {
      query = query.eq('department_id', userData.department_id);
      console.log(`Filtering complaints for department ID: ${userData.department_id}`);
    }

    // Apply other filters if set
    if (mapConfig.filterCategory) {
      query = query.eq('category_id', mapConfig.filterCategory);
    }

    if (mapConfig.filterStatus) {
      query = query.eq('status', mapConfig.filterStatus);
    }

    if (mapConfig.filterDateRange) {
      const { startDate, endDate } = mapConfig.filterDateRange;
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error details:', error);
      throw error;
    }

    console.log(`Fetched ${data ? data.length : 0} complaints`);
    
    // Process the complaints to add parsed location with multiple approaches
    const processedComplaints = data?.map(complaint => {
      try {
        // Process location with multiple methods for greater reliability
        let parsedLocation = null;
        
        // 1. First try direct parsing if location is a string
        if (typeof complaint.location === 'string') {
          // Special handling for PostGIS WKB hex format
          if (complaint.location.startsWith('0101000020E6100000')) {
            try {
              const str = complaint.location;
              // Extract X and Y from specific positions in the string
              if (str.length >= 42) {
                // Get the two 8-byte double values after the header
                const xHex = str.substring(18, 34);
                const yHex = str.substring(34, 50);
                
                // Need to handle endianness by reversing byte order
                const getDoubleFromHex = (hex) => {
                  // Group by byte pairs
                  const bytes = [];
                  for (let i = 0; i < hex.length; i += 2) {
                    bytes.push(parseInt(hex.substring(i, i + 2), 16));
                  }
                  
                  // Create a buffer to read as a double
                  const buffer = new ArrayBuffer(8);
                  const view = new DataView(buffer);
                  
                  // PostGIS uses little-endian format
                  for (let i = 0; i < 8; i++) {
                    view.setUint8(i, bytes[i]);
                  }
                  
                  return view.getFloat64(0, true); // true = little endian
                };
                
                // The order is longitude, latitude in PostGIS
                const lng = getDoubleFromHex(xHex);
                const lat = getDoubleFromHex(yHex);
                
                // Validate coordinates
                if (!isNaN(lat) && !isNaN(lng) && 
                    Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                  parsedLocation = { latitude: lat, longitude: lng };
                }
              }
            } catch (wkbError) {
              console.error(`Error parsing WKB for complaint ${complaint.id}:`, wkbError);
            }
          } else {
            // Other string formats...
            // Check for WKT format like: POINT(lng lat)
            const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)\s*\)/i);
            if (pointMatch && pointMatch.length >= 3) {
              const lng = parseFloat(pointMatch[1]);
              const lat = parseFloat(pointMatch[2]);
              
              if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                parsedLocation = { latitude: lat, longitude: lng };
              }
            } else {
              // Try to find any numbers in the string that might be coordinates
              const coordMatch = complaint.location.match(/[-+]?\d+\.\d+/g);
              if (coordMatch && coordMatch.length >= 2) {
                // Simple heuristic for lat/lng order
                let lat, lng;
                const first = parseFloat(coordMatch[0]);
                const second = parseFloat(coordMatch[1]);
                
                if (Math.abs(first) > 90) {
                  lng = first;
                  lat = second;
                } else {
                  lat = first;
                  lng = second;
                }
                
                if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                  parsedLocation = { latitude: lat, longitude: lng };
                }
              }
            }
          }
        } 
        // 2. Try if location is an object (GeoJSON format)
        else if (complaint.location && typeof complaint.location === 'object') {
          // Standard formats handling...
          if (complaint.location.type === 'Point' && 
              Array.isArray(complaint.location.coordinates) && 
              complaint.location.coordinates.length >= 2) {
            const [lng, lat] = complaint.location.coordinates;
            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
              parsedLocation = { latitude: lat, longitude: lng };
            }
          } else if ((complaint.location.latitude !== undefined || complaint.location.lat !== undefined) &&
                     (complaint.location.longitude !== undefined || complaint.location.lng !== undefined)) {
            const lat = complaint.location.latitude !== undefined ? 
              complaint.location.latitude : complaint.location.lat;
            const lng = complaint.location.longitude !== undefined ? 
              complaint.location.longitude : complaint.location.lng;
              
            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
              parsedLocation = { latitude: lat, longitude: lng };
            }
          }
        }
        
        // If we still don't have a valid location, try using the parseLocation utility
        if (!parsedLocation && complaint.location) {
          parsedLocation = parseLocation(complaint.location);
        }
        
        // Apply the parsed location if valid and within service area
        if (parsedLocation && 
            parsedLocation.latitude !== undefined && 
            parsedLocation.longitude !== undefined &&
            !isNaN(parsedLocation.latitude) && 
            !isNaN(parsedLocation.longitude) &&
            Math.abs(parsedLocation.latitude) <= 90 &&
            Math.abs(parsedLocation.longitude) <= 180) {
            
          // Check if location is within allowed service area (RWP/ISB)
          // For demo purposes, we'll be more flexible with the geofencing
          const withinServiceArea = isWithinAllowedArea(parsedLocation.longitude, parsedLocation.latitude);
          
          if (withinServiceArea) {
            complaint.parsedLocation = parsedLocation;
            // Store coordinates in GeoJSON format [longitude, latitude]
            complaint.coordinates = [parsedLocation.longitude, parsedLocation.latitude];
            
            // Mark that we need to fetch a location name
            complaint.needsLocationName = true;
            
            // Add service area validation flag
            complaint.withinServiceArea = true;
          } else {
            // For demo purposes, still show the complaint but flag it
            console.warn(`Complaint ${complaint.id} is outside service area:`, parsedLocation);
            complaint.parsedLocation = parsedLocation; // Still include it
            complaint.coordinates = [parsedLocation.longitude, parsedLocation.latitude]; // Still include coordinates
            complaint.withinServiceArea = false;
            complaint.locationNote = 'Outside service area (RWP/ISB)';
            complaint.needsLocationName = true; // Still try to get location name
          }
        } else {
          complaint.parsedLocation = null;
          complaint.coordinates = null;
          complaint.withinServiceArea = false;
        }
        
        // Handle reporter information
        if (complaint.anonymous) {
          complaint.reported_by_name = 'Anonymous User';
        } else if (complaint.reported_by) {
          // Just ensure we have a consistent format
          if (!complaint.reported_by_name) {
            complaint.reported_by_name = `User #${complaint.reported_by}`;
          }
        }
        
      } catch (error) {
        console.error(`Error parsing location for complaint ${complaint.id}:`, error);
        complaint.parsedLocation = null;
        complaint.coordinates = null;
      }
      return complaint;
    }) || [];

    const validLocations = processedComplaints.filter(c => 
      c.parsedLocation && c.coordinates && c.coordinates.length === 2
    ).length;
    
    console.log(`Successfully parsed locations: ${validLocations}/${processedComplaints.length}`);
    
    // Debug: Log a sample complaint to see structure
    if (processedComplaints.length > 0) {
      console.log('Sample complaint structure:', processedComplaints[0]);
      console.log('Sample complaint coordinates:', processedComplaints[0].coordinates);
      console.log('Sample complaint parsedLocation:', processedComplaints[0].parsedLocation);
    }

    // Set complaints (include all for demo purposes, but flag those outside service area)
    const validComplaints = processedComplaints.filter(complaint => 
      complaint.parsedLocation && complaint.coordinates && complaint.coordinates.length === 2
    );
    const outsideServiceAreaCount = processedComplaints.filter(c => c.withinServiceArea === false).length;
    
    if (outsideServiceAreaCount > 0) {
      console.log(`${outsideServiceAreaCount} complaints outside service area (RWP/ISB) - showing with warning`);
    }
    
    setComplaints(validComplaints);
    
    // Then start fetching location names in the background
    fetchLocationNames(validComplaints);
    
  } catch (error) {
    console.error('Error fetching complaints:', error);
  } finally {
    setLoading(false);
  }
};

// Add this helper function for fetching location names
// Updated fetchLocationNames function with better error handling
const fetchLocationNames = async (complaintsList) => {
  if (!complaintsList || complaintsList.length === 0) return;
  
  // Process in smaller batches to avoid too many simultaneous API calls
  const batchSize = 3;
  const validComplaints = complaintsList.filter(c => 
    c.coordinates && 
    c.coordinates.length === 2 && 
    (!c.locationName || c.locationName === 'Loading location...')
  );
  
  console.log(`Fetching location names for ${validComplaints.length} complaints`);
  
  // Process in batches
  for (let i = 0; i < validComplaints.length; i += batchSize) {
    try {
      const batch = validComplaints.slice(i, i + batchSize);
      
      // Process this batch in parallel
      const promises = batch.map(async (complaint) => {
        try {
          if (!complaint.coordinates || complaint.coordinates.length !== 2) {
            return { id: complaint.id, locationName: 'Invalid coordinates' };
          }
          
          const [lng, lat] = complaint.coordinates;
          let locationName = await getCachedLocationName(lng, lat);
          
          // If we couldn't get a detailed location name, try to get at least city-level info
          if (!locationName) {
            try {
              // Simple reverse geocoding for city-level information using Nominatim
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
                {
                  headers: {
                    'User-Agent': 'ComplaintManagementSystem/1.0'
                  }
                }
              );
              
              if (response.ok) {
                const data = await response.json();
                
                // Extract city or general location name
                if (data && data.address) {
                  const address = data.address;
                  locationName = address.city || address.town || address.village || 
                               address.suburb || address.neighbourhood || 
                               data.display_name;
                  console.log(`Found general location for complaint ${complaint.id}: ${locationName}`);
                }
              }
            } catch (geocodeError) {
              console.warn(`Couldn't get general location for complaint ${complaint.id}:`, geocodeError);
            }
          }
          
          // If we still don't have a location name, fall back to coordinates
          return { 
            id: complaint.id, 
            locationName: locationName || `General area near ${lat.toFixed(4)}, ${lng.toFixed(4)}`
          };
        } catch (error) {
          console.error(`Error fetching location name for complaint ${complaint.id}:`, error);
          
          // Try to extract coordinates from complaint to provide some location context
          const coords = complaint.coordinates || [];
          const locationText = coords.length === 2 ? 
            `General area near ${coords[1]?.toFixed(4) || '?'}, ${coords[0]?.toFixed(4) || '?'}` : 
            'Unknown location';
            
          return { 
            id: complaint.id, 
            locationName: locationText
          };
        }
      });
      
      // Wait for all in this batch to complete
      const results = await Promise.all(promises);
      
      // Update complaints in state with new location names
      setComplaints(prevComplaints => {
        const updatedComplaints = [...prevComplaints];
        
        // Update each complaint with its location name
        results.forEach(result => {
          if (result) {
            const index = updatedComplaints.findIndex(c => c.id === result.id);
            if (index !== -1) {
              updatedComplaints[index] = {
                ...updatedComplaints[index],
                locationName: result.locationName
              };
            }
          }
        });
        
        return updatedComplaints;
      });
      
      // Small delay to avoid rate limiting
      if (i + batchSize < validComplaints.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      console.error('Error processing location batch:', error);
      // Continue with next batch despite errors
    }
  }
};
// Fix the nearby complaints functionality
const showNearbyComplaints = useCallback(async (radius = 1000) => {
  if (!mapRef.current) {
    alert('Map not fully initialized yet. Please try again in a moment.');
    return;
  }

  try {
    setLoading(true);
    
    // Get the map center using the proper Leaflet method
    let center;
    
    if (typeof mapRef.current.getCenter === 'function') {
      // Direct method on ref
      center = mapRef.current.getCenter();
    } else if (mapRef.current.getMap && typeof mapRef.current.getMap === 'function') {
      // Get from underlying Leaflet map
      const mapInstance = mapRef.current.getMap();
      if (mapInstance && typeof mapInstance.getCenter === 'function') {
        center = mapInstance.getCenter();
      }
    }
    
    // Validate center coordinates
    if (!center || isNaN(center.lng) || isNaN(center.lat)) {
      console.error('Invalid map center:', center);
      throw new Error('Could not get valid map coordinates');
    }
    
    console.log(`Finding complaints near ${center.lng}, ${center.lat} with radius ${radius}m`);
    
    // Filter complaints by distance using Turf.js
    const centerPoint = turf.point([center.lng, center.lat]);
    
    // First ensure all complaints have valid locations
    const validComplaints = complaints.filter(complaint => 
      complaint.coordinates && 
      Array.isArray(complaint.coordinates) && 
      complaint.coordinates.length === 2 &&
      !isNaN(complaint.coordinates[0]) && 
      !isNaN(complaint.coordinates[1])
    );
    
    console.log(`Found ${validComplaints.length} complaints with valid coordinates out of ${complaints.length} total`);
    
    // Then filter by distance
    const nearbyComplaints = validComplaints.filter(complaint => {
      try {
        const complaintPoint = turf.point(complaint.coordinates);
        const distance = turf.distance(centerPoint, complaintPoint, {units: 'meters'});
        return distance <= radius;
      } catch (err) {
        console.warn(`Error calculating distance for complaint ${complaint.id}:`, err);
        return false;
      }
    });
    
    console.log(`Found ${nearbyComplaints.length} nearby complaints within ${radius}m radius`);
    
    // Show nearby complaints panel
    setNearbyComplaintsInfo({
      count: nearbyComplaints.length,
      radius,
      complaints: nearbyComplaints
    });
    
    // Try to focus map with proper error handling for Leaflet
    try {
      if (mapRef.current) {
        // Use Leaflet's flyTo method with proper parameters
        if (typeof mapRef.current.flyTo === 'function') {
          mapRef.current.flyTo(center.lng, center.lat, 14);
        } else if (mapRef.current.getMap && typeof mapRef.current.getMap === 'function') {
          const map = mapRef.current.getMap();
          if (map && typeof map.flyTo === 'function') {
            map.flyTo([center.lat, center.lng], 14, { duration: 1 });
          } else if (map && typeof map.setView === 'function') {
            map.setView([center.lat, center.lng], 14);
          }
        }
      }
    } catch (flyError) {
      console.warn('Error navigating map:', flyError);
      // Continue without navigation - this isn't a critical failure
    }
    
  } catch (error) {
    console.error('Error finding nearby complaints:', error);
    alert('Error finding nearby complaints. Please try again.');
  } finally {
    setLoading(false);
  }
}, [complaints]);
  const fetchDepartmentBoundaries = async (userData) => {
    try {
      let query = supabase
        .from('departments')
        .select('id, name, jurisdiction');
      
      // If department admin, only show their department
      if (userData?.roles?.name === 'Department Admin' && userData?.department_id) {
        query = query.eq('id', userData.department_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching department boundaries:', error);
    }
  };

  // Handler functions for map interactions
  const handleApplyFilters = useCallback((filters) => {
    setMapConfig(prev => ({ ...prev, ...filters }));
    fetchComplaints({...user, roles: user.roles});
  }, [user]);

  const toggleBaseMapStyle = useCallback((baseType) => {
    setMapConfig(prev => ({ 
      ...prev, 
      baseLayerType: baseType,
      prevBaseLayerType: prev.baseLayerType
    }));
  }, []);

  const toggleMapLayer = useCallback((layerType) => {
    setMapConfig(prev => {
      switch (layerType) {
        case 'heatmap':
          return { ...prev, showHeatmap: !prev.showHeatmap };
        case 'clusters':
          return { ...prev, showClusters: !prev.showClusters };
        case 'buffers':
          return { ...prev, showBuffers: !prev.showBuffers };
        case 'boundaries':
          return { ...prev, showBoundaries: !prev.showBoundaries };
        default:
          return prev;
      }
    });
  }, []);

  const createBuffer = useCallback((distance) => {
    // This needs the mapRef to be set
    if (!mapRef.current) {
      alert('Map not fully initialized yet. Please try again in a moment.');
      return;
    }
    
    if (!mapRef.current.createBuffer) {
      console.error('Error: createBuffer method not found on map reference');
      alert('Buffer analysis tool is not available. Please refresh the page and try again.');
      return;
    }
    
    try {
      mapRef.current.createBuffer(distance);
      setShowBufferControl(false); // Close buffer control after creating buffer
    } catch (err) {
      console.error('Error creating buffer:', err);
      alert('Error creating buffer: ' + (err.message || 'Please select a feature on the map first'));
    }
  }, []);

  const handleReportNewComplaint = useCallback(() => {
    // Store map center in localStorage for the report form
    if (mapRef.current && mapRef.current.getCenter) {
      const center = mapRef.current.getCenter();
      localStorage.setItem('reportLocation', JSON.stringify({
        lng: center.lng,
        lat: center.lat
      }));
    }
    navigate('/report-complaint');
  }, [navigate]);



useEffect(() => {
  // Set up custom event listener for complaint selection with improved handling
  const handleSelectComplaint = (event) => {
    try {
      const { complaint } = event.detail;
      if (complaint) {
        console.log('Selected complaint:', complaint.id, complaint.title);
        
        setSelectedComplaint(complaint);
        
        // If we have coordinates, center the map on the complaint
        if (complaint.coordinates && 
            complaint.coordinates.length === 2 && 
            !isNaN(complaint.coordinates[0]) && 
            !isNaN(complaint.coordinates[1]) && 
            mapRef.current) {
          
          // For Leaflet, coordinates are [lng, lat] but we need [lat, lng]
          const [lng, lat] = complaint.coordinates;
          
          try {
            // Use Leaflet's flyTo method with proper coordinate order
            if (mapRef.current.flyTo) {
              mapRef.current.flyTo(lng, lat, 15);
            } 
            // Fallback to setView if flyTo is not available
            else if (mapRef.current.setView) {
              mapRef.current.setView([lat, lng], 15);
            }
            // Last resort - access the underlying Leaflet map instance
            else if (mapRef.current.getMap) {
              const mapInstance = mapRef.current.getMap();
              if (mapInstance && mapInstance.flyTo) {
                mapInstance.flyTo([lat, lng], 15, { duration: 1 });
              }
            }
          } catch (flyError) {
            console.warn('Could not fly to complaint location:', flyError);
          }
        } else {
          console.warn('Cannot center on complaint - missing valid coordinates:', complaint.id);
        }
      }
    } catch (error) {
      console.error('Error handling complaint selection:', error);
    }
  };

  window.addEventListener('selectComplaint', handleSelectComplaint);
  
  return () => {
    window.removeEventListener('selectComplaint', handleSelectComplaint);
  };
}, []);
  useEffect(() => {
    if (complaints.length > 0) {
      const updatedComplaints = ensureComplaintsHaveValidLocations(complaints);
      
      // Only update state if we actually fixed some locations
      const newValidCount = updatedComplaints.filter(c => 
        c.parsedLocation && c.coordinates && c.coordinates.length === 2
      ).length;
      
      const oldValidCount = complaints.filter(c => 
        c.parsedLocation && c.coordinates && c.coordinates.length === 2
      ).length;
      
      if (newValidCount > oldValidCount) {
        console.log(`Fixed locations: ${oldValidCount} → ${newValidCount}`);
        setComplaints(updatedComplaints);
      }
    }
  }, [complaints, ensureComplaintsHaveValidLocations]);

  // Add the missing handleDrawingComplete function to handle drawing completion events
  const handleDrawingComplete = useCallback((drawingData) => {
    console.log('Drawing completed:', drawingData);
    
    // Update drawing state
    setDrawingState(prev => ({
      ...prev,
      active: false,
      mode: null,
      instructions: ''
    }));
    
    // Trigger analysis if auto-analyze is enabled
    if (mapConfig.autoAnalyze && drawingData.shape) {
      setIsAnalysisInProgress(true);
      
      // The analysis will be handled by the map component
      // Results will come back through handleAnalysisResults
    }
  }, [mapConfig.autoAnalyze]);

  // Handle quick actions from MapControls
  const handleQuickAction = useCallback(async (action, params = {}) => {
    try {
      switch (action) {
        case 'centerOnUser':
          if (userLocation && mapRef.current?.setView) {
            mapRef.current.setView([userLocation.lat, userLocation.lng], 16);
          }
          break;
          
        case 'refreshLocation':
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const newLocation = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                };
                setUserLocation(newLocation);
                if (mapRef.current?.setView) {
                  mapRef.current.setView([newLocation.lat, newLocation.lng], 16);
                }
              },
              (error) => {
                console.error('Error getting location:', error);
                alert('Could not get your current location. Please check location permissions.');
              }
            );
          }
          break;
          
        case 'nearbyAnalysis':
          if (userLocation && params.radius) {
            await enhancedRunSpatialAnalysis('nearby', {
              center: userLocation,
              radius: params.radius
            });
          }
          break;
          
        case 'bufferAnalysis':
          if (userLocation && params.distance) {
            await enhancedRunSpatialAnalysis('buffer', {
              center: userLocation,
              distance: params.distance
            });
          }
          break;
          
        case 'toggleHeatMap':
          // Toggle heat map visualization
          if (mapRef.current?.toggleHeatMap) {
            mapRef.current.toggleHeatMap();
          }
          break;
          
        case 'clearAll':
          // Clear all drawn items and analysis results
          if (mapRef.current?.drawnItemsRef?.current) {
            mapRef.current.drawnItemsRef.current.clearLayers();
          }
          handleClearAnalysis();
          break;
          
        default:
          console.warn(`Unknown quick action: ${action}`);
      }
    } catch (error) {
      console.error(`Error handling quick action ${action}:`, error);
      throw error;
    }
  }, [userLocation, enhancedRunSpatialAnalysis, handleClearAnalysis]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-800">Interactive Map</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 border rounded-md hover:bg-gray-100"
            title={showControls ? "Hide controls" : "Show controls"}
          >
            {showControls ? <X className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
          </button>
          <button
            onClick={handleReportNewComplaint}
            className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" /> Report Issue
          </button>
          <button
            onClick={() => showNearbyComplaints()}
            className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center"
          >
            <Map className="h-4 w-4 mr-1" /> Nearby Complaints
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <SidebarComponent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            complaints={complaints}
            categories={categories}
            mapConfig={mapConfig}
            handleApplyFilters={handleApplyFilters}
            toggleMapLayer={toggleMapLayer}
            toggleBaseMapStyle={toggleBaseMapStyle}
            toggleDrawingMode={enhancedToggleDrawingMode}
            createBuffer={createBuffer}
            setMapConfig={setMapConfig}
            setSelectedComplaint={setSelectedComplaint}
            user={user}
            setSidebarOpen={setSidebarOpen}
            mapRef={mapRef}
            runSpatialAnalysis={enhancedRunSpatialAnalysis}
          />
        )}

        {/* Map container */}
        <div className="flex-1 relative">
          {/* Map */}
          <LeafletMapComponent
            ref={mapRef}
            mapConfig={mapConfig}
            setMapLoaded={setMapLoaded}
            complaints={complaints}
            setSelectedComplaint={setSelectedComplaint}
            user={user}
            departments={departments}
            onMapReady={handleMapReady}
            onNearbyComplaintsUpdate={handleNearbyComplaintsUpdate}
            onUserLocationUpdate={handleUserLocationUpdate}
            onAnalysisResults={handleAnalysisResults}
            onDrawingComplete={handleDrawingComplete}
            showAnalysisTools={userHasAnalysisAccess()}
            isAdmin={userHasAnalysisAccess()}
          />

          {/* Drawing instructions overlay */}
          <DrawingInstructions 
            isActive={drawingState.active}
            mode={drawingState.mode}
            instructions={drawingState.instructions}
          />

          {/* Buffer control panel */}
          {showBufferControl && (
            <div className="absolute top-20 left-4 z-[900] bg-white p-4 rounded-lg shadow-lg border max-w-xs">
              <h3 className="font-semibold text-gray-900 mb-3">Buffer Analysis</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buffer Distance (meters)
                  </label>
                  <input
                    type="number"
                    defaultValue={mapConfig.bufferDistance}
                    min="50"
                    max="5000"
                    step="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onBlur={(e) => {
                      const distance = parseInt(e.target.value);
                      if (distance >= 50 && distance <= 5000) {
                        createBuffer(distance);
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => createBuffer(mapConfig.bufferDistance)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Create Buffer
                  </button>
                  <button
                    onClick={() => setShowBufferControl(false)}
                    className="px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Map tools */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-[900] bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
              title="Open sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Floating controls - only visible when showControls is true */}
          {showControls && mapLoaded && (
            <div className="absolute bottom-4 right-4 z-[1000]">
              <MapControls
                userLocation={userLocation}
                mapRef={mapRef}
                onDrawingModeChange={enhancedToggleDrawingMode}
                onAnalysisRequest={enhancedRunSpatialAnalysis}
                onQuickAction={handleQuickAction}
                user={user}
              />
            </div>
          )}
          
          {/* Nearby complaints button for regular users */}
          {!userHasAnalysisAccess() && mapLoaded && (
            <div className="absolute bottom-20 right-6 z-[900]">
              <button
                onClick={() => showNearbyComplaints(1000)}
                title="Find complaints near me"
                className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
              >
                <MapPin className="h-5 w-5" />
              </button>
            </div>
          )}
          
          {/* Nearby complaints panel */}
          {nearbyComplaintsInfo && (
            <NearbyComplaintsPanel
              info={nearbyComplaintsInfo}
              onClose={() => setNearbyComplaintsInfo(null)}
            />
          )}

          {/* Live nearby complaints panel for location tracking */}
          {isLocationTracking && nearbyComplaints.length > 0 && (
            <div className="absolute bottom-4 left-4 z-[900] bg-white rounded-lg shadow-lg border max-w-sm">
              <div className="p-3 border-b bg-blue-50 rounded-t-lg">
                <h3 className="font-semibold text-sm text-blue-800">
                  Nearby Complaints ({nearbyComplaints.length})
                </h3>
                <p className="text-xs text-blue-600 truncate">Within {nearbyRadius}m of your location</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {nearbyComplaints.slice(0, 5).map((complaint) => {
                  const distance = userLocation ? Math.round(
                    calculateDistance(
                      userLocation.lat, userLocation.lng,
                      complaint.latitude, complaint.longitude
                    )
                  ) : null;
                  
                  return (
                    <div 
                      key={complaint.id} 
                      className="p-2 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedComplaint(complaint)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {complaint.title || 'Untitled'}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {complaint.category || 'General'}
                          </p>
                        </div>
                        {distance && (
                          <span className="text-xs text-blue-600 font-medium ml-2">
                            {distance}m
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {nearbyComplaints.length > 5 && (
                  <div className="p-2 text-center text-xs text-gray-500">
                    +{nearbyComplaints.length - 5} more nearby
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected complaint details - Enhanced */}
      {selectedComplaint && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg max-w-md z-[1100] overflow-hidden">
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <h3 className="font-semibold text-lg">Complaint Details</h3>
            <button
              onClick={() => setSelectedComplaint(null)}
              className="text-blue-100 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                selectedComplaint.status === 'open' ? 'bg-red-100 text-red-800' :
                selectedComplaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                selectedComplaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedComplaint.status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN'}
              </span>
              <span className="text-xs text-gray-500">#{selectedComplaint.id}</span>
            </div>

            {/* Title */}
            <div>
              <h4 className="font-semibold text-gray-900 text-lg leading-tight">
                {selectedComplaint.title || 'Untitled Complaint'}
              </h4>
            </div>

            {/* Details Grid */}
            <div className="space-y-2 text-sm">
              {selectedComplaint.categories?.name && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600 w-20">Category:</span>
                  <span className="text-gray-900">{selectedComplaint.categories.name}</span>
                </div>
              )}

              {selectedComplaint.priority && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600 w-20">Priority:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedComplaint.priority === 'high' || selectedComplaint.priority === 5 ? 'bg-red-100 text-red-700' :
                    selectedComplaint.priority === 'medium' || selectedComplaint.priority === 3 || selectedComplaint.priority === 4 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {typeof selectedComplaint.priority === 'string' ? 
                      selectedComplaint.priority.toUpperCase() : 
                      selectedComplaint.priority === 5 ? 'HIGH' :
                      selectedComplaint.priority === 4 ? 'HIGH' :
                      selectedComplaint.priority === 3 ? 'MEDIUM' :
                      selectedComplaint.priority === 2 ? 'LOW' :
                      selectedComplaint.priority === 1 ? 'LOW' :
                      `LEVEL ${selectedComplaint.priority}`
                    }
                  </span>
                </div>
              )}

              <div className="flex items-start gap-2">
                <span className="font-medium text-gray-600 w-20">Location:</span>
                <div className="flex-1">
                  <div className="text-gray-900">
                    {selectedComplaint.locationName || 'Loading location...'}
                  </div>
                  {selectedComplaint.coordinates && (
                    <div className="text-xs text-gray-500 mt-1">
                      {selectedComplaint.coordinates[1]?.toFixed(6)}, {selectedComplaint.coordinates[0]?.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600 w-20">Reporter:</span>
                <span className="text-gray-900">
                  {selectedComplaint.anonymous ? 'Anonymous User' : 
                   (selectedComplaint.reported_by_name || `User #${selectedComplaint.reported_by}`)}
                </span>
              </div>

              {selectedComplaint.created_at && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600 w-20">Created:</span>
                  <span className="text-gray-900">
                    {new Date(selectedComplaint.created_at).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedComplaint.updated_at && selectedComplaint.updated_at !== selectedComplaint.created_at && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600 w-20">Updated:</span>
                  <span className="text-gray-900">
                    {new Date(selectedComplaint.updated_at).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedComplaint.description && (
                <div className="pt-2 border-t">
                  <span className="font-medium text-gray-600 block mb-1">Description:</span>
                  <div className="text-gray-900 max-h-24 overflow-y-auto text-sm leading-relaxed">
                    {selectedComplaint.description}
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-3 border-t">
              <button
                onClick={() => handleViewComplaintDetails(selectedComplaint.id)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200"
              >
                View Full Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

export default MapScreen;