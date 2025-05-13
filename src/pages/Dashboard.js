import { useState, useEffect } from 'react';
import { 
  Map, 
  Search, 
  CalendarDays, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Home, 
  PieChart, 
  Layers, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter
} from 'lucide-react';

// Mock data for complaints
const mockComplaints = [
  { 
    id: 1, 
    type: "Garbage", 
    description: "Uncollected waste on street corner", 
    status: "Open", 
    date: "2025-05-01", 
    location: { lat: 40.7128, lng: -74.006 },
    address: "123 Main St, New York",
    reporter: "Anonymous",
    image: "/api/placeholder/400/300"
  },
  { 
    id: 2, 
    type: "Road Damage", 
    description: "Large pothole causing traffic issues", 
    status: "In Progress", 
    date: "2025-05-02", 
    location: { lat: 40.7148, lng: -74.016 },
    address: "456 Broadway, New York",
    reporter: "John Smith",
    image: "/api/placeholder/400/300"
  },
  { 
    id: 3, 
    type: "Street Light", 
    description: "Street light not working for 3 days", 
    status: "Resolved", 
    date: "2025-05-03", 
    location: { lat: 40.7158, lng: -74.026 },
    address: "789 Park Ave, New York",
    reporter: "Sarah Johnson",
    image: null
  },
  { 
    id: 4, 
    type: "Noise", 
    description: "Construction noise after allowed hours", 
    status: "Open", 
    date: "2025-05-04", 
    location: { lat: 40.7168, lng: -74.036 },
    address: "101 5th Ave, New York",
    reporter: "Anonymous",
    image: "/api/placeholder/400/300"
  },
  { 
    id: 5, 
    type: "Garbage", 
    description: "Overflowing public trash bin", 
    status: "Open", 
    date: "2025-05-05", 
    location: { lat: 40.7138, lng: -74.026 },
    address: "202 Madison Ave, New York",
    reporter: "Robert Lee",
    image: null
  }
];

// Complaint types for filtering
const complaintTypes = ["All", "Garbage", "Road Damage", "Street Light", "Noise", "Graffiti", "Water Issue"];
const statusTypes = ["All", "Open", "In Progress", "Resolved"];

