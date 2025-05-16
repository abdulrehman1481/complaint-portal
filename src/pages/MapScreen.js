import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, ChevronRight, Settings, X, Plus, Map, MapPin
} from 'lucide-react';

// Import components
import MapComponent from '../components/map/MapComponent';
import SidebarComponent from '../components/sidebar/SidebarComponent';
import MapControls from '../components/map/MapControls';
import ComplaintPopup from '../components/map/ComplaintPopup';
import DrawingInstructions from '../components/map/DrawingInstructions';
import BufferControl from '../components/map/BufferControl';
import NearbyComplaintsPanel from '../components/map/NearbyComplaintsPanel';
import * as turf from '@turf/turf';
import { parseLocation } from '../utils/locationFormatter';
import { canAccessAnalysisTools } from '../utils/userPermissions';
import '../styles/map-custom.css';
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
  const [showBufferControl, setShowBufferControl] = useState(false);
  const [nearbyComplaintsInfo, setNearbyComplaintsInfo] = useState(null);

  // Map configuration options
  const [mapConfig, setMapConfig] = useState({
    style: 'mapbox://styles/mapbox/streets-v11',
    latitude: 40.7128, // Default location (will be replaced with user location)
    longitude: -74.0060, // Default location (will be replaced with user location)
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

  useEffect(() => {
    // Get user location when the component mounts
    const setInitialLocation = async () => {
      try {
        const location = await getUserLocation();
        console.log('Got user location:', location);
        
        // Update map configuration with user's location
        setMapConfig(prevConfig => ({
          ...prevConfig,
          latitude: location.latitude,
          longitude: location.longitude
        }));
        
        // If map is already loaded, fly to the user's location
        if (mapRef.current && mapLoaded) {
          try {
            mapRef.current.flyTo(location.longitude, location.latitude, 14);
            console.log('Map centered on user location');
          } catch (error) {
            console.error('Error centering map on user location:', error);
          }
        }
      } catch (error) {
        console.warn('Could not get user location, using default:', error);
        // Continue with default coordinates
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
      
      // Make sure we update the map data in the MapComponent
      // We need to pass the complaints to any method that will update the GeoJSON source
      try {
        // Get the map source and update it directly
        const map = mapRef.current;
        if (map.updateMapData) {
          map.updateMapData(complaints);
        } else {
          // Fallback approach if the method isn't available
          // This accesses the map instance directly (not ideal but works as fallback)
          const mapInstance = map.getMap?.();
          if (mapInstance) {
            const source = mapInstance.getSource('complaints');
            if (source) {
              // Create GeoJSON features from complaints
              const features = complaints
                .filter(c => c.coordinates && c.coordinates.length === 2)
                .map(complaint => ({
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: complaint.coordinates
                  },
                  properties: {
                    id: complaint.id,
                    title: complaint.title || 'Untitled Complaint',
                    status: complaint.status || 'unknown',
                    category_id: complaint.category_id,
                    category_name: complaint.categories?.name || 'Uncategorized',
                    color: getStatusColor(complaint.status),
                    created_at: complaint.created_at || '',
                    reported_by_name: complaint.reported_by_name || 'Unknown User',
                    anonymous: complaint.anonymous ? 'true' : 'false',
                    location_name: complaint.locationName || 'Loading location...'
                  }
                }));
                
              // Update the GeoJSON source
              source.setData({
                type: 'FeatureCollection',
                features
              });
              console.log(`Updated map with ${features.length} features`);
            }
          }
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
        
        // Apply the parsed location if valid
        if (parsedLocation && 
            parsedLocation.latitude !== undefined && 
            parsedLocation.longitude !== undefined &&
            !isNaN(parsedLocation.latitude) && 
            !isNaN(parsedLocation.longitude) &&
            Math.abs(parsedLocation.latitude) <= 90 &&
            Math.abs(parsedLocation.longitude) <= 180) {
            
          complaint.parsedLocation = parsedLocation;
          // Store coordinates in GeoJSON format [longitude, latitude]
          complaint.coordinates = [parsedLocation.longitude, parsedLocation.latitude];
          
          // Mark that we need to fetch a location name
          complaint.needsLocationName = true;
        } else {
          complaint.parsedLocation = null;
          complaint.coordinates = null;
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

    // Set complaints first
    setComplaints(processedComplaints);
    
    // Then start fetching location names in the background
    fetchLocationNames(processedComplaints);
    
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
              // Simple reverse geocoding for city-level information
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&types=place,locality,neighborhood`
              );
              
              if (response.ok) {
                const data = await response.json();
                
                // Extract city or general location name
                if (data.features && data.features.length > 0) {
                  locationName = data.features[0].text || data.features[0].place_name;
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
    
    // Get the map instance and verify we can get the center
    let center;
    
    if (typeof mapRef.current.getCenter === 'function') {
      // Direct method on ref
      center = mapRef.current.getCenter();
    } else if (mapRef.current.getMap && typeof mapRef.current.getMap === 'function') {
      // Get from underlying map
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
    
    // Visualize the radius on the map using our buffer function
    if (typeof mapRef.current.enableDrawingMode === 'function') {
      try {
        mapRef.current.enableDrawingMode('point');
        
        // Wait for drawing mode to be active
        setTimeout(() => {
          // Try to get the underlying Draw instance
          if (mapRef.current && mapRef.current.getMap) {
            const map = mapRef.current.getMap();
            if (map) {
              // Try to create a point and buffer directly
              try {
                setTimeout(() => mapRef.current.createBuffer(radius), 300);
              } catch (bufferErr) {
                console.warn('Error creating buffer visualization:', bufferErr);
              }
            }
          }
        }, 200);
      } catch (error) {
        console.warn('Error setting up buffer visualization:', error);
      }
    }
    
    // Show nearby complaints panel
    setNearbyComplaintsInfo({
      count: nearbyComplaints.length,
      radius,
      complaints: nearbyComplaints
    });
    
    // Try to focus map with proper error handling
    try {
      if (mapRef.current) {
        // Different ways to access flyTo functionality
        if (typeof mapRef.current.flyTo === 'function') {
          mapRef.current.flyTo({
            center: [center.lng, center.lat],
            zoom: 14,
            duration: 1000
          });
        } else if (mapRef.current.getMap && typeof mapRef.current.getMap === 'function') {
          const map = mapRef.current.getMap();
          if (map && typeof map.flyTo === 'function') {
            map.flyTo({
              center: [center.lng, center.lat],
              zoom: 14,
              duration: 1000
            });
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

  const userHasAnalysisAccess = useCallback(() => {
    return canAccessAnalysisTools(user);
  }, [user]);

  const toggleDrawingMode = useCallback((mode) => {
    // Check if user has permission for analysis tools
    if (mode !== null && !userHasAnalysisAccess()) {
      alert('You do not have permission to use drawing tools. Please contact an administrator.');
      return;
    }
    
    console.log(`Toggling drawing mode: ${mode}`);
    
    // Make sure the map ref exists
    if (!mapRef.current) {
      console.error("Map reference not available");
      return;
    }
    
    try {
      // First disable any current drawing mode
      if (mapRef.current.disableDrawingMode) {
        mapRef.current.disableDrawingMode();
      }
      
      // If mode is null, we're just disabling drawing
      if (mode === null) {
        setMapConfig(prev => ({ ...prev, drawingMode: null }));
        setDrawingState({
          active: false,
          mode: null,
          instructions: ''
        });
        return;
      }
      
      // Enable the specific drawing mode
      if (mapRef.current.enableDrawingMode) {
        // Set drawing instructions
        let instructions = '';
        if (mode === 'polygon') {
          instructions = 'Click on the map to place points. Connect to the first point or double-click to complete the polygon.';
        } else if (mode === 'point') {
          instructions = 'Click anywhere on the map to place a point.';
        }
        
        // Update drawing state first
        setDrawingState({
          active: true,
          mode,
          instructions
        });
        
        // Then enable the drawing mode on the map
        mapRef.current.enableDrawingMode(mode);
        console.log(`Drawing mode ${mode} activated on map`);
        
        // Update the config
        setMapConfig(prev => ({ ...prev, drawingMode: mode }));
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
  }, [userHasAnalysisAccess]);

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

  const runSpatialAnalysis = useCallback((analysisType) => {
    if (!userHasAnalysisAccess()) {
      alert('You do not have permission to use analysis tools. Please contact an administrator.');
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
          // Show buffer control panel instead of directly creating a buffer
          setShowBufferControl(true);
          break;
          
        case 'clearAnalysis':
          if (mapRef.current.clearAnalysis) {
            mapRef.current.clearAnalysis();
            setMapConfig(prev => ({
              ...prev,
              showAnalysis: false
            }));
            setShowBufferControl(false);
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
          
          // Try different approaches to fly to the coordinates
          try {
            // First try the flyTo method directly
            if (mapRef.current.flyTo) {
              mapRef.current.flyTo({
                center: complaint.coordinates,
                zoom: 15,
                duration: 1000
              });
            } 
            // Then try to access the underlying map instance
            else if (mapRef.current.getMap && typeof mapRef.current.getMap === 'function') {
              const mapInstance = mapRef.current.getMap();
              if (mapInstance && mapInstance.flyTo) {
                mapInstance.flyTo({
                  center: complaint.coordinates,
                  zoom: 15,
                  duration: 1000
                });
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
            toggleDrawingMode={toggleDrawingMode}
            createBuffer={createBuffer}
            setMapConfig={setMapConfig}
            setSelectedComplaint={setSelectedComplaint}
            user={user}
            setSidebarOpen={setSidebarOpen}
            mapRef={mapRef}
            runSpatialAnalysis={runSpatialAnalysis}
          />
        )}

        {/* Map container */}
        <div className="flex-1 relative">
          {/* Map */}
          <MapComponent
            ref={mapRef}
            mapConfig={mapConfig}
            setMapLoaded={setMapLoaded}
            complaints={complaints}
            setSelectedComplaint={setSelectedComplaint}
            user={user}
            departments={departments}
            onMapReady={handleMapReady}
          />

          {/* Drawing instructions overlay */}
          <DrawingInstructions 
            isActive={drawingState.active}
            mode={drawingState.mode}
            instructions={drawingState.instructions}
          />

          {/* Buffer control panel */}
          {showBufferControl && (
            <BufferControl 
              createBuffer={createBuffer}
              onClose={() => setShowBufferControl(false)}
              defaultDistance={mapConfig.bufferDistance}
            />
          )}

          {/* Map tools */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-10 bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
              title="Open sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Floating controls - only visible when showControls is true */}
          {showControls && mapLoaded && (
            <div className="absolute top-4 right-16 z-10">
              <MapControls
                mapConfig={mapConfig}
                toggleBaseMapStyle={toggleBaseMapStyle}
                toggleMapLayer={toggleMapLayer}
                toggleDrawingMode={toggleDrawingMode}
                runSpatialAnalysis={runSpatialAnalysis}
                isAdmin={userHasAnalysisAccess()}
              />
            </div>
          )}
          
          {/* Nearby complaints button for regular users */}
          {!userHasAnalysisAccess() && mapLoaded && (
            <div className="absolute bottom-6 right-6 z-10">
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
        </div>
      </div>

      {/* Selected complaint details */}
      {selectedComplaint && (
        <ComplaintPopup
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          isAdmin={user?.roles?.name === 'Super Admin' || user?.roles?.name === 'Department Admin'}
        />
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