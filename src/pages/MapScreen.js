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
    latitude: 40.7128,
    longitude: -74.0060,
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

// Updated fetchComplaints function
const fetchComplaints = async (userData) => {
  try {
    // Start with loading state
    setLoading(true);
    console.log("Fetching complaints...");
    
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
    
    // Process the complaints to add parsed location
    const processedComplaints = data?.map(complaint => {
      try {
        if (complaint.location) {
          const parsedLocation = parseLocation(complaint.location);
          
          if (parsedLocation && 
              parsedLocation.latitude && 
              parsedLocation.longitude &&
              !isNaN(parsedLocation.latitude) && 
              !isNaN(parsedLocation.longitude) &&
              Math.abs(parsedLocation.latitude) <= 90 &&
              Math.abs(parsedLocation.longitude) <= 180) {
            
            complaint.coordinates = [parsedLocation.longitude, parsedLocation.latitude];
            complaint.parsedLocation = parsedLocation;
          } else {
            complaint.coordinates = null;
            complaint.parsedLocation = null;
          }
        } else {
          complaint.coordinates = null;
          complaint.parsedLocation = null;
        }
      } catch (error) {
        console.error(`Error parsing location for complaint ${complaint.id}:`, error);
        complaint.coordinates = null;
        complaint.parsedLocation = null;
      }
      return complaint;
    }) || [];

    const validLocations = processedComplaints.filter(c => 
      c.parsedLocation && c.coordinates && c.coordinates.length === 2
    ).length;
    
    console.log(`Successfully parsed locations: ${validLocations}/${processedComplaints.length}`);

    setComplaints(processedComplaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
  } finally {
    setLoading(false);
  }
};

// Updated showNearbyComplaints function
const showNearbyComplaints = useCallback(async (radius = 1000) => {
  if (!mapRef.current) {
    alert('Map not fully initialized yet. Please try again in a moment.');
    return;
  }

  try {
    setLoading(true);
    
    // Get current map center
    const center = mapRef.current.getCenter();
    console.log(`Finding complaints near ${center.lng}, ${center.lat} with radius ${radius}m`);
    
    // Try client-side filtering first
    let nearbyComplaints = [];
    
    // Filter complaints by distance using Turf.js
    const centerPoint = turf.point([center.lng, center.lat]);
    
    nearbyComplaints = complaints.filter(complaint => {
      if (!complaint.parsedLocation || !complaint.coordinates) return false;
      
      try {
        const complaintPoint = turf.point(complaint.coordinates);
        const distance = turf.distance(centerPoint, complaintPoint, {units: 'meters'});
        return distance <= radius;
      } catch (err) {
        console.warn(`Error calculating distance for complaint ${complaint.id}:`, err);
        return false;
      }
    });
    
    console.log(`Found ${nearbyComplaints.length} nearby complaints (client-side)`);
    
    // Visualize the radius on the map
    if (mapRef.current.createBuffer) {
      try {
        // Create a point feature at center
        if (mapRef.current.enableDrawingMode) {
          mapRef.current.enableDrawingMode('point');
          
          // Small delay to ensure draw mode is active
          setTimeout(() => {
            if (mapRef.current.addPointFeature) {
              mapRef.current.addPointFeature([center.lng, center.lat]);
            }
            setTimeout(() => mapRef.current.createBuffer(radius), 100);
          }, 100);
        } else {
          mapRef.current.createBuffer(radius);
        }
      } catch (bufferErr) {
        console.warn('Error creating buffer visualization:', bufferErr);
      }
    }
    
    // Show nearby complaints panel
    setNearbyComplaintsInfo({
      count: nearbyComplaints.length,
      radius,
      complaints: nearbyComplaints
    });
    
    // Focus map on this area
    mapRef.current.flyTo({
      center: [center.lng, center.lat],
      zoom: Math.max(14, mapRef.current.getZoom()),
      duration: 1000
    });
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
          const parsedLocation = parseLocation(complaint.location);
          
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
      } catch (error) {
        console.error(`Error re-parsing location for complaint ${complaint.id}:`, error);
      }
      return complaint;
    });
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