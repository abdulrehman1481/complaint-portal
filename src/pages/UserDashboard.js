import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  AlertTriangle,
  CheckCircle, 
  Clock, 
  LogOut, 
  Settings,
  Plus,
  List,
  Map as MapIcon,
  ChevronRight,
  Calendar,
  BarChart2,
  Bell
} from 'lucide-react';
import { getDashboardPath } from '../utils/roleBasedRouting';
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0
  });
  const [communityStats, setCommunityStats] = useState({
    categories: [],
    statusDistribution: []
  });
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserData();
    fetchCommunityStats();
    getCurrentUserLocation();
  }, []);

  const getCurrentUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          fetchNearbyComplaints(location);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const fetchNearbyComplaints = async (location) => {
    try {
      // Try to use the PostGIS function first
      try {
        const { data, error } = await supabase.rpc('get_nearby_complaints_for_users', {
          user_lat: location.lat,
          user_lng: location.lng,
          radius_km: 10
        });

        if (error) throw error;
        setNearbyComplaints(data || []);
        return;
      } catch (rpcError) {
        console.warn('PostGIS function not available, falling back to basic query:', rpcError);
      }

      // Fallback: fetch recent public complaints and calculate distance client-side
      const { data: complaints, error } = await supabase
        .from('complaints')
        .select(`
          *,
          categories (id, name, icon, severity_level)
        `)
        .eq('anonymous', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Calculate distances on the client side
      const complaintsWithDistance = complaints.map(complaint => {
        let lat = null, lng = null;
        
        if (complaint.location) {
          if (typeof complaint.location === 'string') {
            const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)\s*\)/i);
            if (pointMatch && pointMatch.length >= 3) {
              lng = parseFloat(pointMatch[1]);
              lat = parseFloat(pointMatch[2]);
            }
          } else if (typeof complaint.location === 'object' && complaint.location.coordinates) {
            [lng, lat] = complaint.location.coordinates;
          }
        }
        
        let distance = null;
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          // Simple distance calculation (Haversine formula)
          const R = 6371; // Earth's radius in km  
          const dLat = (lat - location.lat) * Math.PI / 180;
          const dLng = (lng - location.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(location.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = R * c;
        }
        
        return {
          ...complaint,
          distance: distance
        };
      });

      // Filter by distance (within 10km) and sort by distance
      const nearbyFiltered = complaintsWithDistance
        .filter(c => c.distance !== null && c.distance <= 10)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10); // Limit to 10 nearby complaints

      setNearbyComplaints(nearbyFiltered);
      
    } catch (error) {
      console.error('Error fetching nearby complaints:', error);
      setNearbyComplaints([]);
    }
  };

  useEffect(() => {
    if (mapContainerRef.current) {
      initializeMapPreview();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapContainerRef.current]);

  const fetchUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        navigate('/');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          roles (
            id,
            name,
            permissions
          )
        `)
        .eq('id', authUser.id)
        .single();

      if (userError) throw userError;
      
      setUser({ ...authUser, ...userData });

      const { data: userComplaints, error: complaintsError } = await supabase
        .from('complaints')
        .select(`
          *,
          categories (name, icon)
        `)
        .eq('reported_by', authUser.id)
        .order('created_at', { ascending: false });

      if (complaintsError) throw complaintsError;
      
      setComplaints(userComplaints || []);

      const totalComplaints = userComplaints?.length || 0;
      const openComplaints = userComplaints?.filter(c => c.status === 'open')?.length || 0;
      const inProgressComplaints = userComplaints?.filter(c => c.status === 'in_progress')?.length || 0;
      const resolvedComplaints = userComplaints?.filter(c => c.status === 'resolved')?.length || 0;

      setStats({
        total: totalComplaints,
        open: openComplaints,
        inProgress: inProgressComplaints,
        resolved: resolvedComplaints
      });

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommunityStats = async () => {
    try {
      // Try to use the RPC function first
      let categories = [];
      try {
        const { data: categoryData, error: categoryError } = await supabase
          .rpc('get_complaints_by_category', { limit_count: 5 });
        
        if (categoryError) throw categoryError;
        // Normalize RPC output to { name, count }
        categories = (categoryData || []).map(row => ({
          name: row.category_name || row.name,
          count: row.complaint_count || row.count || 0,
          icon: row.category_icon || row.icon || null
        })).filter(c => c.count > 0);
      } catch (rpcError) {
        console.warn('RPC function not available, falling back to basic query:', rpcError);
        
        // Fallback: get categories with complaint counts
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select(`
            id,
            name,
            icon,
            complaints (id)
          `)
          .eq('is_active', true)
          .limit(5);
          
        if (categoryError) throw categoryError;
        
        categories = (categoryData || []).map(cat => ({
          name: cat.name,
          count: cat.complaints?.length || 0,
          icon: cat.icon
        })).filter(cat => cat.count > 0);
      }
      
      const statusData = [
        { name: 'Open', value: 0, color: '#EF4444' },
        { name: 'In Progress', value: 0, color: '#F59E0B' },
        { name: 'Resolved', value: 0, color: '#10B981' }
      ];
      
      // Use count queries properly
      const { count: openCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
        
      const { count: inProgressCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress');
        
      const { count: resolvedCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');
      
      statusData[0].value = openCount || 0;
      statusData[1].value = inProgressCount || 0;
      statusData[2].value = resolvedCount || 0;
      
      // Sort categories by count desc and cap at 5
      const topCategories = (categories || []).sort((a,b) => (b.count||0)-(a.count||0)).slice(0,5);
      setCommunityStats({
        categories: topCategories,
        statusDistribution: statusData
      });
      
    } catch (error) {
      console.error('Error fetching community stats:', error);
      // Set fallback empty data
      setCommunityStats({
        categories: [],
        statusDistribution: [
          { name: 'Open', value: 0, color: '#EF4444' },
          { name: 'In Progress', value: 0, color: '#F59E0B' },
          { name: 'Resolved', value: 0, color: '#10B981' }
        ]
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const navigateToReportComplaint = () => {
    navigate('/report-complaint');
  };

  const navigateToMap = () => {
    navigate('/map');
  };

  const initializeMapPreview = async () => {
    if (!mapContainerRef.current) return;
    
    try {
      console.log('Initializing user dashboard map preview');
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

  // Create Leaflet map with Pakistan default center (Islamabad)
  const map = L.map(mapContainerRef.current).setView([33.6844, 73.0479], 10);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      
      mapInstanceRef.current = map;
      
      // Process complaints and add markers
  let centerPoint = null;
  // Parse as many coordinate shapes as possible: GeoJSON, {lat,lng}, {latitude,longitude}, WKT string, fallback coordinates array
  const validComplaints = complaints.filter(Boolean);
      
      if (validComplaints.length > 0) {
        const points = validComplaints.map(c => {
          let lng = null, lat = null;
          const loc = c.location;
          if (loc) {
            if (typeof loc === 'string') {
              const m = loc.match(/POINT\s*\(\s*([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)\s*\)/i);
              if (m) { lng = parseFloat(m[1]); lat = parseFloat(m[2]); }
            } else if (typeof loc === 'object') {
              if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
                [lng, lat] = loc.coordinates;
              } else if (loc.lng != null && loc.lat != null) {
                lng = loc.lng; lat = loc.lat;
              } else if (loc.longitude != null && loc.latitude != null) {
                lng = loc.longitude; lat = loc.latitude;
              }
            }
          }
          if ((lng == null || lat == null) && Array.isArray(c.coordinates) && c.coordinates.length === 2) {
            [lng, lat] = c.coordinates;
          }
          if (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) return [lng, lat];
          return null;
        }).filter(Boolean);
        
        if (points.length > 0) {
          const center = points.reduce(
            (acc, point) => {
              return [acc[0] + point[0]/points.length, acc[1] + point[1]/points.length];
            },
            [0, 0]
          );
          
          centerPoint = center;
          
          points.forEach(point => {
            try {
              // Convert to [lat, lng] for Leaflet
              L.marker([point[1], point[0]]).addTo(map);
            } catch (e) {
              console.warn('Error adding marker:', e);
            }
          });
        }
      }
      
  // Get user location if no complaints
      if (!centerPoint) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          
          centerPoint = [position.coords.longitude, position.coords.latitude];
          
          // Add user location marker (orange)
          const orangeIcon = L.divIcon({
            className: 'custom-marker',
            html: '<div style="background-color: #e67e22; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          L.marker([centerPoint[1], centerPoint[0]], { icon: orangeIcon }).addTo(map);
          
        } catch (error) {
          console.warn('Could not get user location:', error);
          // Default to Islamabad if location not available
          centerPoint = [73.0479, 33.6844];
        }
      }
      
      if (centerPoint) {
        // Convert to [lat, lng] for Leaflet setView
        map.setView([centerPoint[1], centerPoint[0]], 11.5);
      }
      
    } catch (error) {
      console.error('Error initializing map preview:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const isAdmin = user?.roles?.name === 'Super Admin' || user?.roles?.name === 'Department Admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <MapPin className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold ml-2 text-gray-800">CivicMapTrack</span>
              </div>
            </div>
            <div className="flex items-center">
              {/* Role-specific dashboard link */}
              {user?.roles?.name !== 'Public User' && (
                <button
                  onClick={() => navigate(getDashboardPath(user?.roles?.name))}
                  className="mr-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {user?.roles?.name === 'Super Admin' && 'Admin Panel'}
                  {user?.roles?.name === 'Department Admin' && 'Department Dashboard'}
                  {user?.roles?.name === 'Field Agent' && 'Field Dashboard'}
                </button>
              )}
              <div className="relative">
                <button className="p-1 rounded-full text-gray-500 hover:text-gray-600 focus:outline-none">
                  <Bell className="h-6 w-6" />
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
                </button>
              </div>
              <div className="ml-4 flex items-center md:ml-6">
                <div className="relative">
                  <div className="flex items-center">
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                        {user?.roles?.name}
                      </p>
                    </div>
                    <div className="ml-3 relative">
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                        {user?.first_name?.charAt(0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-10">
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 sm:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold leading-tight text-gray-900">
                  Welcome back, {user?.first_name}!
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Here's an overview of your reported community issues.
                </p>
              </div>
              <div className="mt-4 sm:mt-0 flex space-x-3">
                <button
                  onClick={navigateToReportComplaint}
                  className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Report Issue
                </button>
                <button
                  onClick={navigateToMap}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded shadow hover:bg-gray-50 flex items-center"
                >
                  <MapIcon className="h-4 w-4 mr-2" />
                  View Map
                </button>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 flex items-center"
                  >
                    Switch to Admin
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                      <AlertTriangle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 truncate">
                        Total Reports
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-gray-900">
                        {stats.total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 truncate">
                        Open Issues
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-gray-900">
                        {stats.open}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 truncate">
                        In Progress
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-gray-900">
                        {stats.inProgress}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 truncate">
                        Resolved
                      </p>
                      <p className="mt-1 text-3xl font-semibold text-gray-900">
                        {stats.resolved}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Your Recent Reports</h3>
                <button
                  className="flex items-center text-sm text-blue-600"
                  onClick={() => navigate('/my-complaints')}
                >
                  View all <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {complaints.length > 0 ? (
                    complaints.slice(0, 5).map((complaint) => (
                      <li key={complaint.id}>
                        <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/complaint/${complaint.id}`)}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {complaint.title}
                            </p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                                ${complaint.status === 'open' ? 'bg-red-100 text-red-800' : 
                                  complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                                  'bg-green-100 text-green-800'}`}>
                                {complaint.status === 'in_progress' ? 'In Progress' : 
                                  complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                {complaint.categories?.icon || '📍'} {complaint.categories?.name || 'General'}
                              </p>
                              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {formatDate(complaint.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-12 text-center">
                      <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">You haven't reported any issues yet.</p>
                      <button
                        onClick={navigateToReportComplaint}
                        className="mt-3 text-blue-600 hover:text-blue-500 text-sm"
                      >
                        Report your first complaint
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Nearby Community Issues Section */}
            {nearbyComplaints.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Nearby Community Issues</h3>
                  <span className="text-sm text-gray-500">Within 10km of your location</span>
                </div>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {nearbyComplaints.slice(0, 5).map((complaint) => (
                      <li key={complaint.id}>
                        <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/complaint/${complaint.id}`)}>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {complaint.title}
                            </p>
                            <div className="ml-2 flex-shrink-0 flex items-center space-x-2">
                              {complaint.distance && (
                                <span className="text-xs text-gray-500">
                                  {complaint.distance < 1 ? 
                                    `${Math.round(complaint.distance * 1000)}m` : 
                                    `${complaint.distance.toFixed(1)}km`} away
                                </span>
                              )}
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                                ${complaint.status === 'open' ? 'bg-red-100 text-red-800' : 
                                  complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                                  'bg-green-100 text-green-800'}`}>
                                {complaint.status === 'in_progress' ? 'In Progress' : 
                                  complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                {complaint.categories?.icon || complaint.category_icon || '📍'} {complaint.categories?.name || complaint.category_name || 'General'}
                              </p>
                              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                                <Calendar className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                {formatDate(complaint.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Community Map
                  </h3>
                  <div className="mt-4 aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg">
                    <div ref={mapContainerRef} className="h-64 w-full rounded-lg"></div>
                  </div>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={navigateToMap}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Open Full Map
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Community Statistics
                  </h3>
                  <div className="mt-4">
                    {communityStats.statusDistribution.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={communityStats.statusDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              nameKey="name"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {communityStats.statusDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} complaints`, 'Count']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48">
                        <div className="text-center">
                          <BarChart2 className="h-12 w-12 text-gray-400 mx-auto" />
                          <p className="mt-2 text-gray-500">Loading statistics data...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => navigate('/analytics')}
                      className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View Community Statistics
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {communityStats.categories.length > 0 && (
              <div className="mt-8 bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Top Issue Categories
                  </h3>
                  <div className="space-y-3">
                    {communityStats.categories.map((category, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-1/3 sm:w-1/4 text-sm font-medium text-gray-500">{category.name}</div>
                        <div className="w-2/3 sm:w-3/4">
                          <div className="relative pt-1">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-4">
                                  <div 
                                    className="bg-blue-600 rounded-full h-4" 
                                    style={{ width: `${Math.min(100, (category.count / communityStats.categories[0].count) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <span className="text-xs font-semibold text-blue-700 ml-2">{category.count}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Account Settings
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                      Manage your profile and preferences.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => navigate('/profile')}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Edit Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
