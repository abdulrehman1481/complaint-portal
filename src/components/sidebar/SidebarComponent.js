import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Filter, Layers, Activity, List, Info, Shield } from 'lucide-react';
import { canAccessAnalysisTools, isDepartmentAdmin } from '../../utils/userPermissions';

// Helper functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const formatStatus = (status) => {
  if (!status) return 'Unknown';
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
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

const SidebarComponent = ({
  activeTab,
  setActiveTab,
  complaints,
  categories,
  mapConfig,
  handleApplyFilters,
  toggleMapLayer,
  toggleBaseMapStyle,
  toggleDrawingMode,
  createBuffer,
  setMapConfig,
  setSelectedComplaint,
  user,
  setSidebarOpen,
  mapRef,
  runSpatialAnalysis
}) => {
  const [filterCategory, setFilterCategory] = useState(mapConfig.filterCategory || '');
  const [filterStatus, setFilterStatus] = useState(mapConfig.filterStatus || '');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [bufferDistance, setBufferDistance] = useState(mapConfig.bufferDistance || 500);
  const [selectedBase, setSelectedBase] = useState(mapConfig.baseLayerType || 'streets');
  const [departmentStats, setDepartmentStats] = useState(null);
  
  // Check if user is admin
  const isAdmin = canAccessAnalysisTools(user);
  const isDepAdmin = isDepartmentAdmin(user);
  
  // Get department stats for department admins
  useEffect(() => {
    if (isDepAdmin && complaints.length > 0) {
      // Calculate statistics for the department's complaints
      const open = complaints.filter(c => c.status === 'open').length;
      const inProgress = complaints.filter(c => c.status === 'in_progress').length;
      const resolved = complaints.filter(c => c.status === 'resolved').length;
      
      // Get category breakdown
      const categoryBreakdown = {};
      complaints.forEach(complaint => {
        const catName = complaint.categories?.name || 'Uncategorized';
        categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + 1;
      });
      
      setDepartmentStats({
        total: complaints.length,
        open,
        inProgress,
        resolved,
        categoryBreakdown
      });
    }
  }, [complaints, isDepAdmin]);
  
  // Handle filter application
  const applyFilters = () => {
    const filters = {
      filterCategory,
      filterStatus,
      filterDateRange: (filterDateStart || filterDateEnd) 
        ? { startDate: filterDateStart, endDate: filterDateEnd }
        : null
    };
    
    handleApplyFilters(filters);
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilterCategory('');
    setFilterStatus('');
    setFilterDateStart('');
    setFilterDateEnd('');
    
    handleApplyFilters({
      filterCategory: '',
      filterStatus: '',
      filterDateRange: null
    });
  };
  
  // Handle base map change
  const changeBaseMap = (baseType) => {
    setSelectedBase(baseType);
    toggleBaseMapStyle(baseType);
  };

// Fix the handleComplaintClick function
const handleComplaintClick = (complaint) => {
  if (!complaint) return;

  // Validate coordinates before using them
  const hasValidCoordinates = Array.isArray(complaint.coordinates) &&
    complaint.coordinates.length === 2 &&
    !isNaN(complaint.coordinates[0]) &&
    !isNaN(complaint.coordinates[1]);

  // Dispatch event to select complaint for detailed view
  window.dispatchEvent(new CustomEvent('selectComplaint', { detail: { complaint } }));

  try {
    if (mapRef?.current?.focusOnComplaint && complaint.id) {
      // Prefer using the component’s API to focus and open popup
      mapRef.current.focusOnComplaint(complaint.id);
      return;
    }
    if (hasValidCoordinates && mapRef?.current?.setView) {
      // Fallback: center on coordinates
      const [lng, lat] = complaint.coordinates;
      mapRef.current.setView([lat, lng], 15);
      return;
    }
  } catch (error) {
    console.warn('Unable to navigate to complaint on map:', error);
  }
};

  // Return different tabs based on user role
  const getTabs = () => {
    const tabs = [
      { id: 'complaints', label: 'Complaints', icon: <List size={16} className="mr-1" /> }
    ];
    
    // Add layers tab for all users
    tabs.push({ id: 'layers', label: 'Layers', icon: <Layers size={16} className="mr-1" /> });
    
    // Add analysis tab only for admin users
    if (isAdmin) {
      tabs.push({ id: 'analysis', label: 'Analysis', icon: <Activity size={16} className="mr-1" /> });
    }
    
    // Add admin tab for department admins
    if (isDepAdmin) {
      tabs.push({ id: 'admin', label: 'Admin', icon: <Shield size={16} className="mr-1" /> });
    }
    
    return tabs;
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full z-[1050]">
      {/* Sidebar header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200">
        <h2 className="text-lg font-medium">Map Tools</h2>
        <button 
          onClick={() => setSidebarOpen(false)}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close sidebar"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      
      {/* Sidebar tabs */}
      <div className="flex border-b border-gray-200">
        {getTabs().map(tab => (
          <button
            key={tab.id}
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <div className="flex items-center justify-center">
              {tab.icon}
              {tab.label}
            </div>
          </button>
        ))}
      </div>
      
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* Complaints tab */}
        {activeTab === 'complaints' && (
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filters</h3>
              
              {/* Category filter */}
              <div className="mb-3">
                <label className="block text-xs text-gray-600 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Status filter */}
              <div className="mb-3">
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              
              {/* Date range filters */}
              <div className="mb-3">
                <label className="block text-xs text-gray-600 mb-1">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filterDateStart}
                    onChange={(e) => setFilterDateStart(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={filterDateEnd}
                    onChange={(e) => setFilterDateEnd(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="End Date"
                  />
                </div>
              </div>
              
              {/* Filter buttons */}
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={applyFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex-1 flex items-center justify-center"
                >
                  <Filter size={16} className="mr-1" />
                  Apply Filters
                </button>
                <button
                  onClick={resetFilters}
                  className="border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-md text-sm"
                >
                  Reset
                </button>
              </div>
            </div>
            
            {/* Complaints list */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Complaints ({complaints.length})</h3>
              {complaints.length > 0 ? (
                <ul className="space-y-2">
                  {complaints.map(complaint => (
                    <li 
                      key={complaint.id} 
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b"
                      onClick={() => handleComplaintClick(complaint)}
                    >
                      <div className="flex justify-between">
                        <div className="font-medium">{complaint.title || 'Untitled Complaint'}</div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusClass(complaint.status)}`}>
                          {formatStatus(complaint.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {complaint.locationName || 'Loading location...'}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <div className="text-xs">
                            {formatDate(complaint.created_at)}
                          </div>
                          <div className="text-xs">
                            ID: #{complaint.id}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No complaints found matching your filters
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Layers tab */}
        {activeTab === 'layers' && (
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Base Maps</h3>
              <div className="grid grid-cols-2 gap-2">
                {['streets', 'satellite', 'light', 'dark', 'outdoors'].map(baseType => (
                  <button
                    key={baseType}
                    className={`px-3 py-2 text-xs rounded-md ${
                      selectedBase === baseType 
                        ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => changeBaseMap(baseType)}
                  >
                    {baseType.charAt(0).toUpperCase() + baseType.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Map Layers</h3>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={mapConfig.showClusters}
                    onChange={() => toggleMapLayer('clusters')}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Show Complaint Points</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={mapConfig.showHeatmap}
                    onChange={() => toggleMapLayer('heatmap')}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm">Heat Map</span>
                </label>
                
                {/* Show buffer and boundaries layers only to admins */}
                {isAdmin && (
                  <>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={mapConfig.showBuffers}
                        onChange={() => toggleMapLayer('buffers')}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">Buffer Zones</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={mapConfig.showBoundaries}
                        onChange={() => toggleMapLayer('boundaries')}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">Department Boundaries</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Analysis tab - only for admins */}
        {isAdmin && activeTab === 'analysis' && (
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Spatial Analysis Tools</h3>
              <p className="text-xs text-gray-500 mb-2">Select or draw areas on the map to perform analysis</p>
              
              <div className="space-y-3 mb-4">
                <button
                  onClick={() => {
                    if (runSpatialAnalysis) return runSpatialAnalysis('count');
                    if (mapRef?.current?.runSpatialAnalysis) return mapRef.current.runSpatialAnalysis('count');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Count Points in Polygon
                </button>
                
                <button
                  onClick={() => {
                    if (runSpatialAnalysis) return runSpatialAnalysis('hotspot');
                    if (mapRef?.current?.runHotspotAnalysis) return mapRef.current.runHotspotAnalysis();
                    if (mapRef?.current?.runSpatialAnalysis) return mapRef.current.runSpatialAnalysis('hotspot');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Hotspot Analysis
                </button>
                
                <button
                  onClick={() => {
                    if (runSpatialAnalysis) return runSpatialAnalysis('density');
                    if (mapRef?.current?.runDensityAnalysis) return mapRef.current.runDensityAnalysis();
                    if (mapRef?.current?.runSpatialAnalysis) return mapRef.current.runSpatialAnalysis('density');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Density Analysis
                </button>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Buffer Analysis</h4>
                <div className="flex items-center mb-2">
                  <input 
                    type="range" 
                    min="100" 
                    max="5000" 
                    step="100" 
                    value={bufferDistance}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setBufferDistance(value);
                      setMapConfig(prev => ({ ...prev, bufferDistance: value }));
                    }}
                    className="flex-1 mr-2"
                  />
                  <span className="text-xs w-16 text-right">{bufferDistance}m</span>
                </div>
                <button
                  onClick={() => createBuffer(bufferDistance)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  Create Buffer Zone
                </button>
              </div>
              
              <button
                onClick={() => {
                  if (mapRef?.current?.clearAnalysisLayers) return mapRef.current.clearAnalysisLayers();
                  // Fallback: try known APIs
                  if (mapRef?.current?.clearAllDrawings) return mapRef.current.clearAllDrawings();
                }}
                className="w-full border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-md text-sm"
              >
                Clear Analysis
              </button>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  <Info size={16} className="text-blue-500" />
                </div>
                <div className="ml-2 text-xs text-blue-800">
                  <p className="font-medium">Analysis Tips</p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Draw a polygon first before counting points</li>
                    <li>Buffer analysis works on any selected feature</li>
                    <li>Density analysis works best with at least 10 points</li>
                    <li>Use different base maps for better visualization</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Department Admin Dashboard - Only for department admins */}
        {isDepAdmin && activeTab === 'admin' && (
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Department Dashboard</h3>
            
            {departmentStats ? (
              <div>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="text-xs text-blue-600 font-medium">Total Complaints</div>
                    <div className="text-xl font-semibold">{departmentStats.total}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <div className="text-xs text-red-600 font-medium">Open</div>
                    <div className="text-xl font-semibold">{departmentStats.open}</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                    <div className="text-xs text-yellow-600 font-medium">In Progress</div>
                    <div className="text-xl font-semibold">{departmentStats.inProgress}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <div className="text-xs text-green-600 font-medium">Resolved</div>
                    <div className="text-xl font-semibold">{departmentStats.resolved}</div>
                  </div>
                </div>
                
                {/* Category Breakdown */}
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">Categories</h4>
                  <div className="space-y-2">
                    {Object.entries(departmentStats.categoryBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([category, count]) => (
                        <div key={category} className="flex items-center">
                          <div className="flex-1 text-xs">{category}</div>
                          <div className="text-xs font-medium">{count}</div>
                          <div className="ml-2 w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(count / departmentStats.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                
                <div className="mt-4">
                  <button 
                    onClick={() => {
                      // Focus on department's area by showing boundaries
                      toggleMapLayer('boundaries');
                      setMapConfig(prev => ({ ...prev, showBoundaries: true }));
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                  >
                    View Department Area
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                Loading department statistics...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarComponent;
