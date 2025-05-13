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
    if (complaint && complaint.parsedLocation && complaint.parsedLocation.latitude && complaint.parsedLocation.longitude) {
      if (map.current) return;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [complaint.parsedLocation.longitude, complaint.parsedLocation.latitude],
        zoom: 15,
        accessToken: MAPBOX_TOKEN
      });
      
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      new mapboxgl.Marker({ color: '#e74c3c' })
        .setLngLat([complaint.parsedLocation.longitude, complaint.parsedLocation.latitude])
        .addTo(map.current);
      
      return () => {
        if (map.current) map.current.remove();
      };
    }
  }, [complaint]);

  const fetchComplaintDetails = async (id) => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          categories (id, name, icon),
          users:reported_by (id, first_name, last_name, email, avatar_url),
          assigned_users:assigned_to (id, first_name, last_name, email, avatar_url),
          departments (id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Parse location data using the improved parser
      const locationData = parseLocation(data.location);
      
      setComplaint({
        ...data,
        parsedLocation: locationData
      });

      // Map will be initialized in the useEffect that depends on complaint state

    } catch (error) {
      console.error('Error parsing location data:', error);
      setError('Error loading complaint details');
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_comments')
        .select(`
          *,
          users (*)
        `)
        .eq('complaint_id', id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setStatusUpdating(true);
      
      const { error } = await supabase
        .from('complaints')
        .update({ 
          status: newStatus,
          ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {})
        })
        .eq('id', id);
      
      if (error) throw error;
      
      setComplaint(prev => ({
        ...prev,
        status: newStatus,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {})
      }));
      
      await addSystemComment(`Status changed to ${newStatus}`);
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssignToMe = async () => {
    try {
      setStatusUpdating(true);
      
      const { error } = await supabase
        .from('complaints')
        .update({ 
          assigned_to: user.id,
          status: complaint.status === 'open' ? 'in_progress' : complaint.status
        })
        .eq('id', id);
      
      if (error) throw error;
      
      await addSystemComment(`Complaint assigned to ${user.first_name} ${user.last_name}`);
      
      setComplaint(prev => ({
        ...prev,
        assigned_to: user.id,
        assigned_to_user: user,
        status: prev.status === 'open' ? 'in_progress' : prev.status
      }));
      
    } catch (error) {
      console.error('Error assigning complaint:', error);
      alert('Failed to assign complaint. Please try again.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const addSystemComment = async (message) => {
    try {
      await supabase
        .from('complaint_comments')
        .insert([{
          complaint_id: id,
          user_id: null,
          content: message,
          is_system: true
        }]);
      
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
      
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setCommenting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    });
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
        return status;
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
                      {complaint.anonymous ? 'Anonymous' : `${complaint.users?.first_name} ${complaint.users?.last_name}`}
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

                {complaint.processedImages && complaint.processedImages.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <Image className="h-5 w-5 mr-2 text-gray-500" />
                      Images
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {complaint.processedImages.map((image, index) => (
                        <div key={index} className="relative overflow-hidden rounded-lg aspect-w-4 aspect-h-3 bg-gray-100">
                          <img 
                            src={typeof image === 'string' ? image : URL.createObjectURL(image)} 
                            alt={`Evidence ${index + 1}`} 
                            className="object-cover w-full h-full"
                          />
                        </div>
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
                      <p className="mt-2 text-sm text-gray-500">
                        Latitude: {complaint.parsedLocation.latitude.toFixed(6)}, Longitude: {complaint.parsedLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-100 h-64 rounded-lg flex items-center justify-center">
                      <MapPin className="h-8 w-8 text-red-500" />
                      <p className="ml-2 text-gray-500">Location data not available</p>
                    </div>
                  )}
                </div>

                {comments.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-gray-500" />
                      Updates ({comments.length})
                    </h2>
                    
                    <div className="space-y-4">
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
                                  {comment.users.first_name.charAt(0)}
                                </div>
                                <span className="font-medium text-gray-900">
                                  {comment.users.first_name} {comment.users.last_name}
                                </span>
                                <span className="ml-auto text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                              </div>
                              <p className="text-gray-700">{comment.content}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(user && complaint.status !== 'resolved') && (
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-3">Add Comment</h2>
                    <form onSubmit={handleCommentSubmit}>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            {complaint.assigned_to_user.first_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">
                              {complaint.assigned_to_user.first_name} {complaint.assigned_to_user.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {complaint.assigned_to_user.roles?.name || 'Staff'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={handleAssignToMe}
                          disabled={statusUpdating}
                          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {statusUpdating ? 'Assigning...' : 'Assign to me'}
                        </button>
                      )}
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
                    </div>
                    
                    <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
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
                        {formatDate(new Date(new Date(complaint.created_at).getTime() + 86400000))}
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
                      <p className="text-xs text-gray-500">
                        Issue has been resolved successfully
                      </p>
                    </li>
                  )}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintDetail;
