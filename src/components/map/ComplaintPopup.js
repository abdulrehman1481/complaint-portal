import React from 'react';
import { X, MapPin, Calendar, MessageCircle, User } from 'lucide-react';

const ComplaintPopup = ({ complaint, onClose, isAdmin = false }) => {
  if (!complaint) return null;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Get status display class
  const getStatusClass = (status) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format status text for display
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status === 'in_progress' ? 'In Progress' : 
          status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Format location display with proper error handling
  const formatLocation = () => {
    // If there's a cached location name from reverse geocoding
    if (complaint.locationName) {
      // Show coordinates and location name
      if (complaint.coordinates && 
          Array.isArray(complaint.coordinates) && 
          complaint.coordinates.length >= 2 &&
          !isNaN(complaint.coordinates[0]) && 
          !isNaN(complaint.coordinates[1])) {
        
        // GeoJSON format is [longitude, latitude]
        const longitude = complaint.coordinates[0];
        const latitude = complaint.coordinates[1];
        
        return (
          <div>
            <div>{complaint.locationName}</div>
            <div className="text-xs text-gray-400 mt-1">
              ({latitude.toFixed(6)}, {longitude.toFixed(6)})
            </div>
          </div>
        );
      }
      
      // If we have parsedLocation as a backup
      if (complaint.parsedLocation && 
          complaint.parsedLocation.latitude !== undefined && 
          complaint.parsedLocation.longitude !== undefined &&
          !isNaN(complaint.parsedLocation.latitude) && 
          !isNaN(complaint.parsedLocation.longitude)) {
        
        const { latitude, longitude } = complaint.parsedLocation;
        return (
          <div>
            <div>{complaint.locationName}</div>
            <div className="text-xs text-gray-400 mt-1">
              ({latitude.toFixed(6)}, {longitude.toFixed(6)})
            </div>
          </div>
        );
      }
      
      return complaint.locationName;
    }
    
    // Fall back to previous location display logic
    // First try to use coordinates in GeoJSON format
    if (complaint.coordinates && 
        Array.isArray(complaint.coordinates) && 
        complaint.coordinates.length >= 2 &&
        !isNaN(complaint.coordinates[0]) && 
        !isNaN(complaint.coordinates[1])) {
      
      // For GeoJSON, format is [longitude, latitude]
      return `${complaint.coordinates[1].toFixed(6)}, ${complaint.coordinates[0].toFixed(6)}`;
    }
    
    // Try parsed location
    if (complaint.parsedLocation && 
        complaint.parsedLocation.latitude !== undefined && 
        complaint.parsedLocation.longitude !== undefined &&
        !isNaN(complaint.parsedLocation.latitude) && 
        !isNaN(complaint.parsedLocation.longitude)) {
      
      const { latitude, longitude } = complaint.parsedLocation;
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
    
    // If there's an address field with content
    if (complaint.address && complaint.address.trim()) {
      return complaint.address;
    }
    
    // Try to parse location string
    if (typeof complaint.location === 'string') {
      // Try to extract coordinates using regex
      const coordMatch = complaint.location.match(/[-+]?\d+\.\d+/g);
      if (coordMatch && coordMatch.length >= 2) {
        try {
          return `${parseFloat(coordMatch[0]).toFixed(6)}, ${parseFloat(coordMatch[1]).toFixed(6)}`;
        } catch (e) {
          console.warn('Error parsing coordinates from string:', e);
        }
      }
      
      // If WKT format
      const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)\s*\)/i);
      if (pointMatch && pointMatch.length >= 3) {
        try {
          return `${parseFloat(pointMatch[2]).toFixed(6)}, ${parseFloat(pointMatch[1]).toFixed(6)}`;
        } catch (e) {
          console.warn('Error parsing WKT point:', e);
        }
      }
      
      // Return the raw string if it's not too long
      if (complaint.location.length < 100) {
        return complaint.location;
      }
    }
    
    return 'Location information unavailable';
  };

  // Get reporter name - FIXED to handle different data structures
  const getReporterName = () => {
    if (complaint.anonymous) return 'Anonymous User';
    
    // Check all possible paths for user information
    if (complaint.reported_by_name) return complaint.reported_by_name;
    if (complaint.reporter && complaint.reporter.name) return complaint.reporter.name;
    if (complaint.reported_by_email) return complaint.reported_by_email;
    
    // If we just have a user ID
    if (complaint.reported_by) return `User #${complaint.reported_by}`;
    
    return 'Unknown User';
  };

  // Function to get proper image URL
  const getImageUrl = (image) => {
    if (!image) return null;
    
    // If already a full URL
    if (image.startsWith('http')) {
      return image;
    }
    
    // Check for environment variables
    if (process.env.REACT_APP_SUPABASE_URL) {
      return `${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/public/complaint-images/${image}`;
    }
    
    // Fallback to hardcoded URL if needed
    return `https://jlpoojswmseemptyvued.supabase.co/storage/v1/object/public/complaint-images/${image}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
          <h3 className="text-lg font-medium">Complaint Details</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-blue-100"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-800">{complaint.title || 'Untitled Complaint'}</h2>
            
            <div className="flex items-center mt-2">
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusClass(complaint.status)}`}>
                {formatStatus(complaint.status)}
              </span>
              
              <span className="text-sm text-gray-500 ml-2">
                ID: #{complaint.id}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {/* Category */}
            <div className="flex items-center text-sm">
              <MapPin size={16} className="text-gray-400 mr-2" />
              <span className="font-medium">Category:</span>
              <span className="ml-1">{complaint.categories?.name || 'Uncategorized'}</span>
            </div>
            
            {/* Date */}
            <div className="flex items-center text-sm">
              <Calendar size={16} className="text-gray-400 mr-2" />
              <span className="font-medium">Reported:</span>
              <span className="ml-1">{formatDate(complaint.created_at)}</span>
            </div>
            
            {/* Reporter */}
            <div className="flex items-center text-sm">
              <User size={16} className="text-gray-400 mr-2" />
              <span className="font-medium">Reported by:</span>
              <span className="ml-1">{getReporterName()}</span>
            </div>
            
            {/* Description */}
            <div className="mt-3">
              <div className="flex items-start">
                <MessageCircle size={16} className="text-gray-400 mr-2 mt-1" />
<div className="text-gray-700">
  <div className="mt-2">
    <div className="font-semibold">Description:</div>
    {complaint.description || "No description provided."}
  </div>
</div>
              </div>
            </div>
            
            {/* Location */}
            <div className="mt-3">
              <span className="font-medium text-sm">Location:</span>
              <p className="mt-1 text-gray-700 text-sm">
                {formatLocation()}
              </p>
            </div>
            
            {/* Images (if available) */}
            {complaint.images && complaint.images.length > 0 && (
              <div className="mt-4">
                <span className="font-medium text-sm">Images:</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {complaint.images.map((image, index) => (
                    <a 
                      key={index}
                      href={getImageUrl(image)} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block relative"
                    >
                      <div className="aspect-w-4 aspect-h-3 border border-gray-200 rounded overflow-hidden">
                        <img 
                          src={getImageUrl(image)} 
                          alt={`Complaint ${complaint.id} - image ${index + 1}`} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/150?text=Image+Not+Found";
                          }}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
          
          {isAdmin && (
            <button
              onClick={() => {
                onClose();
                window.location.href = `/admin/complaints/${complaint.id}`;
              }}
              className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit Complaint
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplaintPopup;