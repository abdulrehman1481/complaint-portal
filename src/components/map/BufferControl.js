import React, { useState } from 'react';
import { X, Circle } from 'lucide-react';

const BufferControl = ({ createBuffer, onClose, defaultDistance = 500 }) => {
  const [distance, setDistance] = useState(defaultDistance);
  const [bufferType, setBufferType] = useState('standard');
  
  const handleApplyBuffer = () => {
    createBuffer(distance, bufferType);
  };
  
  return (
    <div className="absolute bottom-20 right-6 w-64 bg-white rounded-lg shadow-lg p-4 z-20">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium flex items-center">
          <Circle className="h-4 w-4 mr-1.5 text-blue-500" />
          Buffer Analysis
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">Buffer Distance (meters)</label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min="50"
            max="10000"
            value={distance}
            onChange={(e) => setDistance(parseInt(e.target.value) || 50)}
            className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      
      <div className="mb-3">
        <input
          type="range"
          min="50"
          max="5000"
          step="50"
          value={distance}
          onChange={(e) => setDistance(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
          <span>50m</span>
          <span>5km</span>
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-xs text-gray-600 mb-1">Buffer Type</label>
        <select
          value={bufferType}
          onChange={(e) => setBufferType(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="standard">Standard (Equal distance)</option>
          <option value="variable">Variable (Based on priority)</option>
        </select>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleApplyBuffer}
          className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
        >
          Apply Buffer
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default BufferControl;
