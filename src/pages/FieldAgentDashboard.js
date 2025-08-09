import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import { 
  MapPin, AlertTriangle, CheckCircle, Clock, LogOut, 
  Settings, Home, Map as MapIcon, Bell, Upload, Camera,
  Search, Filter, Eye, MessageSquare, User, FileText,
  Navigation, Target, RefreshCw , X, Plus, Minus, Trash2
} from 'lucide-react';
import '../styles/leaflet-admin.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const FieldAgentDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned');
  const [assignedComplaints, setAssignedComplaints] = useState([]);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [stats, setStats] = useState({
    totalAssigned: 0,
    completed: 0,
    inProgress: 0,
    pending: 0
  });

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: ''
  });

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    images: []
  });

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFieldAgentData();
    getCurrentLocation();
  }, []);

  const fetchFieldAgentData = async () => {
    try {
      setLoading(true);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/');
        return;
      }
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name, permissions),
          departments (id, name)
        `)
        .eq('id', authUser.id)
        .single();
      
      if (userError) {
        console.error('User data fetch error:', userError);
        throw userError;
      }
      
      if (!userData) {
        console.error('No user data found');
        navigate('/');
        return;
      }
      
      if (userData.roles?.name !== 'Field Agent') {
        console.log('User is not a Field Agent, redirecting to dashboard');
        navigate('/dashboard');
        return;
      }
      
      setUser({ ...authUser, ...userData });
      
      // Fetch assigned complaints
      await fetchAssignedComplaints(authUser.id);
      
    } catch (error) {
      console.error('Error fetching field agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedComplaints = async (agentId) => {
    try {
      console.log('Fetching assigned complaints for agent:', agentId);
      
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          categories (id, name, icon, severity_level),
          users!complaints_reported_by_fkey (first_name, last_name, email, phone_number),
          departments (id, name)
        `)
        .eq('assigned_to', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching assigned complaints:', error);
        throw error;
      }
      
      console.log('Fetched assigned complaints:', data);
      setAssignedComplaints(data || []);
      
      // Calculate stats safely
      const totalAssigned = data?.length || 0;
      const completed = data?.filter(c => c.status === 'resolved').length || 0;
      const inProgress = data?.filter(c => c.status === 'in_progress').length || 0;
      const pending = data?.filter(c => c.status === 'open').length || 0;
      
      setStats({
        totalAssigned,
        completed,
        inProgress,
        pending
      });
      
    } catch (error) {
      console.error('Error fetching assigned complaints:', error);
      // Set empty state on error
      setAssignedComplaints([]);
      setStats({
        totalAssigned: 0,
        completed: 0,
        inProgress: 0,
        pending: 0
      });
    }
  };

  const getCurrentLocation = () => {
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
        const { data, error } = await supabase.rpc('get_nearby_complaints', {
          user_lat: location.lat,
          user_lng: location.lng,
          radius_km: 5,
          department_id: user?.department_id
        });

        if (error) throw error;
        setNearbyComplaints(data || []);
        return;
      } catch (rpcError) {
        console.warn('PostGIS function not available, falling back to client-side calculation:', rpcError);
      }

      // Fallback: fetch complaints from same department and calculate distance client-side
      let baseQuery = supabase
        .from('complaints')
        .select(`
          *,
          categories (id, name, icon, severity_level),
          users!complaints_reported_by_fkey (first_name, last_name, email),
          departments (id, name)
        `)
        .neq('status', 'resolved');

      // If user has a department, prioritize complaints from same department
      // Otherwise, fetch all nearby complaints
      if (user?.department_id) {
        // First try to get department categories
        const { data: departmentCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
        
        const categoryIds = departmentCategories?.map(dc => dc.category_id) || [];
        
        if (categoryIds.length > 0) {
          baseQuery = baseQuery.or(`department_id.eq.${user.department_id},category_id.in.(${categoryIds.join(',')})`);
        } else {
          baseQuery = baseQuery.eq('department_id', user.department_id);
        }
      }

      const { data: complaints, error } = await baseQuery
        .order('created_at', { ascending: false })
        .limit(20);

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

      // Filter by distance (within 5km) and sort by distance
      const nearbyFiltered = complaintsWithDistance
        .filter(c => c.distance !== null && c.distance <= 5)
        .sort((a, b) => a.distance - b.distance);

      setNearbyComplaints(nearbyFiltered);
      
    } catch (error) {
      console.error('Error fetching nearby complaints:', error);
      setNearbyComplaints([]);
    }
  };

  const handleComplaintUpdate = async (complaintId, updateData) => {
    try {
      console.log('Field agent updating complaint:', complaintId, updateData);
      
      const updates = {
        status: updateData.status,
        updated_at: new Date().toISOString()
      };

      if (updateData.status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaintId);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      // Add comment if notes provided
      if (updateData.notes) {
        await supabase
          .from('complaint_comments')
          .insert({
            complaint_id: complaintId,
            user_id: user.id,
            content: updateData.notes,
            is_internal: false,
            is_system: false
          });
      }
      
      // Add system comment about status change
      await supabase
        .from('complaint_comments')
        .insert({
          complaint_id: complaintId,
          user_id: user.id,
          content: `Field agent updated status to ${updateData.status.replace('_', ' ')}`,
          is_internal: true,
          is_system: true
        });

      // Refresh assigned complaints
      await fetchAssignedComplaints(user.id);
      
      setShowUpdateModal(false);
      setSelectedComplaint(null);
      setUpdateData({ status: '', notes: '', images: [] });
      
    } catch (error) {
      console.error('Error updating complaint:', error);
      alert('Error updating complaint: ' + error.message);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setUpdateData(prev => ({
      ...prev,
      images: [...prev.images, ...files]
    }));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (severity) => {
    switch (severity) {
      case 5: return 'text-red-600';
      case 4: return 'text-orange-600';
      case 3: return 'text-yellow-600';
      case 2: return 'text-blue-600';
      case 1: return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Target className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Field Agent Dashboard</h1>
                <p className="text-sm text-gray-600">
                  Welcome back, {user?.first_name} {user?.last_name} | {user?.departments?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={getCurrentLocation}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Navigation className="h-4 w-4" />
                <span>Update Location</span>
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>User View</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Assigned</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAssigned}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <RefreshCw className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b rounded-t-lg">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'assigned', label: 'Assigned Tasks', icon: AlertTriangle },
              { id: 'nearby', label: 'Nearby Complaints', icon: MapPin },
              { id: 'map', label: 'Field Map', icon: MapIcon }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-b-lg shadow">
          {activeTab === 'assigned' && (
            <div className="p-6">
              <div className="space-y-4">
                {assignedComplaints.map((complaint) => (
                  <div key={complaint.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg">{complaint.categories?.icon}</span>
                          <h3 className="font-semibold text-gray-900">{complaint.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                            {complaint.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{complaint.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Category: {complaint.categories?.name}</span>
                          <span>Reported: {formatDate(complaint.created_at)}</span>
                          <span>Reporter: {complaint.users?.first_name} {complaint.users?.last_name}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => navigate(`/complaint/${complaint.id}`)}
                          className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setUpdateData({ status: complaint.status, notes: '', images: [] });
                            setShowUpdateModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                          title="Update Status"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        {complaint.users?.phone_number && (
                          <a
                            href={`tel:${complaint.users.phone_number}`}
                            className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                            title="Call Reporter"
                          >
                            <Bell className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {assignedComplaints.length === 0 && (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Complaints</h3>
                    <p className="text-gray-600">You don't have any complaints assigned to you at the moment.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'nearby' && (
            <div className="p-6">
              {userLocation ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Complaints Near You</h3>
                    <button
                      onClick={() => fetchNearbyComplaints(userLocation)}
                      className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Refresh</span>
                    </button>
                  </div>
                  
                  {nearbyComplaints.map((complaint) => (
                    <div key={complaint.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-lg">{complaint.categories?.icon}</span>
                            <h3 className="font-semibold text-gray-900">{complaint.title}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                              {complaint.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3">{complaint.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Distance: {complaint.distance !== undefined && complaint.distance !== 999999 ? `${complaint.distance}m` : 'Unknown'}</span>
                            <span>Category: {complaint.categories?.name}</span>
                            <span>Reported: {formatDate(complaint.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => navigate(`/complaint/${complaint.id}`)}
                            className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {complaint.location && complaint.location.coordinates && complaint.location.coordinates.length >= 2 && (
                            <button
                              onClick={() => {
                                if (complaint.location && complaint.location.coordinates && complaint.location.coordinates.length >= 2) {
                                  const lat = complaint.location.coordinates[1];
                                  const lng = complaint.location.coordinates[0];
                                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                                } else {
                                  alert('Location data not available for this complaint');
                                }
                              }}
                              className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                              title="Get Directions"
                            >
                              <Navigation className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {nearbyComplaints.length === 0 && (
                    <div className="text-center py-12">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Nearby Complaints</h3>
                      <p className="text-gray-600">There are no complaints within 5km of your location.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Location Required</h3>
                  <p className="text-gray-600 mb-4">Please allow location access to see nearby complaints.</p>
                  <button
                    onClick={getCurrentLocation}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Enable Location
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'map' && (
            <div className="p-6">
              <div className="text-center py-12">
                <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Interactive Field Map</h3>
                <p className="text-gray-600 mb-4">Full map view with your assigned complaints and nearby issues.</p>
                <button
                  onClick={() => navigate('/map')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open Full Map
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Update Complaint</h3>
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedComplaint(null);
                  setUpdateData({ status: '', notes: '', images: [] });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={updateData.notes}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Add any notes about the progress..."
                  className="w-full rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evidence Images (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => handleComplaintUpdate(selectedComplaint.id, updateData)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update
              </button>
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedComplaint(null);
                  setUpdateData({ status: '', notes: '', images: [] });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldAgentDashboard;