// Dashboard main component
export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState({ name: 'Admin User', role: 'Administrator' });
  const [complaints, setComplaints] = useState(mockComplaints);
  const [filteredComplaints, setFilteredComplaints] = useState(mockComplaints);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Effect to filter complaints based on selections
  useEffect(() => {
    let filtered = [...complaints];
    
    if (selectedType !== "All") {
      filtered = filtered.filter(complaint => complaint.type === selectedType);
    }
    
    if (selectedStatus !== "All") {
      filtered = filtered.filter(complaint => complaint.status === selectedStatus);
    }
    
    setFilteredComplaints(filtered);
  }, [complaints, selectedType, selectedStatus]);

  // Statistics for dashboard
  const stats = {
    total: complaints.length,
    open: complaints.filter(c => c.status === 'Open').length,
    inProgress: complaints.filter(c => c.status === 'In Progress').length,
    resolved: complaints.filter(c => c.status === 'Resolved').length,
    byType: {
      Garbage: complaints.filter(c => c.type === 'Garbage').length,
      "Road Damage": complaints.filter(c => c.type === 'Road Damage').length,
      "Street Light": complaints.filter(c => c.type === 'Street Light').length,
      Noise: complaints.filter(c => c.type === 'Noise').length,
      Graffiti: complaints.filter(c => c.type === 'Graffiti').length,
      "Water Issue": complaints.filter(c => c.type === 'Water Issue').length,
    }
  };

  // Fixed handleComplaintStatusChange function
  const handleComplaintStatusChange = (id, newStatus) => {
    // Create a new array with updated complaints
    const updatedComplaints = complaints.map(complaint => 
      complaint.id === id ? {...complaint, status: newStatus} : complaint
    );
    
    setComplaints(updatedComplaints);
    
    if (selectedComplaint && selectedComplaint.id === id) {
      setSelectedComplaint({...selectedComplaint, status: newStatus});
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block bg-indigo-800 text-white w-64 flex-shrink-0`}>
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold">GIS Complaint Manager</h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden">
              <X size={24} />
            </button>
          </div>
          
          <nav className="flex-grow">
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => setActiveView('dashboard')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'dashboard' ? 'bg-indigo-700' : ''}`}
                >
                  <Home size={20} className="mr-3" />
                  <span>Dashboard</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveView('map')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'map' ? 'bg-indigo-700' : ''}`}
                >
                  <Map size={20} className="mr-3" />
                  <span>Map View</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveView('complaints')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'complaints' ? 'bg-indigo-700' : ''}`}
                >
                  <AlertTriangle size={20} className="mr-3" />
                  <span>Complaints</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveView('heatmap')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'heatmap' ? 'bg-indigo-700' : ''}`}
                >
                  <Layers size={20} className="mr-3" />
                  <span>Heat Map</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveView('analytics')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'analytics' ? 'bg-indigo-700' : ''}`}
                >
                  <PieChart size={20} className="mr-3" />
                  <span>Analytics</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveView('users')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'users' ? 'bg-indigo-700' : ''}`}
                >
                  <Users size={20} className="mr-3" />
                  <span>User Management</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveView('settings')}
                  className={`flex items-center w-full p-3 rounded-lg hover:bg-indigo-700 ${activeView === 'settings' ? 'bg-indigo-700' : ''}`}
                >
                  <Settings size={20} className="mr-3" />
                  <span>Settings</span>
                </button>
              </li>
            </ul>
          </nav>
          
          <div className="mt-auto pt-4 border-t border-indigo-700">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center mr-3">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium">{currentUser.name}</div>
                <div className="text-xs text-indigo-300">{currentUser.role}</div>
              </div>
            </div>
            <button className="flex items-center text-indigo-300 hover:text-white w-full">
              <LogOut size={18} className="mr-2" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 md:hidden">
                <Menu size={24} />
              </button>
              <h2 className="text-xl font-semibold">
                {activeView === 'dashboard' && 'Dashboard'}
                {activeView === 'map' && 'Map View'}
                {activeView === 'complaints' && 'Complaints Management'}
                {activeView === 'heatmap' && 'Heat Map Analysis'}
                {activeView === 'analytics' && 'Analytics & Reports'}
                {activeView === 'users' && 'User Management'}
                {activeView === 'settings' && 'System Settings'}
              </h2>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <button className="p-2 rounded-full hover:bg-gray-100">
                  <Bell size={20} />
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
              </div>
              <div className="relative">
                <button className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                    {currentUser.name.charAt(0)}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {activeView === 'dashboard' && (
            <DashboardView stats={stats} complaints={complaints} />
          )}
          
          {activeView === 'map' && (
            <MapView 
              complaints={filteredComplaints} 
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              complaintTypes={complaintTypes}
              statusTypes={statusTypes}
              selectedComplaint={selectedComplaint}
              setSelectedComplaint={setSelectedComplaint}
              onStatusChange={handleComplaintStatusChange}
            />
          )}
          
          {activeView === 'complaints' && (
            <ComplaintsView 
              complaints={filteredComplaints}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              complaintTypes={complaintTypes}
              statusTypes={statusTypes}
              onStatusChange={handleComplaintStatusChange}
              selectedComplaint={selectedComplaint}
              setSelectedComplaint={setSelectedComplaint}
            />
          )}
          
          {/* {activeView === 'heatmap' && (
            <HeatMapView complaints={complaints} />
          )}
          
          {activeView === 'analytics' && (
            <AnalyticsView stats={stats} complaints={complaints} />
          )}
          
          {activeView === 'users' && (
            <UsersView />
          )}
          
          {activeView === 'settings' && (
            <SettingsView />
          )} */}
        </main>
      </div>
      
      {/* Detail Panel - shown when a complaint is selected */}
      {selectedComplaint && (
        <div className="w-80 border-l bg-white p-4 flex flex-col h-screen">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Complaint Details</h3>
            <button onClick={() => setSelectedComplaint(null)} className="text-gray-500">
              <X size={20} />
            </button>
          </div>
          
          <div className="overflow-y-auto flex-1">
            <div className="mb-4">
              <span className="text-sm text-gray-500">ID:</span>
              <p className="font-medium">#{selectedComplaint.id}</p>
            </div>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Type:</span>
              <p className="font-medium">{selectedComplaint.type}</p>
            </div>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Description:</span>
              <p>{selectedComplaint.description}</p>
            </div>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Status:</span>
              <div className="mt-1">
                <select 
                  value={selectedComplaint.status}
                  onChange={(e) => handleComplaintStatusChange(selectedComplaint.id, e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Date Reported:</span>
              <p className="font-medium">{selectedComplaint.date}</p>
            </div>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Address:</span>
              <p>{selectedComplaint.address}</p>
            </div>
            
            <div className="mb-4">
              <span className="text-sm text-gray-500">Reported By:</span>
              <p>{selectedComplaint.reporter}</p>
            </div>
            
            {selectedComplaint.image && (
              <div className="mb-4">
                <span className="text-sm text-gray-500">Image:</span>
                <img 
                  src={selectedComplaint.image} 
                  alt="Complaint evidence" 
                  className="mt-2 w-full rounded-md"
                />
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <button className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700">
              Generate Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard view component
function DashboardView({ stats, complaints }) {
  const recentComplaints = complaints.slice(0, 5);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Total Complaints</p>
              <h3 className="text-2xl font-bold">{stats.total}</h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <AlertTriangle size={24} className="text-blue-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Open</p>
              <h3 className="text-2xl font-bold">{stats.open}</h3>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <Clock size={24} className="text-red-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">In Progress</p>
              <h3 className="text-2xl font-bold">{stats.inProgress}</h3>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock size={24} className="text-yellow-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500">Resolved</p>
              <h3 className="text-2xl font-bold">{stats.resolved}</h3>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle size={24} className="text-green-500" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
          <h3 className="font-semibold mb-4">Recent Complaints</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentComplaints.map(complaint => (
                  <tr key={complaint.id}>
                    <td className="px-4 py-2 whitespace-nowrap">#{complaint.id}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{complaint.type}</td>
                    <td className="px-4 py-2">
                      {complaint.description.length > 30 
                        ? `${complaint.description.substring(0, 30)}...` 
                        : complaint.description}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        complaint.status === 'Open' ? 'bg-red-100 text-red-800' :
                        complaint.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {complaint.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{complaint.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Complaints by Type</h3>
          <div className="space-y-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  ></div>
                </div>
                <span className="ml-4 text-sm text-gray-600 min-w-[80px]">{type}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Map Overview</h3>
          <div className="bg-gray-200 h-64 flex items-center justify-center">
            <div className="text-center">
              <Map size={48} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">Map visualization would appear here</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Complaint Trends</h3>
          <div className="bg-gray-200 h-64 flex items-center justify-center">
            <div className="text-center">
              <PieChart size={48} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">Trend chart would appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Map view component
function MapView({ 
  complaints, 
  selectedType, 
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  complaintTypes,
  statusTypes,
  selectedComplaint,
  setSelectedComplaint,
  onStatusChange
}) {
  return (
    <div>
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
          <div className="mb-4 md:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Complaint Type</label>
            <select 
              className="border rounded-md px-3 py-2 w-full md:w-48"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {complaintTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4 md:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              className="border rounded-md px-3 py-2 w-full md:w-48"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {statusTypes.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4 md:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex items-center space-x-2">
              <input type="date" className="border rounded-md px-3 py-2 w-full" />
              <span>to</span>
              <input type="date" className="border rounded-md px-3 py-2 w-full" />
            </div>
          </div>
          
          <div className="mt-auto md:ml-auto">
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
              <span className="flex items-center">
                <Filter size={16} className="mr-2" />
                Apply Filters
              </span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded-lg shadow h-96">
            {/* Map would be implemented with Leaflet or Google Maps here */}
            <div className="bg-gray-200 h-full flex items-center justify-center">
              <div className="text-center">
                <Map size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">Interactive map would appear here</p>
                <p className="text-sm text-gray-400 mt-2">Using Leaflet for map visualization</p>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-4">Complaints List</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {complaints.map(complaint => (
                <div 
                  key={complaint.id}
                  onClick={() => setSelectedComplaint(complaint)}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedComplaint && selectedComplaint.id === complaint.id ? 'border-indigo-500 bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`px-2 py-1 text-xs rounded-full mr-2 ${
                        complaint.status === 'Open' ? 'bg-red-100 text-red-800' :
                        complaint.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {complaint.status}
                      </span>
                      <span className="text-sm font-medium">{complaint.type}</span>
                    </div>
                    <span className="text-xs text-gray-500">#{complaint.id}</span>
                  </div>
                  <p className="text-sm mt-1 text-gray-600">{complaint.description}</p>
                  <div className="mt-2 text-xs text-gray-500">{complaint.address}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow mt-4">
            <h3 className="font-semibold mb-4">Control Panel</h3>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 flex items-center justify-center">
                <span className="mr-2">My Location</span>
                <Search size={16} />
              </button>
              <button className="w-full bg-gray-200 text-gray-800 p-2 rounded-md hover:bg-gray-300 flex items-center justify-center">
                <span className="mr-2">Toggle Heat Map</span>
                <Layers size={16} />
              </button>
              <button className="w-full bg-gray-200 text-gray-800 p-2 rounded-md hover:bg-gray-300 flex items-center justify-center">
                <span className="mr-2">Toggle Buffer Zone</span>
                <AlertTriangle size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Complaints view component
function ComplaintsView({ 
  complaints, 
  selectedType, 
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
  complaintTypes,
  statusTypes,
  onStatusChange,
  selectedComplaint,
  setSelectedComplaint
}) {
  return (
    <div>
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
          <div className="mb-4 md:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Complaint Type</label>
            <select 
              className="border rounded-md px-3 py-2 w-full md:w-48"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {complaintTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4 md:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              className="border rounded-md px-3 py-2 w-full md:w-48"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {statusTypes.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4 md:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex items-center space-x-2">
              <input type="date" className="border rounded-md px-3 py-2 w-full" />
              <span>to</span>
              <input type="date" className="border rounded-md px-3 py-2 w-full" />
            </div>
          </div>
          
          <div className="mt-auto md:ml-auto">
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
              <span className="flex items-center">
                <Filter size={16} className="mr-2" />
                Apply Filters
              </span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded-lg shadow h-96">
            {/* Map would be implemented with Leaflet or Google Maps here */}
            <div className="bg-gray-200 h-full flex items-center justify-center">
              <div className="text-center">
                <Map size={48} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">Interactive map would appear here</p>
                <p className="text-sm text-gray-400 mt-2">Using Leaflet for map visualization</p>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-4">Complaints List</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {complaints.map(complaint => (
                <div 
                  key={complaint.id}
                  onClick={() => setSelectedComplaint(complaint)}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedComplaint && selectedComplaint.id === complaint.id ? 'border-indigo-500 bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`px-2 py-1 text-xs rounded-full mr-2 ${
                        complaint.status === 'Open' ? 'bg-red-100 text-red-800' :
                        complaint.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {complaint.status}
                      </span>
                      <span className="text-sm font-medium">{complaint.type}</span>
                    </div>
                    <span className="text-xs text-gray-500">#{complaint.id}</span>
                  </div>
                  <p className="text-sm mt-1 text-gray-600">{complaint.description}</p>
                  <div className="mt-2 text-xs text-gray-500">{complaint.address}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow mt-4">
            <h3 className="font-semibold mb-4">Control Panel</h3>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 flex items-center justify-center">
                <span className="mr-2">My Location</span>
                <Search size={16} />
              </button>
              <button className="w-full bg-gray-200 text-gray-800 p-2 rounded-md hover:bg-gray-300 flex items-center justify-center">
                <span className="mr-2">Toggle Heat Map</span>
                <Layers size={16} />
              </button>
              <button className="w-full bg-gray-200 text-gray-800 p-2 rounded-md hover:bg-gray-300 flex items-center justify-center">
                <span className="mr-2">Toggle Buffer Zone</span>
                <AlertTriangle size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}