import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/map-fixes.css';
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
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Add delay to ensure DOM is ready and container is properly sized
      const timer = setTimeout(() => {
        if (mapContainerRef.current && !mapInstanceRef.current) {
          initializeMapPreview();
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Error removing map:', e);
        }
        mapInstanceRef.current = null;
      }
    };
  }, [complaints]); // Also trigger when complaints change

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
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    
    try {
      console.log('Initializing user dashboard map preview');
      
      // Ensure container has proper dimensions
      const container = mapContainerRef.current;
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        container.style.width = '100%';
        container.style.height = '300px';
        container.style.minHeight = '300px';
      }

      // Create Leaflet map with Pakistan default center (Islamabad)
      const map = L.map(container, {
        preferCanvas: true,
        attributionControl: true
      }).setView([33.6844, 73.0479], 10);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(map);
      
      mapInstanceRef.current = map;
      
      // Process complaints and add markers
      let centerPoint = null;
      const validComplaints = complaints.filter(Boolean);
      
      if (validComplaints.length > 0) {
        const points = [];
        
        validComplaints.forEach(c => {
          let lng = null, lat = null;
          const loc = c.location;
          
          if (loc) {
            if (typeof loc === 'string') {
              // Handle WKT POINT format
              const pointMatch = loc.match(/POINT\s*\(\s*([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)\s*\)/i);
              if (pointMatch && pointMatch.length >= 3) {
                lng = parseFloat(pointMatch[1]);
                lat = parseFloat(pointMatch[2]);
              }
            } else if (typeof loc === 'object') {
              // Handle GeoJSON format
              if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
                [lng, lat] = loc.coordinates;
              } else if (loc.lng != null && loc.lat != null) {
                lng = loc.lng; 
                lat = loc.lat;
              } else if (loc.longitude != null && loc.latitude != null) {
                lng = loc.longitude; 
                lat = loc.latitude;
              }
            }
          }
          
          // Validate coordinates
          if (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) {
            points.push([lng, lat]);
            
            try {
              // Create marker with status-based color
              const statusColor = c.status === 'resolved' ? '#10b981' : 
                                 c.status === 'in_progress' ? '#f59e0b' : '#ef4444';
              
              const marker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: statusColor,
                color: 'white',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              }).addTo(map);
              
              // Add popup with complaint info
              const popupContent = `
                <div style="min-width: 200px;">
                  <h6 style="margin: 0 0 8px 0; font-weight: bold;">${c.title || 'Complaint'}</h6>
                  <p style="margin: 0 0 4px 0; font-size: 12px;">
                    <strong>Category:</strong> ${c.categories?.name || 'N/A'}
                  </p>
                  <p style="margin: 0 0 4px 0; font-size: 12px;">
                    <strong>Status:</strong> 
                    <span style="color: ${statusColor}; font-weight: bold;">
                      ${c.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #666;">
                    ${new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
              `;
              
              marker.bindPopup(popupContent);
              
            } catch (e) {
              console.warn('Error adding marker for complaint:', c.id, e);
            }
          }
        });
        
        // Calculate center point from valid coordinates
        if (points.length > 0) {
          const avgLng = points.reduce((sum, point) => sum + point[0], 0) / points.length;
          const avgLat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
          centerPoint = [avgLng, avgLat];
        }
      }
      
      // Get user location if no complaints or as fallback
      if (!centerPoint) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 300000
            });
          });
          
          centerPoint = [position.coords.longitude, position.coords.latitude];
          
          // Add user location marker
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          
          L.marker([centerPoint[1], centerPoint[0]], { icon: userIcon })
            .addTo(map)
            .bindPopup('Your Location');
          
        } catch (error) {
          console.warn('Could not get user location:', error);
          // Default to Islamabad if location not available
          centerPoint = [73.0479, 33.6844];
        }
      }
      
      if (centerPoint) {
        // Set view to center point (convert lng,lat to lat,lng for Leaflet)
        map.setView([centerPoint[1], centerPoint[0]], validComplaints.length > 0 ? 12 : 11);
      }
      
      // Force resize after initialization
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
      
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Enhanced Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 flex items-center">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-md">
                  <MapPin className="h-8 w-8 text-white" />
                </div>
                <span className="text-xl font-bold ml-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  CivicMapTrack
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Role-specific dashboard link */}
              {user?.roles?.name !== 'Public User' && (
                <button
                  onClick={() => navigate(getDashboardPath(user?.roles?.name))}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-all duration-200"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {user?.roles?.name === 'Super Admin' && 'Admin Panel'}
                  {user?.roles?.name === 'Department Admin' && 'Department Dashboard'}
                  {user?.roles?.name === 'Field Agent' && 'Field Dashboard'}
                </button>
              )}
              
              {/* Notification Button */}
              <div className="relative">
                <button className="p-2 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                  <Bell className="h-6 w-6" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></span>
                </button>
              </div>

              {/* User Profile */}
              <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.roles?.name}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">
                  {user?.first_name?.charAt(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-indigo-600/90"></div>
              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">
                      Welcome back, {user?.first_name}! 👋
                    </h1>
                    <p className="text-blue-100 text-lg max-w-2xl">
                      Manage your community reports, track their progress, and explore local issues in your area.
                    </p>
                  </div>
                  <div className="mt-6 sm:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={navigateToReportComplaint}
                      className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl shadow-lg hover:bg-gray-50 transform hover:scale-105 transition-all duration-200"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Report New Issue
                    </button>
                    <button
                      onClick={navigateToMap}
                      className="inline-flex items-center px-6 py-3 bg-blue-500/20 text-white font-semibold rounded-xl border border-white/20 hover:bg-blue-500/30 transform hover:scale-105 transition-all duration-200"
                    >
                      <MapIcon className="h-5 w-5 mr-2" />
                      Explore Map
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => navigate('/admin')}
                        className="inline-flex items-center px-6 py-3 bg-indigo-500/20 text-white font-semibold rounded-xl border border-white/20 hover:bg-indigo-500/30 transform hover:scale-105 transition-all duration-200"
                      >
                        Switch to Admin
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Decorative Elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full"></div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white overflow-hidden shadow-lg rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md">
                    <AlertTriangle className="h-7 w-7 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Total Reports
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {stats.total}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow-lg rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-md">
                    <AlertTriangle className="h-7 w-7 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Open Issues
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {stats.open}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow-lg rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl shadow-md">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      In Progress
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {stats.inProgress}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white overflow-hidden shadow-lg rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-md">
                    <CheckCircle className="h-7 w-7 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Resolved
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {stats.resolved}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Reports Section */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Your Recent Reports</h3>
                    <p className="mt-1 text-sm text-gray-600">Track and manage your community issue reports</p>
                  </div>
                  <button
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-all duration-200"
                    onClick={() => navigate('/my-complaints')}
                  >
                    View All <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {complaints.length > 0 ? (
                  complaints.slice(0, 5).map((complaint) => (
                    <div key={complaint.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/complaint/${complaint.id}`)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-gray-900 truncate mb-2">
                            {complaint.title}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <span className="text-lg mr-2">{complaint.categories?.icon || '📍'}</span>
                              {complaint.categories?.name || 'General'}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1.5" />
                              {formatDate(complaint.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                            ${complaint.status === 'open' ? 'bg-red-100 text-red-800 border border-red-200' : 
                              complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 
                              'bg-green-100 text-green-800 border border-green-200'}`}>
                            {complaint.status === 'in_progress' ? 'In Progress' : 
                              complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-10 w-10 text-gray-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h4>
                    <p className="text-gray-500 mb-4">Start making a difference in your community by reporting your first issue.</p>
                    <button
                      onClick={navigateToReportComplaint}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Report Your First Issue
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nearby Community Issues Section */}
          {nearbyComplaints.length > 0 && (
            <div className="mb-8">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Nearby Community Issues</h3>
                      <p className="mt-1 text-sm text-gray-600">Issues within 10km of your location</p>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                      <MapPin className="h-4 w-4" />
                      <span>10km radius</span>
                    </div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {nearbyComplaints.slice(0, 5).map((complaint) => (
                    <div key={complaint.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200" onClick={() => navigate(`/complaint/${complaint.id}`)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-gray-900 truncate mb-2">
                            {complaint.title}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <span className="text-lg mr-2">{complaint.categories?.icon || complaint.category_icon || '📍'}</span>
                              {complaint.categories?.name || complaint.category_name || 'General'}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1.5" />
                              {formatDate(complaint.created_at)}
                            </span>
                            {complaint.distance && (
                              <span className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                <MapPin className="h-3 w-3 mr-1" />
                                {complaint.distance < 1 ? 
                                  `${Math.round(complaint.distance * 1000)}m` : 
                                  `${complaint.distance.toFixed(1)}km`} away
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                            ${complaint.status === 'open' ? 'bg-red-100 text-red-800 border border-red-200' : 
                              complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 
                              'bg-green-100 text-green-800 border border-green-200'}`}>
                            {complaint.status === 'in_progress' ? 'In Progress' : 
                              complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Map and Statistics Grid */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            {/* Community Map */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Community Map</h3>
                    <p className="mt-1 text-sm text-gray-600">Interactive view of all reported issues</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MapIcon className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="relative bg-gray-100 rounded-xl overflow-hidden shadow-inner">
                  <div ref={mapContainerRef} className="w-full h-80 user-dashboard-map"></div>
                </div>
                
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={navigateToMap}
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
                  >
                    <MapIcon className="mr-2 h-5 w-5" />
                    Open Full Map Experience
                  </button>
                </div>
              </div>
            </div>

            {/* Community Statistics */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Community Statistics</h3>
                    <p className="mt-1 text-sm text-gray-600">Overview of all community issues</p>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart2 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {communityStats.statusDistribution.length > 0 ? (
                  <div className="h-64 mb-6">
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
                  <div className="flex items-center justify-center h-64 mb-6">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <BarChart2 className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">Loading statistics...</p>
                      <p className="text-sm text-gray-400 mt-1">Analyzing community data</p>
                    </div>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => navigate('/analytics')}
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg shadow-md hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-200"
                >
                  <BarChart2 className="mr-2 h-5 w-5" />
                  View Detailed Analytics
                </button>
              </div>
            </div>
          </div>

          {/* Top Issue Categories */}
          {communityStats.categories.length > 0 && (
            <div className="mb-8">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Top Issue Categories</h3>
                      <p className="mt-1 text-sm text-gray-600">Most reported issues in your community</p>
                    </div>
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <BarChart2 className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {communityStats.categories.map((category, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{category.icon || '📊'}</span>
                            <span className="font-semibold text-gray-900">{category.name}</span>
                          </div>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {category.count} reports
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${Math.min(100, (category.count / communityStats.categories[0].count) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Settings */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Account Settings</h3>
                  <p className="mt-1 text-sm text-gray-600">Manage your profile and preferences</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Settings className="h-6 w-6 text-gray-600" />
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {user?.first_name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {user?.email}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">
                      {user?.roles?.name}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => navigate('/profile')}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
                  >
                    <Settings className="mr-2 h-5 w-5" />
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-200 transform hover:scale-105 transition-all duration-200"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
