import React, { useState } from 'react';
import { X, Ruler, Calendar, MapPin } from 'lucide-react';

const NearbyComplaintsPanel = ({ info, onClose, onChangeRadius }) => {
  // Move useState outside of conditional
  const [newRadius, setNewRadius] = useState(info?.radius || 1000);
  
  // Return null early if no info is provided
  if (!info) return null;
  
  const { count, radius, complaints } = info;
  
  const handleRadiusChange = (e) => {
    setNewRadius(parseInt(e.target.value, 10));
  };

  const applyRadius = () => {
    if (typeof onChangeRadius === 'function') {
      onChangeRadius(newRadius);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };

  // Function to get complaint category name
  const getCategoryName = (complaint) => {
    if (complaint.categories && complaint.categories.name) {
      return complaint.categories.name;
    }
    return 'Uncategorized';
  };

  // Function to get proper reporter name
  const getReporterName = (complaint) => {
    if (complaint.anonymous) return 'Anonymous User';
    if (complaint.reported_by_name) return complaint.reported_by_name;
    if (complaint.reported_by) return `User #${complaint.reported_by}`;
    return 'Unknown User';
  };

  return (
    <div className="absolute bottom-6 left-6 w-80 bg-white rounded-lg shadow-lg z-30 overflow-hidden">
      <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
        <h3 className="font-medium">Nearby Complaints ({count})</h3>
        <button onClick={onClose} className="text-white hover:text-blue-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Ruler className="h-5 w-5 text-gray-500" />
          <div className="flex-1">
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={newRadius}
              onChange={handleRadiusChange}
              className="w-full"
            />
          </div>
          <div className="text-sm font-medium">{newRadius}m</div>
          <button
            onClick={applyRadius}
            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
          >
            Apply
          </button>
        </div>
        
        <div className="max-h-60 overflow-y-auto">
          {complaints.length > 0 ? (
            <ul className="space-y-2">
              {complaints.map(complaint => (
                <li 
                  key={complaint.id}
                  onClick={() => window.dispatchEvent(new CustomEvent('selectComplaint', { 
                    detail: { complaint } 
                  }))}
                  className="p-2 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer"
                >
                  <div className="font-medium text-sm">{complaint.title || 'Untitled Complaint'}</div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(complaint.created_at)}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      {getCategoryName(complaint)}
                    </div>
                  </div>
                  <div className="mt-1 flex justify-between items-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      complaint.status === 'open' ? 'bg-red-100 text-red-800' :
                      complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {complaint.status === 'in_progress' ? 'In Progress' : 
                       complaint.status ? complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1) : 
                       'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {complaint.anonymous ? 'Anonymous' : 'Reported by ' + getReporterName(complaint)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No complaints found in this area
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NearbyComplaintsPanel;