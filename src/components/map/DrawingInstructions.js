import React from 'react';
import { AlertCircle, Square, MapPin, Circle, Zap } from 'lucide-react';

const DrawingInstructions = ({ isActive, mode, instructions }) => {
  if (!isActive) return null;

  const getIcon = () => {
    switch (mode) {
      case 'polygon': return <Square className="h-5 w-5 mr-2 text-blue-500" />;
      case 'point': return <MapPin className="h-5 w-5 mr-2 text-blue-500" />;
      case 'circle': return <Circle className="h-5 w-5 mr-2 text-blue-500" />;
      case 'analysis': return <Zap className="h-5 w-5 mr-2 text-green-500" />;
      default: return <AlertCircle className="h-5 w-5 mr-2 text-blue-500" />;
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'polygon': return 'Drawing Polygon';
      case 'point': return 'Placing Point';
      case 'circle': return 'Creating Circle';
      case 'analysis': return 'Spatial Analysis';
      default: return 'Drawing Tool';
    }
  };

  const getDefaultInstructions = () => {
    switch (mode) {
      case 'polygon': 
        return 'Click to add points. Double-click or click the first point to complete.';
      case 'point': 
        return 'Click on the map to place a point.';
      case 'circle':
        return 'Click to place center, drag to set radius, then click again to finish.';
      case 'analysis':
        return 'Processing spatial analysis on selected area...';
      default:
        return 'Use the drawing tools to interact with the map.';
    }
  };

  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
      <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-blue-200 flex items-center">
        {getIcon()}
        <div>
          <p className="font-medium text-blue-700">{getTitle()}</p>
          <p className="text-sm text-gray-600">
            {instructions || getDefaultInstructions()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DrawingInstructions;
