import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';
import { 
  AlertTriangle, 
  ChevronLeft, 
  Clock, 
  CheckCircle, 
  MapPin, 
  Calendar,
  User,
  MessageSquare,
  Image,
  ChevronRight,
  Edit,
  Send,
  Loader,
  Map as MapIcon
} from 'lucide-react';
import { parseLocation, formatLocationForDisplay } from '../utils/locationFormatter';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJyZWhtYW4xMTIyIiwiYSI6ImNtNHlrY3Q2cTBuYmsyaXIweDZrZG9yZnoifQ.FkDynV0HksdN7ICBxt2uPg';

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    const fetchComplaintAndUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/');
          return;
        }
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select(`
            *,
            roles(name)
          `)
          .eq('id', session.user.id)
          .single();
          
        if (userError) throw userError;
        setUser(userData);
        
        setIsAdmin(
          userData.roles?.name === 'Super Admin' || 
          userData.roles?.name === 'Department Admin' || 
          userData.roles?.name === 'Field Agent'
        );
        
        await fetchComplaintDetails(id);
        await fetchComments();
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load complaint details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchComplaintAndUser();
  }, [id, navigate]);

  useEffect(() => {
    if (complaint && mapContainer.current && !map.current) {
      initializeMap();
    }
    // Re-initialize map if complaint or container changes
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [complaint, mapContainer.current]);

  const initializeMap = () => {
    if (!complaint) return;
    
    let lat = null, lng = null;
    
    if (complaint.parsedLocation && complaint.parsedLocation.latitude && complaint.parsedLocation.longitude) {
      lat = complaint.parsedLocation.latitude;
      lng = complaint.parsedLocation.longitude;
    } else if (complaint.location) {
      if (typeof complaint.location === 'string') {
        const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)\s*\)/i);
        if (pointMatch && pointMatch.length >= 3) {
          lng = parseFloat(pointMatch[1]);
          lat = parseFloat(pointMatch[2]);
        }
      } else if (typeof complaint.location === 'object') {
        if (complaint.location.latitude !== undefined && complaint.location.longitude !== undefined) {
          lat = complaint.location.latitude;
          lng = complaint.location.longitude;
        } else if (complaint.location.lat !== undefined && complaint.location.lng !== undefined) {
          lat = complaint.location.lat;
          lng = complaint.location.lng;
        } else if (complaint.location.coordinates && Array.isArray(complaint.location.coordinates)) {
          [lng, lat] = complaint.location.coordinates;
        }
      }
    } else if (complaint.coordinates && Array.isArray(complaint.coordinates)) {
      [lng, lat] = complaint.coordinates;
    }
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.warn('Invalid coordinates:', lat, lng);
      return;
    }
    
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [lng, lat],
        zoom: 15,
        interactive: true
      });
      
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      new mapboxgl.Marker({ color: '#e74c3c' })
        .setLngLat([lng, lat])
        .addTo(map.current);
      
      if (!complaint.locationName) {
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`)
          .then(response => response.json())
          .then(data => {
            if (data && data.features && data.features.length > 0) {
              const locationName = data.features[0].place_name;
              setComplaint(prev => ({
                ...prev,
                locationName
              }));
            }
          })
          .catch(err => console.error('Error getting location name:', err));
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const fetchComplaintDetails = async (id) => {
    try {
      // First fetch the complaint with just the categories to avoid the join error
      const { data: comp, error: compErr } = await supabase
        .from('complaints')
        .select('*, categories(*)')
        .eq('id', id)
        .single();
        
      if (compErr) throw compErr;

      // Fetch department details separately if department_id exists
      let departmentData = null;
      if (comp.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('*')
          .eq('id', comp.department_id)
          .single();
        departmentData = dept;
      }

      // Continue with existing user fetching code
      let reported = null;
      if (comp.reported_by && !comp.anonymous) {
        const { data: ru } = await supabase
          .from('users')
          .select('id,first_name,last_name')
          .eq('id', comp.reported_by)
          .single();
        reported = ru;
      }
      
      let assigned = null;
      if (comp.assigned_to) {
        const { data: au } = await supabase
          .from('users')
          .select('id,first_name,last_name,roles(name)')  // Remove avatar_url since it doesn't exist
          .eq('id', comp.assigned_to)
          .single();
        assigned = au;
      }
      
      // Fetch available departments for assignment
      const { data: departments } = await supabase
        .from('departments')
        .select('id,name')
        .order('name');

      const imageUrls = (comp.images || []).map(path =>
        supabase.storage.from('complaint-images').getPublicUrl(path).data.publicUrl
      );
      
      const locationData = parseComplaintLocation(comp);

      const enhancedComplaint = {
        ...comp,
        reported_by_user: reported,
        assigned_to_user: assigned,
        departments: departmentData, // Use the separately fetched department data
        parsedLocation: locationData,
        imageUrls,
        resolutionTime: comp.resolved_at && comp.created_at ? 
          calculateResolutionTime(new Date(comp.created_at), new Date(comp.resolved_at)) : null,
        availableDepartments: departments || []
      };
      
      setComplaint(enhancedComplaint);
      
    } catch (err) {
      console.error('Fetch complaint error:', err);
      setError('Error loading complaint details. Please try again later.');
    }
  };

  const parseComplaintLocation = (comp) => {
    if (typeof parseLocation === 'function') {
      const parsedLoc = parseLocation(comp.location);
      if (parsedLoc && parsedLoc.latitude && parsedLoc.longitude) {
        return parsedLoc;
      }
    }
    
    if (comp.location) {
      if (typeof comp.location === 'object' && comp.location.type === 'Point' && 
          Array.isArray(comp.location.coordinates) && comp.location.coordinates.length === 2) {
        const [longitude, latitude] = comp.location.coordinates;
        return { latitude, longitude };
      }
      
      if (typeof comp.location === 'object' && 
          (comp.location.latitude !== undefined && comp.location.longitude !== undefined)) {
        return {
          latitude: comp.location.latitude,
          longitude: comp.location.longitude
        };
      }
      
      if (typeof comp.location === 'object' && 
          (comp.location.lat !== undefined && comp.location.lng !== undefined)) {
        return {
          latitude: comp.location.lat,
          longitude: comp.location.lng
        };
      }
      
      if (typeof comp.location === 'string') {
        const pointMatch = comp.location.match(/POINT\s*\(\s*([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)\s*\)/i);
        if (pointMatch && pointMatch.length >= 3) {
          return {
            longitude: parseFloat(pointMatch[1]),
            latitude: parseFloat(pointMatch[2])
          };
        }
      }
    }
    
    if (comp.latitude !== undefined && comp.longitude !== undefined) {
      return {
        latitude: comp.latitude,
        longitude: comp.longitude
      };
    }
    
    if (comp.coordinates && Array.isArray(comp.coordinates) && comp.coordinates.length === 2) {
      return {
        longitude: comp.coordinates[0],
        latitude: comp.coordinates[1]
      };
    }
    
    return null;
  };

  const calculateResolutionTime = (createdDate, resolvedDate) => {
    const diffMs = resolvedDate - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_comments')
        .select('*, user:user_id(id,first_name,last_name)')  // Remove avatar_url since it doesn't exist
        .eq('complaint_id', id)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Fetch comments error:', err);
      setError('Failed to load comments. Please refresh and try again.');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setStatusUpdating(true);
      
      const updates = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      } else if (newStatus === 'open' && complaint.resolved_at) {
        updates.resolved_at = null;
      }
      
      // Update the complaint status in the complaints table
      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', parseInt(complaint.id));
      
      if (error) {
        console.error('Supabase update error details:', error);
        throw error;
      }
      
      // Record status change in complaint_history table
      const { error: historyError } = await supabase
        .from('complaint_history')
        .insert({
          complaint_id: parseInt(complaint.id),
          status: newStatus,
          changed_by: user.id,
          notes: `Status changed to ${getStatusText(newStatus)}`,
          created_at: new Date().toISOString()
        });
      
      if (historyError) {
        console.error('Error recording history:', historyError);
        // Continue even if history recording fails
      }
      
      setComplaint(prev => {
        const updated = {
          ...prev,
          status: newStatus,
          updated_at: updates.updated_at,
          resolved_at: updates.resolved_at
        };
        
        if (newStatus === 'resolved' && updated.created_at) {
          updated.resolutionTime = calculateResolutionTime(
            new Date(updated.created_at),
            new Date(updated.resolved_at)
          );
        } else if (newStatus !== 'resolved') {
          updated.resolutionTime = null;
        }
        
        return updated;
      });
      
      await addSystemComment(`Status changed to ${getStatusText(newStatus)}`);
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert(`Failed to update status: ${error.message || 'Please try again.'}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssignToMe = async () => {
    try {
      setStatusUpdating(true);
      
      // Update original status if needed
      const previousStatus = complaint.status;
      const newStatus = complaint.status === 'open' ? 'in_progress' : complaint.status;
      
      const updates = { 
        assigned_to: user.id,
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', parseInt(complaint.id));
      
      if (error) throw error;
      
      // If status changed, record in history
      if (previousStatus !== newStatus) {
        const { error: historyError } = await supabase
          .from('complaint_history')
          .insert({
            complaint_id: parseInt(complaint.id),
            status: newStatus,
            changed_by: user.id,
            notes: `Status changed to ${getStatusText(newStatus)} when assigned`,
            created_at: new Date().toISOString()
          });
        
        if (historyError) {
          console.error('Error recording status history:', historyError);
        }
      }
      
      await addSystemComment(`Complaint assigned to ${user.first_name} ${user.last_name}`);
      
      setComplaint(prev => ({
        ...prev,
        assigned_to: user.id,
        assigned_to_user: user,
        status: newStatus
      }));
      
    } catch (error) {
      console.error('Error assigning complaint:', error);
      alert(`Failed to assign complaint: ${error.message || 'Please try again.'}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssignToDepartment = async (departmentId) => {
    try {
      if (!departmentId) return;
      
      setStatusUpdating(true);
      
      const updates = { 
        department_id: parseInt(departmentId),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', parseInt(complaint.id));
      
      if (error) throw error;
      
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', parseInt(departmentId))
        .single();
      
      const departmentName = dept?.name || `Department #${departmentId}`;
      
      // Record assignment in complaint_history for tracking
      const { error: historyError } = await supabase
        .from('complaint_history')
        .insert({
          complaint_id: parseInt(complaint.id),
          status: complaint.status, // Status remains the same
          changed_by: user.id,
          notes: `Assigned to ${departmentName} department`,
          created_at: new Date().toISOString()
        });
      
      if (historyError) {
        console.error('Error recording department assignment history:', historyError);
      }
      
      await addSystemComment(`Complaint assigned to ${departmentName} department`);
      
      setComplaint(prev => ({
        ...prev,
        department_id: parseInt(departmentId),
        departments: { ...prev.departments, id: parseInt(departmentId), name: departmentName }
      }));
      
    } catch (error) {
      console.error('Error assigning complaint to department:', error);
      alert(`Failed to assign complaint to department: ${error.message || 'Please try again.'}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const addSystemComment = async (message) => {
    try {
      const { error } = await supabase
        .from('complaint_comments')
        .insert([{
          complaint_id: id,
          user_id: null,
          content: message,
          is_system: true
        }]);
        
      if (error) throw error;
      
      await fetchComments();
    } catch (error) {
      console.error('Error adding system comment:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    if (!comment.trim()) return;
    
    try {
      setCommenting(true);
      
      const { error } = await supabase
        .from('complaint_comments')
        .insert([{
          complaint_id: id,
          user_id: user.id,
          content: comment.trim(),
          is_system: false
        }]);
      
      if (error) throw error;
      
      setComment('');
      await fetchComments();
      
      const commentsSection = document.getElementById('comments-section');
      if (commentsSection) {
        setTimeout(() => {
          commentsSection.scrollTop = commentsSection.scrollHeight;
        }, 100);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setCommenting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'resolved':
        return 'Resolved';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center text-red-500 mb-4">
              <AlertTriangle className="h-6 w-6 mr-2" />
              <h2 className="text-xl font-semibold">Error</h2>
            </div>
            <p>{error || 'Complaint not found.'}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {complaint.title}
                  </h1>
                  <div className="flex items-center">
                    {getStatusIcon(complaint.status)}
                    <span className={`ml-2 px-3 py-1 text-sm font-semibold rounded-full ${getStatusClass(complaint.status)}`}>
                      {getStatusText(complaint.status)}
                    </span>
                  </div>
                </div>

                <div className="border-b border-gray-200 pb-6 mb-6">
                  <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      Reported: {formatDate(complaint.created_at)}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      ID: #{complaint.id}
                    </div>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      {complaint.anonymous
                        ? 'Anonymous'
                        : complaint.reported_by_user 
                          ? `${complaint.reported_by_user?.first_name} ${complaint.reported_by_user?.last_name}`
                          : 'Unknown Reporter'}
                    </div>
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-gray-400" />
                      {complaint.categories && complaint.categories.name ? (
                        <span>
                          {complaint.categories.icon} {complaint.categories.name}
                        </span>
                      ) : (
                        <span>Uncategorized</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-3">Description</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {complaint.description || 'No description provided.'}
                  </p>
                </div>

                {complaint.imageUrls && complaint.imageUrls.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <Image className="h-5 w-5 mr-2 text-gray-500" />
                      Images ({complaint.imageUrls.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {complaint.imageUrls.map((url, index) => (
                        <a 
                          key={index}
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="block"
                        >
                          <img
                            src={url}
                            alt={`Evidence ${index + 1}`}
                            className="object-cover w-full h-48 rounded-lg hover:opacity-90 transition duration-150"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <MapIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Location
                  </h2>
                  {complaint.parsedLocation && complaint.parsedLocation.latitude && complaint.parsedLocation.longitude ? (
                    <div>
                      <div ref={mapContainer} className="bg-gray-100 h-64 rounded-lg"></div>
                      <div className="mt-2">
                        {complaint.locationName ? (
                          <p className="text-sm font-medium text-gray-700">{complaint.locationName}</p>
                        ) : null}
                        <p className="text-sm text-gray-500">
                          Latitude: {complaint.parsedLocation.latitude.toFixed(6)}, Longitude: {complaint.parsedLocation.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-100 h-64 rounded-lg flex items-center justify-center">
                      <MapPin className="h-8 w-8 text-red-500" />
                      <p className="ml-2 text-gray-500">Location data not available</p>
                    </div>
                  )}
                </div>

                <div className="mb-6" id="comments-section">
                  <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-gray-500" />
                    Updates ({comments.length})
                  </h2>
                  
                  {comments.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto p-1">
                      {comments.map((comment) => (
                        <div 
                          key={comment.id} 
                          className={`p-3 rounded-lg ${comment.is_system ? 'bg-gray-50 border border-gray-200' : 'bg-blue-50'}`}
                        >
                          {comment.is_system ? (
                            <div className="flex items-center text-gray-600">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              <span>{comment.content}</span>
                              <span className="ml-auto text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center mb-2">
                                <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs mr-2">
                                  {comment.user?.first_name?.charAt(0) || 'U'}
                                </div>
                                <span className="font-medium text-gray-900">
                                  {comment.user?.first_name || 'Unknown'} {comment.user?.last_name || 'User'}
                                </span>
                                <span className="ml-auto text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                              </div>
                              <p className="text-gray-700">{comment.content}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No updates yet</p>
                    </div>
                  )}
                </div>

                {(user && complaint.status !== 'resolved') && (
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-3">Add Comment</h2>
                    <form onSubmit={handleCommentSubmit}>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows="3"
                        placeholder="Add a comment or update..."
                        required
                      ></textarea>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="submit"
                          disabled={commenting}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {commenting ? (
                            <>
                              <Loader className="h-4 w-4 mr-2 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Post Comment
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isAdmin && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Manage Complaint</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Assignment</h3>
                      {complaint.assigned_to_user ? (
                        <div className="flex items-center p-3 bg-gray-50 rounded-md">
                          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white mr-3">
                            {complaint.assigned_to_user.first_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-medium">
                              {complaint.assigned_to_user.first_name || 'Unknown'} {complaint.assigned_to_user.last_name || 'User'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {complaint.assigned_to_user.roles?.name || 'Staff'}
                            </p>
                          </div>
                          {complaint.assigned_to === user.id && (
                            <span className="ml-auto text-xs text-indigo-600 font-medium">You</span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={handleAssignToMe}
                          disabled={statusUpdating}
                          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {statusUpdating ? (
                            <>
                              <Loader className="h-4 w-4 mr-2 animate-spin" />
                              Assigning...
                            </>
                          ) : (
                            'Assign to me'
                          )}
                        </button>
                      )}
                    </div>
                    
                    {/* Department assignment section */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Department Assignment</h3>
                      {complaint.departments && complaint.department_id ? (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div>
                            <p className="font-medium">
                              {complaint.departments.name || `Department #${complaint.department_id}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              Currently handling this complaint
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-2">No department assigned yet</p>
                      )}
                      
                      <div className="mt-3">
                        <select
                          id="department-select"
                          disabled={statusUpdating}
                          value={complaint.department_id || ""}
                          onChange={(e) => e.target.value !== "" && handleAssignToDepartment(e.target.value)}
                          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                          <option value="">Select a department</option>
                          {complaint.availableDepartments?.map(dept => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignToDepartment(document.getElementById('department-select').value)}
                          disabled={statusUpdating || !document.getElementById('department-select')?.value}
                          className="mt-2 w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {statusUpdating ? (
                            <>
                              <Loader className="h-4 w-4 mr-2 animate-spin" />
                              Assigning...
                            </>
                          ) : (
                            'Assign to Department'
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Update Status</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleStatusChange('open')}
                          disabled={complaint.status === 'open' || statusUpdating}
                          className={`p-2 flex flex-col items-center justify-center rounded-md border ${
                            complaint.status === 'open' 
                              ? 'bg-red-100 border-red-300 text-red-800' 
                              : 'border-gray-300 hover:bg-gray-50'
                          } text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                          <AlertTriangle className="h-5 w-5 mb-1" />
                          Open
                        </button>
                        
                        <button
                          onClick={() => handleStatusChange('in_progress')}
                          disabled={complaint.status === 'in_progress' || statusUpdating}
                          className={`p-2 flex flex-col items-center justify-center rounded-md border ${
                            complaint.status === 'in_progress' 
                              ? 'bg-yellow-100 border-yellow-300 text-yellow-800' 
                              : 'border-gray-300 hover:bg-gray-50'
                          } text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                          <Clock className="h-5 w-5 mb-1" />
                          In Progress
                        </button>
                        
                        <button
                          onClick={() => handleStatusChange('resolved')}
                          disabled={complaint.status === 'resolved' || statusUpdating}
                          className={`p-2 flex flex-col items-center justify-center rounded-md border ${
                            complaint.status === 'resolved' 
                              ? 'bg-green-100 border-green-300 text-green-800' 
                              : 'border-gray-300 hover:bg-gray-50'
                          } text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                          <CheckCircle className="h-5 w-5 mb-1" />
                          Resolved
                        </button>
                      </div>
                      {statusUpdating && (
                        <div className="text-center text-xs text-gray-500 mt-2">Updating status...</div>
                      )}
                    </div>
                    
                    <button 
                      className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => navigate(`/edit-complaint/${complaint.id}`)}
                    >
                      <Edit className="h-5 w-5 mr-2" />
                      Edit Complaint
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Category Information</h2>
                {complaint.categories && Object.keys(complaint.categories).length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{complaint.categories.icon || '🔍'}</span>
                      <div>
                        <h3 className="font-medium">{complaint.categories.name || 'Unknown Category'}</h3>
                        <p className="text-sm text-gray-500">
                          {complaint.categories.response_time ? 
                            `Average response time: ${complaint.categories.response_time}` : 
                            'Response time: Not specified'}
                        </p>
                      </div>
                    </div>
                    
                    {complaint.categories.severity_level && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Severity Level:</p>
                        <div className="mt-1 flex items-center">
                          <div className="bg-gray-200 h-2 flex-grow rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                (complaint.categories.severity_level >= 4) ? 'bg-red-500' :
                                (complaint.categories.severity_level === 3) ? 'bg-yellow-500' : 
                                'bg-green-500'
                              }`}
                              style={{ width: `${(complaint.categories.severity_level / 5) * 100}%` }}
                            ></div>
                          </div>
                          <span className="ml-3 text-sm font-medium text-gray-700">
                            Level {complaint.categories.severity_level}/5
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {complaint.categories.description && (
                      <p className="text-sm text-gray-600 mt-2">{complaint.categories.description}</p>
                    )}
                    
                    {complaint.category_id && !complaint.categories.name && (
                      <p className="text-sm text-gray-600">Category ID: {complaint.category_id}</p>
                    )}
                  </div>
                ) : complaint.category_id ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <AlertTriangle className="inline-block h-4 w-4 mr-1" />
                      Category information is missing but category ID is {complaint.category_id}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No category information available</div>
                )}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Timeline</h2>
                <ol className="relative border-l border-gray-200 ml-3">
                  <li className="mb-6 ml-6">
                    <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
                      <AlertTriangle className="w-3 h-3 text-blue-800" />
                    </span>
                    <h3 className="flex items-center mb-1 text-sm font-semibold text-gray-900">Reported</h3>
                    <time className="block mb-2 text-xs font-normal leading-none text-gray-400">
                      {formatDate(complaint.created_at)}
                    </time>
                    <p className="text-xs text-gray-500">
                      Complaint submitted to the system
                    </p>
                  </li>
                  
                  {complaint.status !== 'open' && (
                    <li className="mb-6 ml-6">
                      <span className="absolute flex items-center justify-center w-6 h-6 bg-yellow-100 rounded-full -left-3 ring-8 ring-white">
                        <Clock className="w-3 h-3 text-yellow-800" />
                      </span>
                      <h3 className="flex items-center mb-1 text-sm font-semibold text-gray-900">In Progress</h3>
                      <time className="block mb-2 text-xs font-normal leading-none text-gray-400">
                        {complaint.status_change_date ? formatDate(complaint.status_change_date) : '(Date not recorded)'}
                      </time>
                      <p className="text-xs text-gray-500">
                        Work started on addressing this issue
                      </p>
                    </li>
                  )}
                  
                  {complaint.status === 'resolved' && (
                    <li className="ml-6">
                      <span className="absolute flex items-center justify-center w-6 h-6 bg-green-100 rounded-full -left-3 ring-8 ring-white">
                        <CheckCircle className="w-3 h-3 text-green-800" />
                      </span>
                      <h3 className="flex items-center mb-1 text-sm font-semibold text-gray-900">Resolved</h3>
                      <time className="block mb-2 text-xs font-normal leading-none text-gray-400">
                        {formatDate(complaint.resolved_at || new Date())}
                      </time>
                      {complaint.resolutionTime && (
                        <p className="text-xs text-green-500 font-semibold">
                          Resolved in {complaint.resolutionTime}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Issue has been resolved successfully
                      </p>
                    </li>
                  )}
                </ol>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Related Issues</h2>
                <div className="text-center py-8">
                  <MapPin className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    No other issues reported in this area
                  </p>
                  <button 
                    onClick={() => navigate('/map')}
                    className="mt-3 inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    View map <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintDetail;
