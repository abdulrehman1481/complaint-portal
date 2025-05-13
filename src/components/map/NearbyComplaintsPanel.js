import React, { useState } from 'react';
import { X, Ruler, Calendar, MapPin } from 'lucide-react';

const NearbyComplaintsPanel = ({ info, onClose, onChangeRadius, onSelectComplaint }) => {
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
                  onClick={() => onSelectComplaint && onSelectComplaint(complaint)}
                  className="p-2 bg-gray-50 rounded hover:bg-blue-50 cursor-pointer"
                >
                  <div className="font-medium text-sm">{complaint.title}</div>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(complaint.created_at)}
                    <div className="mx-1">•</div>
                    <MapPin className="h-3 w-3 mr-1" />
                    {complaint.categories?.name || 'Uncategorized'}
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