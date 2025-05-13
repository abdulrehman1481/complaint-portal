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
            <h2 className="text-xl font-semibold text-gray-800">{complaint.title}</h2>
            
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
            {!complaint.anonymous && (
              <div className="flex items-center text-sm">
                <User size={16} className="text-gray-400 mr-2" />
                <span className="font-medium">Reported by:</span>
                <span className="ml-1">{complaint.reported_by_name || 'Unknown'}</span>
              </div>
            )}
            
            {/* Description */}
            <div className="mt-3">
              <div className="flex items-start">
                <MessageCircle size={16} className="text-gray-400 mr-2 mt-1" />
                <div>
                  <span className="font-medium text-sm">Description:</span>
                  <p className="mt-1 text-gray-700 text-sm whitespace-pre-wrap">
                    {complaint.description || 'No description provided.'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Location */}
            <div className="mt-3">
              <span className="font-medium text-sm">Location:</span>
              <p className="mt-1 text-gray-700 text-sm">
                {complaint.parsedLocation ? 
                  `${complaint.parsedLocation.latitude.toFixed(6)}, ${complaint.parsedLocation.longitude.toFixed(6)}` : 
                  'Location unavailable'
                }
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
                      href={image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={image} 
                        alt={`Complaint ${complaint.id} - image ${index + 1}`} 
                        className="w-full h-24 object-cover rounded border border-gray-200"
                      />
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
