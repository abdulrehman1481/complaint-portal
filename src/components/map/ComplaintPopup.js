import React from 'react';
import { Calendar, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

const ComplaintPopup = ({ complaint, isVisible, onClose, onViewDetails }) => {
  if (!isVisible || !complaint) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'text-red-600 bg-red-100';
      case 'in_progress': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in_progress': return <Calendar className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {complaint.title || 'Complaint Details'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
              {getStatusIcon(complaint.status)}
              <span className="ml-1 capitalize">{complaint.status?.replace('_', ' ')}</span>
            </div>
          </div>

          <p className="text-gray-700 text-sm">
            {complaint.description || 'No description provided'}
          </p>

          <div className="flex items-center text-sm text-gray-500">
            <MapPin className="h-4 w-4 mr-1" />
            <span>
              {complaint.locationName || `${complaint.latitude?.toFixed(6)}, ${complaint.longitude?.toFixed(6)}`}
            </span>
          </div>

          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-1" />
            <span>{formatDate(complaint.created_at)}</span>
          </div>

          {complaint.category && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Category:</span> {complaint.category}
            </div>
          )}

          <div className="flex space-x-2 pt-4">
            <button
              onClick={() => onViewDetails && onViewDetails(complaint)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintPopup;
