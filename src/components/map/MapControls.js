import React from 'react';
import { 
  Layers, 
  MapPin, 
  Thermometer, 
  Grid, 
  Pencil, 
  Circle, 
  Square, 
  Activity,
  Ruler,
  Cpu,
  X
} from 'lucide-react';

/**
 * Component for map control buttons that float on the map
 */
const MapControls = ({ 
  mapConfig, 
  toggleBaseMapStyle, 
  toggleMapLayer,
  toggleDrawingMode,
  runSpatialAnalysis,
  isAdmin = false
}) => {
  return (
    <div className="flex flex-col space-y-2">
      {/* Map Layers Control Group - Available to all users */}
      <div className="bg-white rounded-md shadow-md">
        <div className="p-2">
          <button
            onClick={() => toggleMapLayer('clusters')}
            className={`w-8 h-8 flex items-center justify-center rounded-md ${
              mapConfig.showClusters ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Toggle complaint points"
          >
            <MapPin size={18} />
          </button>
        </div>
        
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => toggleMapLayer('heatmap')}
            className={`w-8 h-8 flex items-center justify-center rounded-md ${
              mapConfig.showHeatmap ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Toggle heatmap"
          >
            <Thermometer size={18} />
          </button>
        </div>
        
        {/* Show boundaries only to admins */}
        {isAdmin && (
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => toggleMapLayer('boundaries')}
              className={`w-8 h-8 flex items-center justify-center rounded-md ${
                mapConfig.showBoundaries ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Toggle department boundaries"
            >
              <Grid size={18} />
            </button>
          </div>
        )}
        
        {/* Show buffer layer only to admins */}
        {isAdmin && (
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => toggleMapLayer('buffers')}
              className={`w-8 h-8 flex items-center justify-center rounded-md ${
                mapConfig.showBuffers ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Toggle buffer zones"
            >
              <Layers size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Base Maps Control Group - Available to all users */}
      <div className="bg-white rounded-md shadow-md">
        <div className="p-2">
          <button
            onClick={() => toggleBaseMapStyle('streets')}
            className={`w-8 h-8 flex items-center justify-center rounded-md ${
              mapConfig.baseLayerType === 'streets' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Streets"
          >
            <span className="font-bold text-sm">S</span>
          </button>
        </div>
        
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => toggleBaseMapStyle('satellite')}
            className={`w-8 h-8 flex items-center justify-center rounded-md ${
              mapConfig.baseLayerType === 'satellite' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Satellite"
          >
            <span className="font-bold text-sm">A</span>
          </button>
        </div>
        
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => toggleBaseMapStyle('dark')}
            className={`w-8 h-8 flex items-center justify-center rounded-md ${
              mapConfig.baseLayerType === 'dark' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Dark"
          >
            <span className="font-bold text-sm">D</span>
          </button>
        </div>
        
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => toggleBaseMapStyle('light')}
            className={`w-8 h-8 flex items-center justify-center rounded-md ${
              mapConfig.baseLayerType === 'light' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Light"
          >
            <span className="font-bold text-sm">L</span>
          </button>
        </div>
      </div>

      {/* Drawing Tools - Only show for admins */}
      {isAdmin && (
        <div className="bg-white rounded-md shadow-md">
          <div className="p-2 border-b border-gray-100">
            <div className="text-xs text-center text-gray-500 font-medium mb-1">Draw</div>
          </div>
          <div className="p-2">
            <button
              onClick={() => toggleDrawingMode('point')}
              className={`w-8 h-8 flex items-center justify-center rounded-md ${
                mapConfig.drawingMode === 'point' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Draw Point"
            >
              <MapPin size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => toggleDrawingMode('polygon')}
              className={`w-8 h-8 flex items-center justify-center rounded-md ${
                mapConfig.drawingMode === 'polygon' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Draw Polygon"
            >
              <Square size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => toggleDrawingMode('circle')}
              className={`w-8 h-8 flex items-center justify-center rounded-md ${
                mapConfig.drawingMode === 'circle' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Draw Circle"
            >
              <Circle size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => toggleDrawingMode(null)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
              title="Cancel Drawing"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Analysis Tools - Only show for admins */}
      {isAdmin && (
        <div className="bg-white rounded-md shadow-md">
          <div className="p-2 border-b border-gray-100">
            <div className="text-xs text-center text-gray-500 font-medium mb-1">Analysis</div>
          </div>
          <div className="p-2">
            <button
              onClick={() => runSpatialAnalysis('countPoints')}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
              title="Count Points in Area"
            >
              <Cpu size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => runSpatialAnalysis('buffer')}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
              title="Create Buffer"
            >
              <Layers size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => runSpatialAnalysis('density')}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
              title="Density Analysis"
            >
              <Thermometer size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => runSpatialAnalysis('averageDistance')}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
              title="Distance Analysis"
            >
              <Ruler size={18} />
            </button>
          </div>
          
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => runSpatialAnalysis('clearAnalysis')}
              className="w-8 h-8 flex items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
              title="Clear Analysis"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapControls;
