import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/complaint-detail-map.css';
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
  Map as MapIcon,
  Building
} from 'lucide-react';
import { parseLocation, formatLocationForDisplay } from '../utils/locationFormatter';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

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
  const [fieldAgents, setFieldAgents] = useState([]);
  const [departments, setDepartments] = useState([]);

  const mapContainer = useRef(null);
  const map = useRef(null);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_comments')
        .select(`
          *,
          user:user_id (
            first_name,
            last_name,
            roles(name)
          )
        `)
        .eq('complaint_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchFieldAgents = async (departmentId = null) => {
    try {
      // Use the department from the complaint if not provided
      const targetDepartmentId = departmentId || complaint?.department_id;
      
      // Build the query step by step to avoid issues
      let query = supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          official_position,
          department_id,
          role_id,
          roles!inner(name)
        `);
      
      // First filter by role
      query = query.eq('roles.name', 'Field Agent');
      
      // Then filter by department if we have one
      if (targetDepartmentId) {
        query = query.eq('department_id', targetDepartmentId);
      }

      // Execute the query (no active column filtering to avoid errors)
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching field agents:', error);
        throw error;
      }
      
      console.log('Fetched field agents:', data);
      setFieldAgents(data || []);
      
    } catch (error) {
      console.error('Error fetching field agents:', error);
      setFieldAgents([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const calculateResolutionTime = (createdAt, resolvedAt) => {
    const diffInMs = resolvedAt.getTime() - createdAt.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInDays > 0) {
      const remainingHours = diffInHours % 24;
      return remainingHours > 0 ? `${diffInDays}d ${remainingHours}h` : `${diffInDays}d`;
    } else if (diffInHours > 0) {
      const remainingMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
      return remainingMinutes > 0 ? `${diffInHours}h ${remainingMinutes}m` : `${diffInHours}h`;
    } else {
      const minutes = Math.floor(diffInMs / (1000 * 60));
      return `${minutes}m`;
    }
  };

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
        
        // Fetch field agents and departments if user is admin
        if (userData.roles?.name === 'Super Admin' || 
            userData.roles?.name === 'Department Admin') {
          await fetchDepartments();
          // fetchFieldAgents will be called after complaint is loaded to filter by department
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load complaint details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchComplaintAndUser();
  }, [id, navigate]);

  // Fetch field agents when complaint is loaded (to filter by department)
  useEffect(() => {
    if (complaint && user && (user.roles?.name === 'Super Admin' || user.roles?.name === 'Department Admin')) {
      fetchFieldAgents(complaint.department_id);
    }
  }, [complaint?.department_id, user?.roles?.name]);

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

  // Reinitialize map when status changes to update marker color
  useEffect(() => {
    if (complaint && map.current) {
      // Update marker color based on new status
      const marker = Object.values(map.current._layers).find(layer => layer instanceof L.Marker);
      if (marker) {
        const colors = {
          'open': '#ef4444',
          'in_progress': '#f59e0b', 
          'resolved': '#10b981'
        };
        
        const newIcon = L.divIcon({
          className: 'custom-complaint-marker',
          html: `
            <div style="
              background-color: ${colors[complaint.status] || colors.open};
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 12px;
            ">
              📍
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        
        marker.setIcon(newIcon);
        
        // Update popup content
        const lat = marker.getLatLng().lat;
        const lng = marker.getLatLng().lng;
        const popupContent = `
          <div style="min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${complaint.title || 'Complaint'}</h3>
            ${complaint.locationName ? `<p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Location: ${complaint.locationName}</p>` : ''}
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Status: <span style="font-weight: bold; color: ${colors[complaint.status] || colors.open};">${complaint.status?.replace('_', ' ').toUpperCase()}</span></p>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Category: ${complaint.categories?.name || 'Unknown'}</p>
            <p style="margin: 0; font-size: 11px; color: #888;">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</p>
          </div>
        `;
        marker.setPopupContent(popupContent);
      }
    }
  }, [complaint?.status]);

  const initializeMap = () => {
    if (!complaint || !mapContainer.current) return;
    
    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    
    let lat = null, lng = null;
    
    // Enhanced location parsing with better error handling
    try {
      console.log('Parsing location from complaint:', { 
        parsedLocation: complaint.parsedLocation, 
        location: complaint.location,
        coordinates: complaint.coordinates 
      });
      
      // First try the parsedLocation
      if (complaint.parsedLocation && complaint.parsedLocation.latitude && complaint.parsedLocation.longitude) {
        lat = parseFloat(complaint.parsedLocation.latitude);
        lng = parseFloat(complaint.parsedLocation.longitude);
        console.log('Using parsedLocation:', { lat, lng });
      } 
      // Fallback to original location parsing
      else if (complaint.location) {
        if (typeof complaint.location === 'string') {
          // Handle PostGIS POINT format
          const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)\s*\)/i);
          if (pointMatch && pointMatch.length >= 3) {
            lng = parseFloat(pointMatch[1]);
            lat = parseFloat(pointMatch[2]);
            console.log('Parsed from POINT string:', { lat, lng });
          }
        } else if (typeof complaint.location === 'object' && complaint.location !== null) {
          // Handle GeoJSON format
          if (complaint.location.type === 'Point' && Array.isArray(complaint.location.coordinates)) {
            [lng, lat] = complaint.location.coordinates.map(coord => parseFloat(coord));
            console.log('Parsed from GeoJSON:', { lat, lng });
          }
          // Handle object properties
          else if (complaint.location.latitude !== undefined && complaint.location.longitude !== undefined) {
            lat = parseFloat(complaint.location.latitude);
            lng = parseFloat(complaint.location.longitude);
            console.log('Parsed from lat/lng object:', { lat, lng });
          } else if (complaint.location.lat !== undefined && complaint.location.lng !== undefined) {
            lat = parseFloat(complaint.location.lat);
            lng = parseFloat(complaint.location.lng);
            console.log('Parsed from lat/lng properties:', { lat, lng });
          } else if (Array.isArray(complaint.location.coordinates)) {
            [lng, lat] = complaint.location.coordinates.map(coord => parseFloat(coord));
            console.log('Parsed from coordinates array:', { lat, lng });
          }
        }
      } 
      // Additional fallbacks
      else if (complaint.coordinates && Array.isArray(complaint.coordinates)) {
        [lng, lat] = complaint.coordinates.map(coord => parseFloat(coord));
        console.log('Parsed from direct coordinates:', { lat, lng });
      }
      // Check for direct lat/lng properties
      else if (complaint.latitude !== undefined && complaint.longitude !== undefined) {
        lat = parseFloat(complaint.latitude);
        lng = parseFloat(complaint.longitude);
        console.log('Using direct lat/lng properties:', { lat, lng });
      }
      
      // Validate coordinates
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid or missing coordinates:', { 
          lat, lng, 
          latType: typeof lat, 
          lngType: typeof lng,
          originalLocation: complaint.location 
        });
        
        // Show error message in map container
        if (mapContainer.current) {
          mapContainer.current.innerHTML = `
            <div style="
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100%; 
              background-color: #f3f4f6; 
              color: #6b7280; 
              text-align: center;
              padding: 20px;
            ">
              <div>
                <svg style="width: 48px; height: 48px; margin: 0 auto 16px;" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
                <p style="margin: 0; font-size: 14px;">Location data not available</p>
                <p style="margin: 8px 0 0; font-size: 12px;">The complaint location could not be displayed on the map.</p>
              </div>
            </div>
          `;
        }
        return;
      }
      
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        console.warn('Coordinates out of valid range:', { lat, lng });
        return;
      }
      
      console.log('Successfully parsed coordinates:', { lat, lng });
      
      // Create Leaflet map with better options
      map.current = L.map(mapContainer.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true
      });
      
      // Add multiple tile layer options for better coverage
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      });
      
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri © Maxar',
        maxZoom: 19
      });
      
      // Add default layer
      osmLayer.addTo(map.current);
      
      // Add layer control
      const baseLayers = {
        "Street Map": osmLayer,
        "Satellite": satelliteLayer
      };
      L.control.layers(baseLayers).addTo(map.current);
      
      // Create custom marker icon based on complaint status
      const getMarkerIcon = (status) => {
        const colors = {
          'open': '#ef4444', // red
          'in_progress': '#f59e0b', // amber
          'resolved': '#10b981' // green
        };
        
        return L.divIcon({
          className: 'custom-complaint-marker',
          html: `
            <div style="
              background-color: ${colors[status] || colors.open};
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 12px;
            ">
              📍
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
      };
      
      // Add marker with custom icon
      const marker = L.marker([lat, lng], {
        icon: getMarkerIcon(complaint.status)
      }).addTo(map.current);
      
      // Add popup with complaint info
      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${complaint.title || 'Complaint'}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Status: <span style="font-weight: bold; color: ${complaint.status === 'resolved' ? '#10b981' : complaint.status === 'in_progress' ? '#f59e0b' : '#ef4444'};">${complaint.status?.replace('_', ' ').toUpperCase()}</span></p>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Category: ${complaint.categories?.name || 'Unknown'}</p>
          <p style="margin: 0; font-size: 11px; color: #888;">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</p>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      
      // Get location name if not available
      if (!complaint.locationName) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
          headers: {
            'User-Agent': 'ComplaintManagementSystem/1.0'
          }
        })
          .then(response => response.json())
          .then(data => {
            if (data && data.display_name) {
              setComplaint(prev => ({
                ...prev,
                locationName: data.display_name
              }));
              
              // Update popup with location name
              const updatedPopupContent = `
                <div style="min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${complaint.title || 'Complaint'}</h3>
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Location: ${data.display_name}</p>
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Status: <span style="font-weight: bold; color: ${complaint.status === 'resolved' ? '#10b981' : complaint.status === 'in_progress' ? '#f59e0b' : '#ef4444'};">${complaint.status?.replace('_', ' ').toUpperCase()}</span></p>
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Category: ${complaint.categories?.name || 'Unknown'}</p>
                  <p style="margin: 0; font-size: 11px; color: #888;">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</p>
                </div>
              `;
              marker.setPopupContent(updatedPopupContent);
            }
          })
          .catch(err => console.warn('Error getting location name:', err));
      }
      
      // Fit map to show the marker with some padding
      setTimeout(() => {
        if (map.current) {
          map.current.setView([lat, lng], 16);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error initializing map:', error);
      
      // Show error message in map container
      if (mapContainer.current) {
        mapContainer.current.innerHTML = `
          <div style="
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100%; 
            background-color: #f3f4f6; 
            color: #ef4444; 
            text-align: center;
            padding: 20px;
          ">
            <div>
              <svg style="width: 48px; height: 48px; margin: 0 auto 16px;" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <p style="margin: 0; font-size: 14px;">Map initialization failed</p>
              <p style="margin: 8px 0 0; font-size: 12px;">Unable to display the location map.</p>
            </div>
          </div>
        `;
      }
    }
  };

  const fetchComplaintDetails = async (id) => {
    try {
      console.log('Fetching complaint details for ID:', id);
      
      // Fetch the complaint with all related data
      const { data: comp, error: compErr } = await supabase
        .from('complaints')
        .select(`
          *, 
          categories (id, name, icon, severity_level, response_time),
          departments (id, name, contact_email),
          reporter:users!complaints_reported_by_fkey (id, first_name, last_name, email, phone_number),
          assignee:users!complaints_assigned_to_fkey (id, first_name, last_name, email, official_position, roles(name))
        `)
        .eq('id', id)
        .single();
        
      if (compErr) {
        console.error('Error fetching complaint:', compErr);
        throw compErr;
      }

      console.log('Fetched complaint data:', comp);

      // Parse the complaint data and set additional fields
      let reported = null;
      let assigned = null;

      if (comp.reporter && !comp.anonymous) {
        reported = comp.reporter;
      }

      if (comp.assignee) {
        assigned = comp.assignee;
      }

      // Fetch available departments for assignment (if user is admin)
      let availableDepartments = [];
      if (user && (user.roles?.name === 'Super Admin' || user.roles?.name === 'Department Admin')) {
        const { data: departments } = await supabase
          .from('departments')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        availableDepartments = departments || [];
      }

      const imageUrls = (comp.images || []).map(path =>
        supabase.storage.from('complaint-images').getPublicUrl(path).data.publicUrl
      );

      // Parse location data properly
      const parsedLocation = parseComplaintLocation(comp);

      const enhancedComplaint = {
        ...comp,
        reported_by_user: reported,
        assigned_to_user: assigned,
        parsedLocation: parsedLocation,
        imageUrls,
        resolutionTime: comp.resolved_at && comp.created_at ? 
          calculateResolutionTime(new Date(comp.created_at), new Date(comp.resolved_at)) : null,
        availableDepartments
      };

      setComplaint(enhancedComplaint);
      
    } catch (error) {
      console.error('Error in fetchComplaintDetails:', error);
      setError(error.message || 'Failed to fetch complaint details');
    }
  };

  const parseComplaintLocation = (comp) => {
    // Enhanced location parsing to handle multiple formats
    let locationData = null;
    
    try {
      console.log('Parsing location from complaint:', { location: comp.location, lat: comp.latitude, lng: comp.longitude });
      
      // Try using the utility function first
      if (comp.location && typeof comp.location === 'string') {
        try {
          locationData = parseLocation(comp.location);
          if (locationData && locationData.latitude && locationData.longitude) {
            console.log('Successfully parsed with utility function:', locationData);
            return locationData;
          }
        } catch (utilError) {
          console.warn('Utility function failed, trying manual parsing:', utilError);
        }
      }
      
      if (comp.location) {
        // Handle PostGIS Point format (string)
        if (typeof comp.location === 'string') {
          // Format: "POINT(longitude latitude)"
          const pointMatch = comp.location.match(/POINT\s*\(\s*([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)\s*\)/i);
          if (pointMatch && pointMatch.length >= 3) {
            const longitude = parseFloat(pointMatch[1]);
            const latitude = parseFloat(pointMatch[2]);
            if (!isNaN(latitude) && !isNaN(longitude)) {
              locationData = { latitude, longitude };
            }
          }
        }
        // Handle GeoJSON Point format
        else if (typeof comp.location === 'object' && comp.location.type === 'Point' && 
                 Array.isArray(comp.location.coordinates) && comp.location.coordinates.length === 2) {
          const [longitude, latitude] = comp.location.coordinates.map(coord => parseFloat(coord));
          if (!isNaN(latitude) && !isNaN(longitude)) {
            locationData = { latitude, longitude };
          }
        }
        // Handle object with latitude/longitude properties
        else if (typeof comp.location === 'object') {
          if (comp.location.latitude !== undefined && comp.location.longitude !== undefined) {
            const latitude = parseFloat(comp.location.latitude);
            const longitude = parseFloat(comp.location.longitude);
            if (!isNaN(latitude) && !isNaN(longitude)) {
              locationData = { latitude, longitude };
            }
          } else if (comp.location.lat !== undefined && comp.location.lng !== undefined) {
            const latitude = parseFloat(comp.location.lat);
            const longitude = parseFloat(comp.location.lng);
            if (!isNaN(latitude) && !isNaN(longitude)) {
              locationData = { latitude, longitude };
            }
          }
        }
      } 
      // Handle direct latitude/longitude properties on complaint
      else if (comp.latitude !== undefined && comp.longitude !== undefined) {
        const latitude = parseFloat(comp.latitude);
        const longitude = parseFloat(comp.longitude);
        if (!isNaN(latitude) && !isNaN(longitude)) {
          locationData = { latitude, longitude };
        }
      }
      
      // Validate coordinates are within valid ranges
      if (locationData) {
        const { latitude, longitude } = locationData;
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          console.warn('Invalid coordinates detected:', locationData);
          locationData = null;
        }
      }
      
    } catch (error) {
      console.error('Error parsing location data:', error);
      locationData = null;
    }
    
    console.log('Parsed location data:', { original: comp.location, parsed: locationData });
    return locationData;
  };

  // Fix: Move status update logic into a function
  const handleStatusChange = async (newStatus) => {
    if (statusUpdating) return;

    try {
      setStatusUpdating(true);
      
      console.log('Attempting to update status to:', newStatus, 'for complaint ID:', complaint.id);
      
      // Try using RPC function first (most reliable)
      try {
        console.log('Attempting RPC function update...');
        const { data, error } = await supabase.rpc('simple_update_complaint_status', {
          complaint_id_param: parseInt(complaint.id),
          new_status: newStatus
        });
        
        if (error) {
          console.warn('RPC function failed:', error);
          throw error;
        }
        
        console.log('RPC function update successful:', data);
        
      } catch (rpcError) {
        console.warn('RPC failed, trying direct update:', rpcError);
        
        // Fallback to direct update with minimal fields
        const updates = { 
          status: newStatus,
          updated_at: new Date().toISOString()
        };
        
        if (newStatus === 'resolved') {
          updates.resolved_at = new Date().toISOString();
        } else if (newStatus === 'open') {
          updates.resolved_at = null;
        }
        
        console.log('Direct update payload:', updates);
        
        // Use simple update without select to avoid column issues
        const { error: directError } = await supabase
          .from('complaints')
          .update(updates)
          .eq('id', parseInt(complaint.id));
        
        if (directError) {
          console.error('Direct update failed:', {
            error: directError,
            code: directError.code,
            message: directError.message,
            details: directError.details,
            hint: directError.hint
          });
          throw directError;
        }
        
        console.log('Direct update successful');
      }
      
      // Try to record status change in complaint_history table (optional)
      try {
        const historyData = {
          complaint_id: parseInt(complaint.id),
          status: newStatus,
          changed_by: user.id,
          notes: `Status changed to ${getStatusText(newStatus)}`,
          created_at: new Date().toISOString()
        };
        
        console.log('Adding history record:', historyData);
        
        const { error: historyError } = await supabase
          .from('complaint_history')
          .insert(historyData);
        
        if (historyError) {
          console.warn('Error recording history (non-critical):', historyError);
        } else {
          console.log('History recorded successfully');
        }
      } catch (historyError) {
        console.warn('History recording failed (non-critical):', historyError);
      }
      
      // Update local state optimistically
      setComplaint(prev => {
        const currentTime = new Date().toISOString();
        const updated = {
          ...prev,
          status: newStatus,
          updated_at: currentTime,
          resolved_at: newStatus === 'resolved' ? currentTime : (newStatus === 'open' ? null : prev.resolved_at)
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
      
      // Try to add system comment (optional)
      try {
        await addSystemComment(`Status changed to ${getStatusText(newStatus)}`);
      } catch (commentError) {
        console.warn('Failed to add system comment (non-critical):', commentError);
      }
      
      // Refresh from DB and ensure state matches persisted value
      try {
        await fetchComplaintDetails(complaint.id);
        await fetchComments();
      } catch (refreshError) {
        console.warn('Failed to refresh complaint data (non-critical):', refreshError);
      }
      // Final assert: if DB returned stale status, set explicitly to requested
      setComplaint(prev => {
        if (!prev) return prev;
        if (prev.status !== newStatus) {
          return { ...prev, status: newStatus };
        }
        return prev;
      });
      alert(`Status successfully updated to ${getStatusText(newStatus)}`);
      
    } catch (error) {
      console.error('Error updating status:', error);
      let errorMessage = 'Please try again.';
      
      // Handle specific error types
      if (error.message && (
        error.message.includes('column "active" does not exist') ||
        error.code === '42703'
      )) {
        errorMessage = 'Database schema issue detected. Please run the database fix script.';
        console.error('Active column missing. Run fix_active_column_issue.sql script.');
      } else if (error.message && (
        error.message.includes('function') ||
        error.message.includes('does not exist') ||
        error.message.includes('permission denied') ||
        error.message.includes('RLS')
      )) {
        errorMessage = 'Database configuration issue. Please run the database fix script or contact administrator.';
        console.error('Database function or permission issue. Run the database fix script.');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Failed to update status: ${errorMessage}`);
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
      
      // Try using RPC function first
      try {
        const { data, error } = await supabase.rpc('safe_update_complaint', {
          complaint_id_param: parseInt(complaint.id),
          status_param: newStatus,
          assigned_to_param: user.id,
          updated_at_param: new Date().toISOString()
        });

        if (error) throw error;
        
        console.log('Assignment updated via RPC:', data);
        
      } catch (rpcError) {
        console.warn('RPC assignment failed, trying direct update:', rpcError);
        
        // Fallback to direct update
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
      }
      
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
      
      // Update local state
      setComplaint(prev => ({
        ...prev,
        assigned_to: user.id,
        assigned_to_user: user,
        status: newStatus
      }));
      
      // Refresh the complaint data from the database to ensure consistency
      try {
        await fetchComplaintDetails(complaint.id);
        await fetchComments(); // Refresh comments to show new system comment
      } catch (refreshError) {
        console.warn('Failed to refresh complaint data (non-critical):', refreshError);
      }
      
    } catch (error) {
      console.error('Error assigning complaint:', error);
      let errorMessage = 'Please try again.';
      
      // Handle specific error types
      if (error.message && error.message.includes('column "active" does not exist')) {
        errorMessage = 'Database configuration issue. Please run the database fix script.';
        console.error('Active column missing in assignment operation.');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Failed to assign complaint: ${errorMessage}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAssignToFieldAgent = async (agentId) => {
    try {
      if (!agentId) return;
      
      setStatusUpdating(true);
      
      const selectedAgent = fieldAgents.find(agent => agent.id === agentId);
      if (!selectedAgent) {
        throw new Error('Selected field agent not found');
      }

      console.log('Attempting to assign agent:', selectedAgent, 'to complaint ID:', complaint.id);

      // Update original status if needed
      const previousStatus = complaint.status;
      const newStatus = complaint.status === 'open' ? 'in_progress' : complaint.status;
      
      // Try RPC function first
      try {
        console.log('Attempting RPC function assignment...');
        const { data, error } = await supabase.rpc('safe_update_complaint', {
          complaint_id_param: parseInt(complaint.id),
          status_param: newStatus,
          assigned_to_param: agentId
        });
        
        if (error) {
          console.warn('RPC assignment failed:', error);
          throw error;
        }
        
        console.log('RPC assignment successful:', data);
        
      } catch (rpcError) {
        console.warn('RPC failed, trying direct assignment:', rpcError);
        
        // Fallback to direct update without select to avoid column issues
        const updates = { 
          assigned_to: agentId,
          status: newStatus,
          updated_at: new Date().toISOString()
        };
        
        console.log('Direct assignment payload:', updates);
        
        const { error: directError } = await supabase
          .from('complaints')
          .update(updates)
          .eq('id', parseInt(complaint.id));
        
        if (directError) {
          console.error('Direct assignment error details:', {
            error: directError,
            code: directError.code,
            message: directError.message,
            details: directError.details,
            hint: directError.hint
          });
          throw directError;
        }
        
        console.log('Direct assignment successful');
      }
      
      // Try to record assignment in complaint_history for tracking (optional)
      try {
        const historyData = {
          complaint_id: parseInt(complaint.id),
          status: newStatus,
          changed_by: user.id,
          notes: `Assigned to field agent ${selectedAgent.first_name} ${selectedAgent.last_name}`,
          created_at: new Date().toISOString()
        };
        
        console.log('Adding assignment history:', historyData);
        
        const { error: historyError } = await supabase
          .from('complaint_history')
          .insert(historyData);
        
        if (historyError) {
          console.warn('Error recording assignment history (non-critical):', historyError);
        } else {
          console.log('Assignment history recorded successfully');
        }
      } catch (historyError) {
        console.warn('Assignment history recording failed (non-critical):', historyError);
      }
      
      // Try to add system comment (optional)
      try {
        await addSystemComment(`Complaint assigned to field agent ${selectedAgent.first_name} ${selectedAgent.last_name}`);
      } catch (commentError) {
        console.warn('Failed to add assignment comment (non-critical):', commentError);
      }
      
      // Update local state
      setComplaint(prev => ({
        ...prev,
        assigned_to: agentId,
        assigned_to_user: selectedAgent,
        status: newStatus
      }));
      
      // Refresh the complaint data from the database to ensure consistency
      try {
        await fetchComplaintDetails(complaint.id);
        await fetchComments(); // Refresh comments to show new system comment
      } catch (refreshError) {
        console.warn('Failed to refresh complaint data (non-critical):', refreshError);
      }
      
      alert(`Successfully assigned complaint to ${selectedAgent.first_name} ${selectedAgent.last_name}`);
      
    } catch (error) {
      console.error('Error assigning complaint to field agent:', error);
      let errorMessage = 'Please try again.';
      
      // Handle specific error types  
      if (error.message && (
        error.message.includes('column "active" does not exist') ||
        error.code === '42703'
      )) {
        errorMessage = 'Database schema issue detected. Please run the database fix script.';
        console.error('Active column missing in field agent assignment. Run fix_active_column_issue.sql script.');
      } else if (error.message && (
        error.message.includes('function') ||
        error.message.includes('does not exist') ||
        error.message.includes('permission denied') ||
        error.message.includes('RLS')
      )) {
        errorMessage = 'Database configuration issue. Please run the database fix script or contact administrator.';
        console.error('Database function or permission issue in field agent assignment.');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Failed to assign complaint: ${errorMessage}`);
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
      
      // Update local state
      setComplaint(prev => ({
        ...prev,
        department_id: parseInt(departmentId),
        departments: { ...prev.departments, id: parseInt(departmentId), name: departmentName }
      }));
      
      // Refresh the complaint data from the database to ensure consistency
      try {
        await fetchComplaintDetails(complaint.id);
        await fetchComments(); // Refresh comments to show new system comment
        
        // Also refresh field agents for the new department
        if (user && (user.roles?.name === 'Super Admin' || user.roles?.name === 'Department Admin')) {
          await fetchFieldAgents(parseInt(departmentId));
        }
      } catch (refreshError) {
        console.warn('Failed to refresh complaint data (non-critical):', refreshError);
      }
      
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
          complaint_id: parseInt(id),
          user_id: null,
          content: message,
          is_system: true,
          is_internal: false,
          created_at: new Date().toISOString()
        }]);
        
      if (error) {
        console.warn('Error adding system comment (non-critical):', error);
        return; // Don't throw, just return
      }
      
      await fetchComments();
    } catch (error) {
      console.warn('Error adding system comment (non-critical):', error);
      // Don't throw the error, just log it as it's not critical
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
          complaint_id: parseInt(id),
          user_id: user.id,
          content: comment.trim(),
          is_system: false,
          is_internal: false,
          created_at: new Date().toISOString()
        }]);
      
      if (error) {
        console.error('Error adding comment:', error);
        throw error;
      }
      
      setComment('');
      await fetchComments();
      
    } catch (error) {
      console.error('Error submitting comment:', error);
      let errorMessage = 'Failed to add comment. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
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
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-2 text-gray-400" />
                      {complaint.departments ? (
                        <span>
                          Department: {complaint.departments.name}
                        </span>
                      ) : (
                        <span>No department assigned</span>
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
                    Location Details
                  </h2>
                  
                  {/* Map Container with improved styling */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div 
                      ref={mapContainer} 
                      className="bg-gray-100 h-80 w-full relative"
                      style={{ minHeight: '320px' }}
                    >
                      {/* Loading overlay */}
                      {!map.current && (
                        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
                          <div className="text-center">
                            <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading map...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Location Information Panel */}
                    <div className="bg-white px-4 py-3 border-t border-gray-200">
                      <div className="space-y-2">
                        {/* Location Name */}
                        {complaint.locationName && (
                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">Address</p>
                              <p className="text-sm text-gray-600">{complaint.locationName}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Coordinates */}
                        {complaint.parsedLocation && complaint.parsedLocation.latitude && complaint.parsedLocation.longitude && (
                          <div className="flex items-start">
                            <div className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0">
                              <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Coordinates</p>
                              <p className="text-sm text-gray-600 font-mono">
                                {complaint.parsedLocation.latitude.toFixed(6)}, {complaint.parsedLocation.longitude.toFixed(6)}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Status indicator */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center text-xs text-gray-500">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              complaint.status === 'resolved' ? 'bg-green-500' : 
                              complaint.status === 'in_progress' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                            Location Status: Active
                          </div>
                          
                          {/* Quick action buttons */}
                          <div className="flex space-x-1">
                            {complaint.parsedLocation && (
                              <>
                                <button
                                  onClick={() => {
                                    const { latitude, longitude } = complaint.parsedLocation;
                                    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                                >
                                  Open in Google Maps
                                </button>
                                <button
                                  onClick={() => {
                                    if (map.current) {
                                      map.current.setView([complaint.parsedLocation.latitude, complaint.parsedLocation.longitude], 18);
                                    }
                                  }}
                                  className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50"
                                >
                                  Zoom In
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Fallback for when location is not available */}
                  {(!complaint.parsedLocation || !complaint.parsedLocation.latitude || !complaint.parsedLocation.longitude) && (
                    <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Location Not Available</h3>
                      <p className="text-gray-500 mb-4">
                        The location data for this complaint is not available or could not be parsed.
                      </p>
                      {complaint.description && (
                        <p className="text-sm text-gray-600">
                          Please check the complaint description for any location details provided by the reporter.
                        </p>
                      )}
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
                        <div className="space-y-3">
                          {/* Assign to me button for field agents */}
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

                          {/* Assign to field agent dropdown for admins */}
                          {(user.roles?.name === 'Super Admin' || user.roles?.name === 'Department Admin') && fieldAgents.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Or assign to field agent:
                                {complaint.department_id && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    (Department agents only)
                                  </span>
                                )}
                              </label>
                              <select
                                onChange={(e) => e.target.value && handleAssignToFieldAgent(e.target.value)}
                                disabled={statusUpdating}
                                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                defaultValue=""
                              >
                                <option value="">Select field agent...</option>
                                {fieldAgents.map(agent => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.first_name} {agent.last_name}
                                    {agent.official_position && ` (${agent.official_position})`}
                                    {agent.department_id && ` - Dept: ${agent.department_id}`}
                                  </option>
                                ))}
                              </select>
                              <p className="text-xs text-gray-500 mt-1">
                                {fieldAgents.length} field agent{fieldAgents.length !== 1 ? 's' : ''} available
                                {complaint.department_id ? ` in department ${complaint.department_id}` : ' (all departments)'}
                              </p>
                            </div>
                          )}
                        </div>
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
                          {departments.map(dept => (
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
                    
                    {/* Edit button - only show for complaint reporter or admins */}
                    {(complaint.reported_by === user.id || isAdmin) && (
                      <button 
                        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => navigate(`/edit-complaint/${complaint.id}`)}
                      >
                        <Edit className="h-5 w-5 mr-2" />
                        Edit Complaint
                      </button>
                    )}
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
