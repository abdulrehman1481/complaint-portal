import React, { useState, useCallback, useMemo } from 'react';
import { 
  Settings, MapPin, Navigation, Target, Circle, Square, Grid, Zap,
  Activity, BarChart3, Layers, Thermometer, Lock 
} from 'lucide-react';
import { 
  canAccessDrawingTools, 
  canAccessSpatialAnalysis, 
  canAccessAnalysisTools,
  isAdmin 
} from '../../utils/userPermissions';

const MapControls = ({ 
  userLocation, 
  mapRef, 
  onDrawingModeChange, 
  onAnalysisRequest,
  onQuickAction,
  user 
}) => {
  const [isDrawingMenuOpen, setIsDrawingMenuOpen] = useState(false);
  const [customNearbyRadius, setCustomNearbyRadius] = useState(500);
  const [customBufferDistance, setCustomBufferDistance] = useState(300);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate user permissions
  const userIsAdmin = useMemo(() => isAdmin(user), [user]);
  const hasDrawingAccess = useMemo(() => canAccessDrawingTools(user), [user]);
  const hasAnalysisAccess = useMemo(() => canAccessSpatialAnalysis(user), [user]);

  const handleDrawingMode = useCallback(async (mode) => {
    if (!hasDrawingAccess) {
      alert('Drawing tools are restricted to administrators only.');
      return;
    }

    setIsProcessing(true);
    try {
      await onDrawingModeChange?.(mode);
    } catch (error) {
      console.error('Drawing mode error:', error);
      alert('Error activating drawing mode. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [hasDrawingAccess, onDrawingModeChange]);

  const handleAnalysis = useCallback(async (type) => {
    if (!hasAnalysisAccess) {
      alert('Spatial analysis is restricted to administrators only.');
      return;
    }

    setIsProcessing(true);
    try {
      await onAnalysisRequest?.(type);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Error performing analysis. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [hasAnalysisAccess, onAnalysisRequest]);

  const handleQuickAction = useCallback(async (action) => {
    if (action === 'nearbyAnalysis' || action === 'bufferAnalysis' || action === 'toggleHeatMap' || action === 'clearAll') {
      if (!hasAnalysisAccess) {
        alert('This feature is restricted to administrators only.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      if (action === 'nearbyAnalysis') {
        await onQuickAction?.(action, { radius: customNearbyRadius });
      } else if (action === 'bufferAnalysis') {
        await onQuickAction?.(action, { distance: customBufferDistance });
      } else {
        await onQuickAction?.(action);
      }
    } catch (error) {
      console.error('Quick action error:', error);
      alert('Error performing action. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [hasAnalysisAccess, onQuickAction, customNearbyRadius, customBufferDistance]);

  // Show controls only for users with appropriate permissions
  if (!hasDrawingAccess && !hasAnalysisAccess) {
    return (
      <div className="absolute bottom-4 right-4 z-[800] max-w-xs">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-3">
            <h3 className="text-sm font-bold flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Basic Map Controls
            </h3>
            {userLocation && (
              <p className="text-xs text-gray-100 mt-1 flex items-center">
                <MapPin className="w-3 h-3 mr-1" />
                Location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
          <div className="p-3">
            <div className="text-center text-gray-600">
              <Lock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm mb-2">Advanced Features Restricted</p>
              <p className="text-xs text-gray-500">
                Drawing tools and spatial analysis are available only to administrators.
              </p>
              {userLocation && (
                <div className="mt-3">
                  <button
                    onClick={() => handleQuickAction('centerOnUser')}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center mx-auto"
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    Center on Location
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enhanced admin controls
  return (
    <div className="absolute bottom-4 right-4 z-[800] max-w-xs">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3">
          <h3 className="text-sm font-bold flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            {userIsAdmin ? 'Admin Map Controls' : 'Map Controls'}
          </h3>
          {userLocation && (
            <p className="text-xs text-blue-100 mt-1 flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              Location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </p>
          )}
        </div>

        <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
          {/* Drawing Tools - Only for users with drawing access */}
          {hasDrawingAccess && (
            <div>
              <button
                onClick={() => setIsDrawingMenuOpen(!isDrawingMenuOpen)}
                className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 mb-2 hover:text-blue-600 transition-colors"
              >
                <span className="flex items-center">
                  <Grid className="w-3 h-3 mr-1" />
                  Drawing Tools
                </span>
                <span className={`transform transition-transform ${isDrawingMenuOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              
              {isDrawingMenuOpen && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDrawingMode('polygon')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Draw polygon for area analysis"
                  >
                    <Grid className="w-3 h-3 mr-1" />
                    Polygon
                  </button>
                  <button
                    onClick={() => handleDrawingMode('circle')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Draw circle for radius analysis"
                  >
                    <Circle className="w-3 h-3 mr-1" />
                    Circle
                  </button>
                  <button
                    onClick={() => handleDrawingMode('rectangle')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Draw rectangle for grid analysis"
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Rectangle
                  </button>
                  <button
                    onClick={() => handleDrawingMode('marker')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Place marker for reference"
                  >
                    <MapPin className="w-3 h-3 mr-1" />
                    Marker
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Analysis - Only for users with analysis access */}
          {hasAnalysisAccess && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                <Zap className="w-3 h-3 mr-1" />
                Quick Analysis
              </h4>
              <div className="space-y-2">
                {userLocation && (
                  <>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={customNearbyRadius}
                        onChange={(e) => setCustomNearbyRadius(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                        min="100"
                        max="5000"
                        step="100"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() => handleQuickAction('nearbyAnalysis')}
                        disabled={isProcessing}
                        className="flex-1 px-2 py-1.5 bg-indigo-500 text-white text-xs rounded hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        <Target className="w-3 h-3 mr-1" />
                        Nearby ({customNearbyRadius}m)
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={customBufferDistance}
                        onChange={(e) => setCustomBufferDistance(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 rounded"
                        min="100"
                        max="2000"
                        step="100"
                        disabled={isProcessing}
                      />
                      <button
                        onClick={() => handleQuickAction('bufferAnalysis')}
                        disabled={isProcessing}
                        className="flex-1 px-2 py-1.5 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        <Circle className="w-3 h-3 mr-1" />
                        Buffer ({customBufferDistance}m)
                      </button>
                    </div>
                  </>
                )}
                
                <button
                  onClick={() => handleAnalysis('hotspot')}
                  disabled={isProcessing}
                  className="w-full px-2 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Find Hotspots
                </button>
                
                <button
                  onClick={() => handleAnalysis('density')}
                  disabled={isProcessing}
                  className="w-full px-2 py-1.5 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Density Analysis
                </button>
              </div>
            </div>
          )}

          {/* Utility Controls - Available to all users */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
              <Layers className="w-3 h-3 mr-1" />
              Utilities
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {userLocation && (
                <>
                  <button
                    onClick={() => handleQuickAction('centerOnUser')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-teal-500 text-white text-xs rounded hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    Center
                  </button>
                  
                  <button
                    onClick={() => handleQuickAction('refreshLocation')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-cyan-500 text-white text-xs rounded hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <Target className="w-3 h-3 mr-1" />
                    Refresh
                  </button>
                </>
              )}
              
              {hasAnalysisAccess && (
                <>
                  <button
                    onClick={() => handleQuickAction('toggleHeatMap')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <Thermometer className="w-3 h-3 mr-1" />
                    Heat Map
                  </button>
                  
                  <button
                    onClick={() => handleQuickAction('clearAll')}
                    disabled={isProcessing}
                    className="px-2 py-1.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <Grid className="w-3 h-3 mr-1" />
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Footer */}
        <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600 border-t">
          {mapRef.current?.getMapState && (() => {
            try {
              const state = mapRef.current.getMapState();
              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>🎯 Shapes: {state.drawnShapes?.length || 0}</span>
                    {isProcessing && (
                      <span className="text-blue-600 animate-pulse">⚡ Processing...</span>
                    )}
                  </div>
                  {state.analysisResults && !state.analysisResults.error && (
                    <div className="text-green-600 text-xs">
                      ✅ {state.analysisResults.type} analysis completed
                    </div>
                  )}
                  {state.analysisResults?.error && (
                    <div className="text-red-600 text-xs">
                      ❌ Analysis error
                    </div>
                  )}
                </div>
              );
            } catch (error) {
              return (
                <div className="text-gray-500">
                  📊 Map controls ready
                </div>
              );
            }
          })()}
        </div>
      </div>
    </div>
  );
};

export default MapControls;
