import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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
import { supabase } from '../supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
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
  }, []);

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
      const { data: categories, error: categoryError } = await supabase
        .rpc('get_complaints_by_category')
        .limit(5);
      
      if (categoryError) throw categoryError;
      
      const statusData = [
        { name: 'Open', value: 0, color: '#EF4444' },
        { name: 'In Progress', value: 0, color: '#F59E0B' },
        { name: 'Resolved', value: 0, color: '#10B981' }
      ];
      
      const { data: openCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
        
      const { data: inProgressCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress');
        
      const { data: resolvedCount } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');
      
      statusData[0].value = openCount?.length || 0;
      statusData[1].value = inProgressCount?.length || 0;
      statusData[2].value = resolvedCount?.length || 0;
      
      setCommunityStats({
        categories: categories || [],
        statusDistribution: statusData
      });
      
    } catch (error) {
      console.error('Error fetching community stats:', error);
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

  const initializeMapPreview = () => {
    const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || 'pk.eyJ1IjoiYWJyZWhtYW4xMTIyIiwiYSI6ImNtNHlrY3Q2cTBuYmsyaXIweDZrZG9yZnoifQ.FkDynV0HksdN7ICBxt2uPg';
    
    if (!mapContainerRef.current) return;
    
    try {
      console.log('Initializing user dashboard map preview');
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
      
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-74.5, 40],
        zoom: 9,
        interactive: true
      });
      
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      
      mapInstanceRef.current = map;
      
      map.on('load', async () => {
        console.log('Map preview loaded');
        
        let centerPoint = null;
        let validComplaints = complaints.filter(complaint => 
          complaint.location && typeof complaint.location === 'object'
        );
        
        if (validComplaints.length > 0) {
          const points = validComplaints
            .map(complaint => {
              if (complaint.location.latitude && complaint.location.longitude) {
                return [complaint.location.longitude, complaint.location.latitude];
              } else if (complaint.location.lng && complaint.location.lat) {
                return [complaint.location.lng, complaint.location.lat];
              } else if (complaint.coordinates && complaint.coordinates.length === 2) {
                return complaint.coordinates;
              }
              return null;
            })
            .filter(point => point !== null);
          
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
                new mapboxgl.Marker({ color: '#3498db' })
                  .setLngLat(point)
                  .addTo(map);
              } catch (e) {
                console.warn('Error adding marker:', e);
              }
            });
          }
        }
        
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
            
            new mapboxgl.Marker({ color: '#e67e22' })
              .setLngLat(centerPoint)
              .addTo(map);
            
          } catch (error) {
            console.warn('Could not get user location:', error);
            centerPoint = [-74.5, 40];
          }
        }
        
        if (centerPoint) {
          map.flyTo({
            center: centerPoint,
            zoom: 11.5,
            essential: true
          });
        }
      });
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
