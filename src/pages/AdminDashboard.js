import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
// Drawing and Heatmap imports
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw/dist/leaflet.draw.js';
import 'leaflet.heat';
import '../styles/leaflet-admin.css';
// Chart.js imports
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
// Recharts imports
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  Area, AreaChart, RadialBarChart, RadialBar, TreeMap
} from 'recharts';
import { 
  Users, AlertTriangle, CheckCircle, Clock, LogOut, 
  Settings, Home, Map as MapIcon, BarChart2, Bell, ArrowLeft,
  Building, RefreshCw, X, Layers, Edit3, Circle, Square, 
  Triangle, Hexagon, MapPin, Target, Download, Activity
} from 'lucide-react';
import DashboardStats from '../components/admin/DashboardStats';
import ComplaintsTable from '../components/admin/ComplaintsTable';
import UserManagement from '../components/admin/UserManagement';
import DepartmentManagement from '../components/admin/DepartmentManagement';
import Analytics from './analytics';
import { parseLocation, formatLocationForDisplay } from '../utils/locationFormatter';
import { pointsInPolygon, createBufferAround, calculateCentroid, generateConvexHull } from '../utils/spatialAnalysis';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const AdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({
    totalComplaints: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    totalUsers: 0,
    avgResolutionTime: null
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // Enhanced state for drawing and spatial analysis
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingTool, setDrawingTool] = useState(null);
  const [drawnFeatures, setDrawnFeatures] = useState([]);
  const [spatialAnalysisResults, setSpatialAnalysisResults] = useState({});
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [clusteringEnabled, setClusteringEnabled] = useState(true);
  
  // Chart references for enhanced analytics
  const statusChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const performanceChartRef = useRef(null);
  const geoChartRef = useRef(null);
  const mapContainerRef = useRef(null);

  const [complaintFilters, setComplaintFilters] = useState({
    status: '',
    category: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [complaintsPagination, setComplaintsPagination] = useState({
    total: 0,
    pageSize: 10,
    currentPage: 1,
  });
  const [complaintsSorting, setComplaintsSorting] = useState({
    column: 'created_at',
    direction: 'descending',
  });
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  
  // Enhanced Analytics state
  const [analyticsData, setAnalyticsData] = useState({
    complaintsByCategory: [],
    complaintsByStatus: [],
    complaintsByDepartment: [],
    resolutionTime: null,
    avgResolutionTime: 0,
    trendData: [],
    geospatialData: [],
    timeSeriesData: [],
    performanceMetrics: {
      responseTime: 0,
      resolutionRate: 0,
      customerSatisfaction: 0,
      reopenRate: 0
    },
    heatmapData: [],
    densityAnalysis: [],
    categoryTrends: []
  });

  // Enhanced user management state
  const [userFilters, setUserFilters] = useState({
    search: '',
    role: '',
    department: ''
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchAdminData();
    
    // Cleanup function for component unmount
    return () => {
      try {
        if (window.adminMapCleanup) {
          window.adminMapCleanup();
          window.adminMapCleanup = null;
        }
        
        // Additional safety cleanup
        if (window.adminMapInstance) {
          window.adminMapInstance = null;
        }
        
        // Clear any remaining map containers
        const container = document.getElementById('admin-map-container');
        if (container && container.parentNode) {
          container.innerHTML = '';
        }
      } catch (error) {
        console.warn('Error during component cleanup:', error);
      }
    };
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/');
        return;
      }
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name, permissions),
          departments (id, name)
        `)
        .eq('id', authUser.id)
        .single();
      
      if (userError) {
        console.error('Error fetching user data:', userError);
        navigate('/dashboard');
        return;
      }
      
      if (userData.roles?.name !== 'Super Admin' && userData.roles?.name !== 'Department Admin') {
        console.log('User does not have admin permissions:', userData.roles?.name);
        navigate('/dashboard');
        return;
      }
      
      console.log(`User authenticated as ${userData.roles?.name}`, {
        name: `${userData.first_name} ${userData.last_name}`,
        department: userData.departments?.name || 'No Department',
        departmentId: userData.department_id || 'None'
      });
      
      setUser({ ...authUser, ...userData });
      
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('id');
        
      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      } else {
        console.log(`Fetched ${rolesData?.length} roles`);
        setRoles(rolesData || []);
      }
      
      const { data: departmentsData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (deptError) {
        console.error('Error fetching departments:', deptError);
      } else {
        console.log('Departments fetched:', departmentsData?.length);
        setDepartments(departmentsData || []);
      }
      
      await fetchStats();
      await fetchComplaintCategories();
      await fetchInitialComplaints(userData);
      
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchComplaintCategories = async () => {
    try {
      console.log('Fetching complaint categories...');
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon, default_department_id')
        .order('name');
        
      if (error) {
        console.error('Error fetching categories:', error);
      } else {
        console.log(`Fetched ${data?.length} categories`);
        setCategories(data || []);
      }
    } catch (error) {
      console.error('Error in fetchComplaintCategories:', error);
    }
  };
  
  const fetchStats = async () => {
    try {
      console.log('Fetching complaint statistics...');
      
      // For Department Admins, filter by their department
      const filterByDepartment = user?.roles?.name === 'Department Admin' && user?.department_id;
      let deptCategoryIds = [];
      
      if (filterByDepartment) {
        console.log(`Filtering stats for department ID ${user.department_id}`);
        
        const { data: deptCategories, error: deptCatError } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCatError) {
          console.error('Error fetching department categories:', deptCatError);
        } else if (deptCategories && deptCategories.length > 0) {
          deptCategoryIds = deptCategories.map(dc => dc.category_id);
          console.log(`Department is responsible for ${deptCategoryIds.length} categories`);
        }
      }
      
      // Total complaints
      let query = supabase.from('complaints').select('*', { count: 'exact', head: true });
      if (filterByDepartment && deptCategoryIds.length > 0) {
        query = query.in('category_id', deptCategoryIds);
      }
      const { count: totalCount, error: totalError } = await query;
      
      if (totalError) {
        console.error('Error fetching total complaints:', totalError);
      }
      
      // Open complaints
      query = supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open');
      if (filterByDepartment && deptCategoryIds.length > 0) {
        query = query.in('category_id', deptCategoryIds);
      }
      const { count: openCount, error: openError } = await query;
      
      if (openError) {
        console.error('Error fetching open complaints:', openError);
      }
      
      // In-progress complaints
      query = supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
      if (filterByDepartment && deptCategoryIds.length > 0) {
        query = query.in('category_id', deptCategoryIds);
      }
      const { count: inProgressCount, error: inProgressError } = await query;
      
      if (inProgressError) {
        console.error('Error fetching in-progress complaints:', inProgressError);
      }
      
      // Resolved complaints
      query = supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'resolved');
      if (filterByDepartment && deptCategoryIds.length > 0) {
        query = query.in('category_id', deptCategoryIds);
      }
      const { count: resolvedCount, error: resolvedError } = await query;
      
      if (resolvedError) {
        console.error('Error fetching resolved complaints:', resolvedError);
      }
      
      // Total users
      const { count: usersCount, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (usersError) {
        console.error('Error fetching user count:', usersError);
      }
      
      // Calculate avg resolution time
      query = supabase.from('complaints')
        .select('created_at, resolved_at')
        .eq('status', 'resolved')
        .not('resolved_at', 'is', null);
        
      if (filterByDepartment && deptCategoryIds.length > 0) {
        query = query.in('category_id', deptCategoryIds);
      }
      
      const { data: resolvedComplaints, error: resolvedTimeError } = await query;
      
      if (resolvedTimeError) {
        console.error('Error calculating resolution time:', resolvedTimeError);
      }
      
      let avgResolutionTime = null;
      if (resolvedComplaints && resolvedComplaints.length > 0) {
        let totalHours = resolvedComplaints.reduce((acc, complaint) => {
          const created = new Date(complaint.created_at);
          const resolved = new Date(complaint.resolved_at);
          return acc + (resolved - created) / (1000 * 60 * 60);
        }, 0);
        
        avgResolutionTime = (totalHours / resolvedComplaints.length).toFixed(1);
      }
      
      const statsData = {
        totalComplaints: totalCount || 0,
        openComplaints: openCount || 0,
        inProgressComplaints: inProgressCount || 0,
        resolvedComplaints: resolvedCount || 0,
        totalUsers: usersCount || 0,
        avgResolutionTime
      };
      
      console.log('Stats calculated:', statsData);
      setStats(statsData);
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchInitialComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          id, title, description, location, status, category_id, 
          reported_by, assigned_to, anonymous, images, created_at, 
          updated_at, resolved_at, categories (name, icon)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Parse location data for each complaint using the improved parser
      const parsedComplaints = data.map(complaint => ({
        ...complaint,
        parsedLocation: parseLocation(complaint.location)
      }));

      setComplaints(parsedComplaints);
    } catch (error) {
      console.error('Error fetching initial complaints:', error);
    }
  };

  const fetchComplaints = async (page = 1, filters = complaintFilters, sorting = complaintsSorting) => {
    try {
      setLoading(true);
      console.log(`Fetching paginated complaints (page ${page})...`);
      console.log('Active filters:', filters);
      console.log('Sorting:', sorting);
      
      // Start with base query
      let query = supabase
        .from('complaints')
        .select(`
          *,
          categories (id, name, icon),
          users:reported_by (first_name, last_name),
          assigned_to_user:assigned_to (first_name, last_name, email, official_position),
          departments (id, name)
        `, { count: 'exact' });
      
      // Filter by department if user is Department Admin
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        console.log(`Filtering by department ID: ${user.department_id}`);
        
        // First, get categories for this department
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          console.log(`Department categories: ${categoryIds.join(', ')}`);
          query = query.in('category_id', categoryIds);
        } else {
          // As fallback, use the default department from categories
          const { data: defaultCategories } = await supabase
            .from('categories')
            .select('id')
            .eq('default_department_id', user.department_id);
            
          if (defaultCategories && defaultCategories.length > 0) {
            const defaultCategoryIds = defaultCategories.map(c => c.id);
            console.log(`Default department categories: ${defaultCategoryIds.join(', ')}`);
            query = query.in('category_id', defaultCategoryIds);
          } else {
            console.warn('No categories found for this department - admin may not see any complaints');
          }
        }
      }
      
      // Apply filters
      if (filters.status) {
        console.log(`Filtering by status: ${filters.status}`);
        query = query.eq('status', filters.status);
      }
      
      if (filters.category) {
        console.log(`Filtering by category: ${filters.category}`);
        query = query.eq('category_id', filters.category);
      }
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        console.log(`Filtering from date: ${startDate.toISOString()}`);
        query = query.gte('created_at', startDate.toISOString());
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        console.log(`Filtering to date: ${endDate.toISOString()}`);
        query = query.lte('created_at', endDate.toISOString());
      }
      
      if (filters.search) {
        console.log(`Searching for: "${filters.search}"`);
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,id.eq.${!isNaN(parseInt(filters.search)) ? parseInt(filters.search) : 0}`);
      }
      
      // Apply sorting
      const sortDirection = sorting.direction === 'ascending' ? { ascending: true } : { ascending: false };
      console.log(`Sorting by ${sorting.column} (${sorting.direction})`);
      query = query.order(sorting.column, sortDirection);
      
      // Apply pagination
      const from = (page - 1) * complaintsPagination.pageSize;
      const to = from + complaintsPagination.pageSize - 1;
      console.log(`Fetching items ${from} to ${to}`);
      
      const { data, count, error } = await query.range(from, to);
      
      if (error) {
        console.error('Error executing query:', error);
        throw error;
      }
      
      console.log(`Retrieved ${data?.length} complaints (total: ${count})`);
      
      // Parse locations
      const parsedComplaints = data.map(complaint => ({
        ...complaint,
        parsedLocation: parseLocation(complaint.location)
      }));
      
      console.log(`Successfully parsed complaints for table view`);
      setComplaints(parsedComplaints);
      setComplaintsPagination(prev => ({
        ...prev,
        total: count || 0,
        currentPage: page
      }));
      setComplaintsPage(page);
      
      // Update map with all complaints (without pagination)
      if (window.adminMapInstance) {
        console.log('Updating map with filtered complaints...');
        fetchMapComplaints(filters);
      }
      
    } catch (error) {
      console.error('Error in fetchComplaints:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch all complaints for map display (with filters but no pagination)
  const fetchMapComplaints = async (filters = complaintFilters) => {
    try {
      console.log('Fetching complaints for map display (with filters but no pagination)...');
      
      // Start with base query
      let query = supabase
        .from('complaints')
        .select(`
          id,
          title,
          description,
          location,
          status,
          category_id,
          reported_by,
          anonymous,
          created_at,
          categories (id, name, icon)
        `);
          
      // Apply the same department filtering as regular complaints
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        } else {
          // Try default categories
          const { data: defaultCategories } = await supabase
            .from('categories')
            .select('id')
            .eq('default_department_id', user.department_id);
            
          if (defaultCategories && defaultCategories.length > 0) {
            const defaultCategoryIds = defaultCategories.map(c => c.id);
            query = query.in('category_id', defaultCategoryIds);
          }
        }
      }
      
      // Apply user-selected filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }
      
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,id.eq.${!isNaN(parseInt(filters.search)) ? parseInt(filters.search) : 0}`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log(`Fetched ${data.length} complaints for map display`);
      
      // Parse locations for map display
      const parsedMapComplaints = data.map(complaint => {
        const parsedLocation = parseLocation(complaint.location);
        
        return {
          ...complaint,
          parsedLocation
        };
      });
      
      console.log(`Successfully parsed locations for ${parsedMapComplaints.filter(c => c.parsedLocation).length} map complaints`);
      
      if (window.adminMapInstance) {
        addComplaintsToAdminMap(window.adminMapInstance, parsedMapComplaints);
      }
      
    } catch (error) {
      console.error('Error fetching map complaints:', error);
    }
  };
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name),
          departments (id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`Fetched ${data?.length} users`);
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    if (tab === 'users' && users.length === 0) {
      fetchUsers();
    } else if (tab === 'complaints') {
      // Refresh complaints data with pagination when switching to complaints tab
      fetchComplaints(1);
    } else if (tab === 'analytics') {
      // Fetch comprehensive analytics data
      fetchAnalyticsData();
    }
  };
  
  const handlePromoteUser = (user) => {
    setSelectedUser(user);
    setSelectedRole(user.role_id?.toString() || '');
    setSelectedDepartment(user.department_id?.toString() || '');
    setIsPromoteModalOpen(true);
  };
  
  const handlePromoteSubmit = async () => {
    if (!selectedRole) {
      alert('Please select a role for the user');
      return;
    }
    
    try {
      const updates = {
        role_id: selectedRole,
        department_id: selectedDepartment || null
      };
      
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', selectedUser.id);
        
      if (error) throw error;
      
      // Get the updated role and department objects
      const updatedRole = roles.find(r => r.id.toString() === selectedRole.toString());
      const updatedDepartment = departments.find(d => d.id.toString() === selectedDepartment.toString());
      
      // Update local state
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? {
              ...u,
              role_id: selectedRole,
              department_id: selectedDepartment || null,
              roles: updatedRole || null,
              departments: updatedDepartment || null
            }
          : u
      ));
      
      setIsPromoteModalOpen(false);
      alert(`Successfully updated role for ${selectedUser.first_name} ${selectedUser.last_name}`);
      
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user role. Please try again.');
    }
  };
  
  // Filter handling
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setComplaintFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const applyFilters = () => {
    setIsFilterApplied(
      complaintFilters.status !== '' || 
      complaintFilters.category !== '' || 
      complaintFilters.startDate !== '' || 
      complaintFilters.endDate !== '' || 
      complaintFilters.search !== ''
    );
    fetchComplaints(1, complaintFilters);
    setShowFilters(false);
  };
  
  const clearFilters = () => {
    const resetFilters = {
      status: '',
      category: '',
      startDate: '',
      endDate: '',
      search: '',
    };
    setComplaintFilters(resetFilters);
    setIsFilterApplied(false);
    fetchComplaints(1, resetFilters);
  };
  
  // Sorting handling
  const handleSortChange = (column) => {
    const newDirection = 
      complaintsSorting.column === column && complaintsSorting.direction === 'descending'
        ? 'ascending'
        : 'descending';
        
    const newSorting = { column, direction: newDirection };    
    setComplaintsSorting(newSorting);
    fetchComplaints(complaintsPage, complaintFilters, newSorting);
  };
  
  // Pagination handling
  const handlePageChange = (newPage) => {
    fetchComplaints(newPage, complaintFilters, complaintsSorting);
  };
  
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedComplaints.length === 0) {
      alert('Please select complaints to update.');
      return;
    }
    
    try {
      console.log('Updating complaints:', selectedComplaints, 'to status:', newStatus);
      
      // Ensure selectedComplaints contains only valid integers
      const validComplaintIds = selectedComplaints
        .filter(id => id != null && !isNaN(parseInt(id)))
        .map(id => parseInt(id));
      
      if (validComplaintIds.length === 0) {
        alert('No valid complaints selected.');
        return;
      }
      
      const updates = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      } else if (newStatus === 'open') {
        updates.resolved_at = null;
      }
      
      console.log('Update payload:', updates);
      console.log('Valid complaint IDs:', validComplaintIds);
      
      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .in('id', validComplaintIds);
        
      if (error) throw error;
      
      fetchComplaints(complaintsPage, complaintFilters, complaintsSorting);
      setSelectedComplaints([]);
      
      // Show success notification instead of alert
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
      notification.textContent = `Successfully updated ${validComplaintIds.length} complaints to ${newStatus.replace('_', ' ')}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
      
    } catch (error) {
      console.error('Error updating complaints:', error);
      
      // Show error notification instead of alert
      const errorNotification = document.createElement('div');
      errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
      let errorMessage = 'Failed to update complaints. Please try again.';
      
      if (error.message && error.message.includes('active')) {
        errorMessage = 'Database schema issue detected. Please contact administrator.';
      }
      
      errorNotification.textContent = errorMessage;
      document.body.appendChild(errorNotification);
      
      setTimeout(() => {
        errorNotification.style.opacity = '0';
        setTimeout(() => {
          if (errorNotification.parentNode) {
            errorNotification.parentNode.removeChild(errorNotification);
          }
        }, 300);
      }, 5000);
    }
  };

  const handleIndividualStatusChange = async (complaintId, newStatus) => {
    try {
      console.log('Updating complaint ID:', complaintId, 'to status:', newStatus);
      
      // Validate complaint ID
      const validComplaintId = parseInt(complaintId);
      if (isNaN(validComplaintId)) {
        throw new Error('Invalid complaint ID');
      }
      
      const updates = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      } else if (newStatus === 'open') {
        updates.resolved_at = null;
      }
      
      console.log('Individual update payload:', updates);
      
      // Use simple update without any unnecessary fields
      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', validComplaintId);
        
      if (error) {
        console.error('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      // Refresh complaints list
      fetchComplaints(complaintsPage, complaintFilters, complaintsSorting);
      
      // Show success notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
      notification.textContent = `Complaint #${validComplaintId} status updated to ${newStatus.replace('_', ' ')}`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
      
    } catch (error) {
      console.error('Error updating complaint status:', error);
      
      // Show error notification
      const errorNotification = document.createElement('div');
      errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
      
      let errorMessage = `Failed to update complaint #${complaintId}. Please try again.`;
      
      if (error.code === '42703') {
        errorMessage = 'Database configuration issue detected. Please contact administrator.';
        console.error('Column does not exist error - likely missing database migration');
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      errorNotification.textContent = errorMessage;
      document.body.appendChild(errorNotification);
      
      setTimeout(() => {
        errorNotification.style.opacity = '0';
        setTimeout(() => {
          if (errorNotification.parentNode) {
            errorNotification.parentNode.removeChild(errorNotification);
          }
        }, 300);
      }, 5000);
    }
  };
  
  const handleExportComplaints = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all complaints with current filters but no pagination
      let query = supabase
        .from('complaints')
        .select(`
          *,
          categories (name, icon),
          users:reported_by (first_name, last_name)
        `);
        
      // Apply the same filters as current view
      if (complaintFilters.status) {
        query = query.eq('status', complaintFilters.status);
      }
      
      if (complaintFilters.category) {
        query = query.eq('category_id', complaintFilters.category);
      }
      
      if (complaintFilters.startDate) {
        const startDate = new Date(complaintFilters.startDate);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startDate.toISOString());
      }
      
      if (complaintFilters.endDate) {
        const endDate = new Date(complaintFilters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }
      
      if (complaintFilters.search) {
        query = query.or(`title.ilike.%${complaintFilters.search}%,description.ilike.%${complaintFilters.search}%,id.eq.${!isNaN(parseInt(complaintFilters.search)) ? parseInt(complaintFilters.search) : 0}`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Format data for CSV
      const csvData = data.map(complaint => ({
        'ID': complaint.id,
        'Title': complaint.title,
        'Description': complaint.description,
        'Status': complaint.status,
        'Category': complaint.categories?.name || 'Uncategorized',
        'Reporter': complaint.anonymous ? 'Anonymous' : `${complaint.users?.first_name || ''} ${complaint.users?.last_name || ''}`,
        'Created Date': formatDate(complaint.created_at),
        'Resolved Date': complaint.resolved_at ? formatDate(complaint.resolved_at) : '',
        'Location': complaint.location || ''
      }));
      
      // Convert to CSV
      if (csvData.length === 0) {
        alert('No data to export');
        return;
      }
      
      const headers = Object.keys(csvData[0]).join(',');
      const rows = csvData.map(obj => Object.values(obj).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(','));
      
      const csvContent = [headers, ...rows].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `complaints_export_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      
    } catch (error) {
      console.error('Error exporting complaints:', error);
      alert('Failed to export complaints. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Enhanced Analytics Functions
  const fetchAnalyticsData = async () => {
    try {
      console.log('Fetching comprehensive analytics data...');
      setLoading(true);

      // Parallel fetch for better performance
      const [
        categoryStats,
        statusStats,
        departmentStats,
        trendData,
        resolutionMetrics,
        geospatialData,
        performanceData
      ] = await Promise.all([
        fetchComplaintsByCategory(),
        fetchComplaintsByStatus(), 
        fetchComplaintsByDepartment(),
        fetchTrendAnalysis(),
        fetchResolutionMetrics(),
        fetchGeospatialAnalysis(),
        fetchPerformanceMetrics()
      ]);

      setAnalyticsData({
        complaintsByCategory: categoryStats,
        complaintsByStatus: statusStats,
        complaintsByDepartment: departmentStats,
        trendData: trendData.trends,
        timeSeriesData: trendData.timeSeries,
        resolutionTime: resolutionMetrics.avgTime,
        avgResolutionTime: resolutionMetrics.avgHours,
        performanceMetrics: performanceData,
        geospatialData: geospatialData.clusters,
        heatmapData: geospatialData.heatmap,
        densityAnalysis: geospatialData.density,
        categoryTrends: trendData.categoryTrends
      });

      console.log('Analytics data loaded successfully');
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch complaints by category with enhanced metrics
  const fetchComplaintsByCategory = async () => {
    try {
      let query = supabase
        .from('complaints')
        .select(`
          category_id,
          status,
          created_at,
          resolved_at,
          categories (id, name, icon)
        `);

      // Apply department filtering for Department Admins
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process data with enhanced metrics
      const categoryMap = {};
      
      data.forEach(complaint => {
        const categoryId = complaint.category_id;
        const categoryName = complaint.categories?.name || 'Uncategorized';
        const categoryIcon = complaint.categories?.icon || '📍';
        
        if (!categoryMap[categoryId]) {
          categoryMap[categoryId] = {
            id: categoryId,
            name: categoryName,
            icon: categoryIcon,
            total: 0,
            open: 0,
            inProgress: 0,
            resolved: 0,
            avgResolutionTime: 0,
            resolutionTimes: []
          };
        }
        
        categoryMap[categoryId].total++;
        
        if (complaint.status === 'open') categoryMap[categoryId].open++;
        else if (complaint.status === 'in_progress') categoryMap[categoryId].inProgress++;
        else if (complaint.status === 'resolved') {
          categoryMap[categoryId].resolved++;
          
          // Calculate resolution time if available
          if (complaint.resolved_at && complaint.created_at) {
            const resolutionTime = (new Date(complaint.resolved_at) - new Date(complaint.created_at)) / (1000 * 60 * 60);
            categoryMap[categoryId].resolutionTimes.push(resolutionTime);
          }
        }
      });

      // Calculate average resolution times
      Object.values(categoryMap).forEach(category => {
        if (category.resolutionTimes.length > 0) {
          category.avgResolutionTime = category.resolutionTimes.reduce((a, b) => a + b, 0) / category.resolutionTimes.length;
        }
        category.resolutionRate = category.total > 0 ? (category.resolved / category.total * 100).toFixed(1) : 0;
      });

      return Object.values(categoryMap).sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error('Error fetching category analytics:', error);
      return [];
    }
  };

  // Fetch complaints by status with time-based analysis
  const fetchComplaintsByStatus = async () => {
    try {
      let query = supabase
        .from('complaints')
        .select('status, created_at, resolved_at');

      // Apply department filtering
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const statusStats = {
        open: { count: 0, avgAge: 0, ages: [] },
        in_progress: { count: 0, avgAge: 0, ages: [] },
        resolved: { count: 0, avgResolutionTime: 0, resolutionTimes: [] }
      };

      const now = new Date();

      data.forEach(complaint => {
        const createdAt = new Date(complaint.created_at);
        const ageInHours = (now - createdAt) / (1000 * 60 * 60);

        if (complaint.status === 'open') {
          statusStats.open.count++;
          statusStats.open.ages.push(ageInHours);
        } else if (complaint.status === 'in_progress') {
          statusStats.in_progress.count++;
          statusStats.in_progress.ages.push(ageInHours);
        } else if (complaint.status === 'resolved') {
          statusStats.resolved.count++;
          
          if (complaint.resolved_at) {
            const resolutionTime = (new Date(complaint.resolved_at) - createdAt) / (1000 * 60 * 60);
            statusStats.resolved.resolutionTimes.push(resolutionTime);
          }
        }
      });

      // Calculate averages
      if (statusStats.open.ages.length > 0) {
        statusStats.open.avgAge = statusStats.open.ages.reduce((a, b) => a + b, 0) / statusStats.open.ages.length;
      }
      
      if (statusStats.in_progress.ages.length > 0) {
        statusStats.in_progress.avgAge = statusStats.in_progress.ages.reduce((a, b) => a + b, 0) / statusStats.in_progress.ages.length;
      }
      
      if (statusStats.resolved.resolutionTimes.length > 0) {
        statusStats.resolved.avgResolutionTime = statusStats.resolved.resolutionTimes.reduce((a, b) => a + b, 0) / statusStats.resolved.resolutionTimes.length;
      }

      return [
        { name: 'Open', value: statusStats.open.count, color: '#EF4444', avgAge: statusStats.open.avgAge },
        { name: 'In Progress', value: statusStats.in_progress.count, color: '#F59E0B', avgAge: statusStats.in_progress.avgAge },
        { name: 'Resolved', value: statusStats.resolved.count, color: '#10B981', avgResolutionTime: statusStats.resolved.avgResolutionTime }
      ];
    } catch (error) {
      console.error('Error fetching status analytics:', error);
      return [];
    }
  };

  // Fetch complaints by department
  const fetchComplaintsByDepartment = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          category_id,
          status,
          created_at,
          resolved_at,
          categories (
            id,
            name,
            default_department_id,
            departments (id, name)
          )
        `);

      if (error) throw error;

      const departmentMap = {};

      data.forEach(complaint => {
        const dept = complaint.categories?.departments;
        const deptId = dept?.id || 'unassigned';
        const deptName = dept?.name || 'Unassigned';

        if (!departmentMap[deptId]) {
          departmentMap[deptId] = {
            id: deptId,
            name: deptName,
            total: 0,
            open: 0,
            inProgress: 0,
            resolved: 0,
            avgResolutionTime: 0,
            resolutionTimes: []
          };
        }

        departmentMap[deptId].total++;
        
        if (complaint.status === 'open') departmentMap[deptId].open++;
        else if (complaint.status === 'in_progress') departmentMap[deptId].inProgress++;
        else if (complaint.status === 'resolved') {
          departmentMap[deptId].resolved++;
          
          if (complaint.resolved_at && complaint.created_at) {
            const resolutionTime = (new Date(complaint.resolved_at) - new Date(complaint.created_at)) / (1000 * 60 * 60);
            departmentMap[deptId].resolutionTimes.push(resolutionTime);
          }
        }
      });

      // Calculate metrics
      Object.values(departmentMap).forEach(dept => {
        if (dept.resolutionTimes.length > 0) {
          dept.avgResolutionTime = dept.resolutionTimes.reduce((a, b) => a + b, 0) / dept.resolutionTimes.length;
        }
        dept.resolutionRate = dept.total > 0 ? (dept.resolved / dept.total * 100).toFixed(1) : 0;
        dept.efficiency = dept.total > 0 ? ((dept.resolved + dept.inProgress) / dept.total * 100).toFixed(1) : 0;
      });

      return Object.values(departmentMap).sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error('Error fetching department analytics:', error);
      return [];
    }
  };

  // Enhanced trend analysis with time series data
  const fetchTrendAnalysis = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('complaints')
        .select('created_at, status, category_id, categories(name)')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Apply department filtering
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process daily trends
      const dailyTrends = {};
      const categoryTrends = {};

      data.forEach(complaint => {
        const date = new Date(complaint.created_at).toISOString().split('T')[0];
        const category = complaint.categories?.name || 'Uncategorized';

        // Daily trends
        if (!dailyTrends[date]) {
          dailyTrends[date] = { date, total: 0, open: 0, inProgress: 0, resolved: 0 };
        }
        dailyTrends[date].total++;
        dailyTrends[date][complaint.status.replace('_', '')]++;

        // Category trends
        if (!categoryTrends[category]) {
          categoryTrends[category] = {};
        }
        if (!categoryTrends[category][date]) {
          categoryTrends[category][date] = 0;
        }
        categoryTrends[category][date]++;
      });

      // Fill missing dates with zeros
      const trends = [];
      const timeSeries = [];
      const now = new Date();
      
      for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayData = dailyTrends[dateStr] || { date: dateStr, total: 0, open: 0, inProgress: 0, resolved: 0 };
        
        trends.push(dayData);
        timeSeries.push({
          date: dateStr,
          complaints: dayData.total,
          weekday: d.toLocaleDateString('en-US', { weekday: 'long' })
        });
      }

      return {
        trends: trends.sort((a, b) => new Date(a.date) - new Date(b.date)),
        timeSeries: timeSeries,
        categoryTrends: Object.entries(categoryTrends).map(([category, data]) => ({
          category,
          data: Object.entries(data).map(([date, count]) => ({ date, count }))
        }))
      };
    } catch (error) {
      console.error('Error fetching trend analysis:', error);
      return { trends: [], timeSeries: [], categoryTrends: [] };
    }
  };

  // Enhanced resolution metrics
  const fetchResolutionMetrics = async () => {
    try {
      let query = supabase
        .from('complaints')
        .select('created_at, resolved_at, status')
        .eq('status', 'resolved')
        .not('resolved_at', 'is', null);

      // Apply department filtering
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        return { avgTime: 'No data', avgHours: 0 };
      }

      const resolutionTimes = data.map(complaint => {
        const created = new Date(complaint.created_at);
        const resolved = new Date(complaint.resolved_at);
        return (resolved - created) / (1000 * 60 * 60); // in hours
      });

      const avgHours = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
      
      let avgTime;
      if (avgHours < 24) {
        avgTime = `${avgHours.toFixed(1)} hours`;
      } else {
        avgTime = `${(avgHours / 24).toFixed(1)} days`;
      }

      return { avgTime, avgHours };
    } catch (error) {
      console.error('Error fetching resolution metrics:', error);
      return { avgTime: 'Error', avgHours: 0 };
    }
  };

  // Enhanced geospatial analysis for Leaflet integration
  const fetchGeospatialAnalysis = async () => {
    try {
      let query = supabase
        .from('complaints')
        .select('id, location, status, category_id, created_at, categories(name, icon)');

      // Apply department filtering
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const geoData = data
        .map(complaint => {
          const parsedLocation = parseLocation(complaint.location);
          if (!parsedLocation || !parsedLocation.latitude || !parsedLocation.longitude) {
            return null;
          }
          
          return {
            id: complaint.id,
            lat: parsedLocation.latitude,
            lng: parsedLocation.longitude,
            status: complaint.status,
            category: complaint.categories?.name || 'Uncategorized',
            categoryIcon: complaint.categories?.icon || '📍',
            created_at: complaint.created_at
          };
        })
        .filter(item => item !== null);

      // Create clusters for density analysis
      const clusters = createDensityClusters(geoData);
      
      // Create heatmap data for Leaflet
      const heatmapData = geoData.map(point => [point.lat, point.lng, 1]);
      
      // Analyze density patterns
      const densityAnalysis = analyzeDensityPatterns(geoData);

      return {
        clusters,
        heatmap: heatmapData,
        density: densityAnalysis,
        totalGeolocated: geoData.length
      };
    } catch (error) {
      console.error('Error fetching geospatial analysis:', error);
      return { clusters: [], heatmap: [], density: [], totalGeolocated: 0 };
    }
  };

  // Performance metrics calculation
  const fetchPerformanceMetrics = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('complaints')
        .select('created_at, resolved_at, status, updated_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Apply department filtering
      if (user?.roles?.name === 'Department Admin' && user?.department_id) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', user.department_id);
          
        if (deptCategories && deptCategories.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data.length;
      const resolved = data.filter(c => c.status === 'resolved').length;
      const inProgress = data.filter(c => c.status === 'in_progress').length;

      // Calculate response time (time to first update)
      const responseTimes = data
        .filter(c => c.updated_at !== c.created_at)
        .map(c => (new Date(c.updated_at) - new Date(c.created_at)) / (1000 * 60 * 60));

      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      // Calculate resolution rate
      const resolutionRate = total > 0 ? (resolved / total * 100) : 0;

      // Simulate customer satisfaction (would come from feedback system)
      const customerSatisfaction = Math.min(100, Math.max(0, 85 - (avgResponseTime / 24) * 5));

      // Calculate reopen rate (simulated - would need tracking of reopened complaints)
      const reopenRate = Math.max(0, 5 - (resolutionRate / 20));

      return {
        responseTime: avgResponseTime,
        resolutionRate: resolutionRate,
        customerSatisfaction: customerSatisfaction,
        reopenRate: reopenRate
      };
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return {
        responseTime: 0,
        resolutionRate: 0,
        customerSatisfaction: 0,
        reopenRate: 0
      };
    }
  };

  // Utility function to create density clusters
  const createDensityClusters = (geoData) => {
    const clusters = [];
    const processed = new Set();
    const clusterRadius = 0.01; // Approximately 1km at equator

    geoData.forEach((point, index) => {
      if (processed.has(index)) return;

      const cluster = {
        center: { lat: point.lat, lng: point.lng },
        points: [point],
        totalComplaints: 1,
        statusBreakdown: { open: 0, in_progress: 0, resolved: 0 },
        categories: {}
      };

      // Count initial point
      cluster.statusBreakdown[point.status]++;
      cluster.categories[point.category] = (cluster.categories[point.category] || 0) + 1;

      // Find nearby points
      geoData.forEach((otherPoint, otherIndex) => {
        if (otherIndex === index || processed.has(otherIndex)) return;

        const distance = Math.sqrt(
          Math.pow(point.lat - otherPoint.lat, 2) + 
          Math.pow(point.lng - otherPoint.lng, 2)
        );

        if (distance <= clusterRadius) {
          cluster.points.push(otherPoint);
          cluster.totalComplaints++;
          cluster.statusBreakdown[otherPoint.status]++;
          cluster.categories[otherPoint.category] = (cluster.categories[otherPoint.category] || 0) + 1;
          processed.add(otherIndex);
        }
      });

      processed.add(index);
      clusters.push(cluster);
    });

    return clusters.sort((a, b) => b.totalComplaints - a.totalComplaints);
  };

  // Utility function to analyze density patterns
  const analyzeDensityPatterns = (geoData) => {
    if (geoData.length === 0) return [];

    // Calculate bounding box
    const lats = geoData.map(p => p.lat);
    const lngs = geoData.map(p => p.lng);
    
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    // Create grid for density analysis
    const gridSize = 0.005; // Grid cell size
    const grid = {};

    geoData.forEach(point => {
      const gridLat = Math.floor(point.lat / gridSize) * gridSize;
      const gridLng = Math.floor(point.lng / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;

      if (!grid[key]) {
        grid[key] = {
          lat: gridLat,
          lng: gridLng,
          count: 0,
          density: 'low'
        };
      }
      grid[key].count++;
    });

    // Determine density levels
    const counts = Object.values(grid).map(cell => cell.count);
    const maxCount = Math.max(...counts);
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

    Object.values(grid).forEach(cell => {
      if (cell.count >= maxCount * 0.7) cell.density = 'high';
      else if (cell.count >= avgCount) cell.density = 'medium';
      else cell.density = 'low';
    });

    return Object.values(grid).filter(cell => cell.count > 0);
  };
  
  // Enhanced export functionality for analytics
  const exportAnalyticsData = async (type) => {
    try {
      setIsExporting(true);
      
      const timestamp = new Date().toISOString().slice(0, 10);
      let exportData = [];
      let filename = '';

      switch (type) {
        case 'summary':
          exportData = [
            {
              'Metric': 'Total Complaints',
              'Value': stats.totalComplaints,
              'Period': 'All Time'
            },
            {
              'Metric': 'Open Complaints',
              'Value': stats.openComplaints,
              'Period': 'Current'
            },
            {
              'Metric': 'Resolution Rate',
              'Value': `${analyticsData.performanceMetrics.resolutionRate?.toFixed(1)}%`,
              'Period': 'Last 30 Days'
            },
            {
              'Metric': 'Average Response Time',
              'Value': `${analyticsData.performanceMetrics.responseTime?.toFixed(1)} hours`,
              'Period': 'Last 30 Days'
            },
            {
              'Metric': 'Customer Satisfaction',
              'Value': `${analyticsData.performanceMetrics.customerSatisfaction?.toFixed(0)}%`,
              'Period': 'Estimated'
            }
          ];
          filename = `analytics_summary_${timestamp}.csv`;
          break;

        case 'detailed':
          exportData = analyticsData.complaintsByCategory.map(category => ({
            'Category': category.name,
            'Total Complaints': category.total,
            'Open': category.open,
            'In Progress': category.inProgress,
            'Resolved': category.resolved,
            'Resolution Rate': `${category.resolutionRate}%`,
            'Avg Resolution Time (hours)': category.avgResolutionTime?.toFixed(1) || 'N/A'
          }));
          filename = `analytics_detailed_${timestamp}.csv`;
          break;

        case 'geospatial':
          exportData = analyticsData.geospatialData.map((cluster, index) => ({
            'Cluster ID': index + 1,
            'Latitude': cluster.center.lat.toFixed(6),
            'Longitude': cluster.center.lng.toFixed(6),
            'Total Complaints': cluster.totalComplaints,
            'Open Complaints': cluster.statusBreakdown.open,
            'In Progress': cluster.statusBreakdown.in_progress,
            'Resolved': cluster.statusBreakdown.resolved,
            'Top Category': Object.entries(cluster.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
          }));
          filename = `analytics_geospatial_${timestamp}.csv`;
          break;

        default:
          throw new Error('Invalid export type');
      }

      // Convert to CSV
      if (exportData.length === 0) {
        alert('No data available for export');
        return;
      }

      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(obj => 
        Object.values(obj).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      );

      const csvContent = [headers, ...rows].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting analytics data:', error);
      alert('Failed to export analytics data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Enhanced Drawing and Spatial Analysis Functions
  const initializeDrawingControls = (map) => {
    if (!map || window.adminDrawControl) return;

    try {
      // Create feature groups for drawn items
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      window.adminDrawnItems = drawnItems;

      // Initialize drawing control
      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            drawError: {
              color: '#e1e100',
              message: '<strong>Error:</strong> Shape edges cannot cross!'
            },
            shapeOptions: {
              color: '#1e40af',
              fillColor: '#3b82f6',
              fillOpacity: 0.3,
              weight: 2
            }
          },
          circle: {
            shapeOptions: {
              color: '#dc2626',
              fillColor: '#ef4444',
              fillOpacity: 0.3,
              weight: 2
            }
          },
          rectangle: {
            shapeOptions: {
              color: '#059669',
              fillColor: '#10b981',
              fillOpacity: 0.3,
              weight: 2
            }
          },
          polyline: {
            shapeOptions: {
              color: '#7c3aed',
              weight: 3
            }
          },
          marker: true,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItems,
          remove: true
        }
      });

      map.addControl(drawControl);
      window.adminDrawControl = drawControl;

      // Event handlers for drawing
      map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        const type = e.layerType;
        
        // Add the drawn layer to the feature group
        drawnItems.addLayer(layer);
        
        // Perform spatial analysis
        performSpatialAnalysis(layer, type);
        
        // Update drawn features state
        const feature = layer.toGeoJSON();
        feature.properties = {
          id: Date.now(),
          type: type,
          created: new Date().toISOString(),
          analysisResults: null
        };
        
        setDrawnFeatures(prev => [...prev, feature]);
      });

      map.on(L.Draw.Event.EDITED, function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
          // Re-run spatial analysis for edited features
          const type = layer.options.shapeType || 'polygon';
          performSpatialAnalysis(layer, type);
        });
      });

      map.on(L.Draw.Event.DELETED, function (e) {
        const layers = e.layers;
        layers.eachLayer(function (layer) {
          // Remove from state
          const layerId = layer._leaflet_id;
          setDrawnFeatures(prev => 
            prev.filter(f => f.properties.leafletId !== layerId)
          );
        });
      });

    } catch (error) {
      console.error('Error initializing drawing controls:', error);
    }
  };

  const performSpatialAnalysis = async (drawnLayer, type) => {
    if (!drawnLayer || !complaints.length) return;

    try {
      // Convert complaints to GeoJSON points
      const complaintPoints = complaints
        .map(complaint => {
          const parsedLocation = parseLocation(complaint.location);
          if (!parsedLocation || !parsedLocation.latitude || !parsedLocation.longitude) return null;
          
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [parsedLocation.longitude, parsedLocation.latitude]
            },
            properties: {
              id: complaint.id,
              status: complaint.status,
              category: complaint.categories?.name || 'Uncategorized',
              created_at: complaint.created_at,
              title: complaint.title
            }
          };
        })
        .filter(point => point !== null);

      const drawnFeature = drawnLayer.toGeoJSON();
      let analysisResults = {};

      if (type === 'polygon' || type === 'rectangle') {
        // Points in polygon analysis
        const pointsInside = pointsInPolygon(drawnFeature, complaintPoints);
        
        analysisResults = {
          type: 'polygon_analysis',
          totalPoints: pointsInside.length,
          pointsInside: pointsInside,
          statusBreakdown: pointsInside.reduce((acc, point) => {
            const status = point.properties.status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {}),
          categoryBreakdown: pointsInside.reduce((acc, point) => {
            const category = point.properties.category;
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {})
        };
      } else if (type === 'circle') {
        // Buffer analysis
        const center = drawnLayer.getLatLng();
        const radius = drawnLayer.getRadius();
        
        const pointsInRadius = complaintPoints.filter(point => {
          const pointLatLng = L.latLng(
            point.geometry.coordinates[1], 
            point.geometry.coordinates[0]
          );
          return center.distanceTo(pointLatLng) <= radius;
        });

        analysisResults = {
          type: 'buffer_analysis',
          center: [center.lat, center.lng],
          radius: radius,
          totalPoints: pointsInRadius.length,
          pointsInRadius: pointsInRadius,
          density: pointsInRadius.length / (Math.PI * Math.pow(radius / 1000, 2)), // points per km²
          statusBreakdown: pointsInRadius.reduce((acc, point) => {
            const status = point.properties.status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {})
        };
      }

      // Update the spatial analysis results
      setSpatialAnalysisResults(prev => ({
        ...prev,
        [drawnLayer._leaflet_id]: analysisResults
      }));

      // Show results popup
      showAnalysisPopup(drawnLayer, analysisResults);

    } catch (error) {
      console.error('Error performing spatial analysis:', error);
    }
  };

  const showAnalysisPopup = (layer, results) => {
    let popupContent = `<div class="spatial-analysis-popup">
      <h4 class="font-bold text-lg mb-2">Spatial Analysis Results</h4>`;

    if (results.type === 'polygon_analysis') {
      popupContent += `
        <p><strong>Total Complaints:</strong> ${results.totalPoints}</p>
        <div class="mt-2">
          <strong>Status Breakdown:</strong>
          <ul class="list-disc list-inside">`;
      
      Object.entries(results.statusBreakdown).forEach(([status, count]) => {
        popupContent += `<li>${status}: ${count}</li>`;
      });
      
      popupContent += `</ul></div>`;
    } else if (results.type === 'buffer_analysis') {
      popupContent += `
        <p><strong>Radius:</strong> ${(results.radius / 1000).toFixed(2)} km</p>
        <p><strong>Total Complaints:</strong> ${results.totalPoints}</p>
        <p><strong>Density:</strong> ${results.density.toFixed(2)} complaints/km²</p>`;
    }

    popupContent += `</div>`;

    layer.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'spatial-analysis-popup'
    }).openPopup();
  };

  const addHeatmapLayer = (map) => {
    if (!map || !analyticsData.heatmapData?.length) return;

    try {
      // Remove existing heatmap
      if (window.adminHeatmapLayer) {
        map.removeLayer(window.adminHeatmapLayer);
      }

      // Create heatmap layer
      const heatmapData = analyticsData.heatmapData.map(point => [
        point[0], point[1], point[2] || 1
      ]);

      const heatmapLayer = L.heatLayer(heatmapData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: 1,
        gradient: {
          0.0: 'blue',
          0.2: 'lime',
          0.4: 'yellow',
          0.6: 'orange',
          0.8: 'red',
          1.0: 'magenta'
        }
      });

      if (heatmapVisible) {
        map.addLayer(heatmapLayer);
      }

      window.adminHeatmapLayer = heatmapLayer;
    } catch (error) {
      console.error('Error adding heatmap layer:', error);
    }
  };

  const toggleHeatmap = () => {
    const map = window.adminMapInstance;
    if (!map) return;

    setHeatmapVisible(prev => {
      const newVisible = !prev;
      
      if (newVisible && window.adminHeatmapLayer) {
        map.addLayer(window.adminHeatmapLayer);
      } else if (!newVisible && window.adminHeatmapLayer) {
        map.removeLayer(window.adminHeatmapLayer);
      }
      
      return newVisible;
    });
  };

  const clearDrawnFeatures = () => {
    if (window.adminDrawnItems) {
      window.adminDrawnItems.clearLayers();
    }
    setDrawnFeatures([]);
    setSpatialAnalysisResults({});
  };

  // Enhanced Chart Functions
  const initializeStatusChart = () => {
    if (!statusChartRef.current || !analyticsData.complaintsByStatus.length) return;

    const ctx = statusChartRef.current.getContext('2d');
    
    // Destroy existing chart
    if (statusChartRef.current.chart) {
      statusChartRef.current.chart.destroy();
    }

    const data = analyticsData.complaintsByStatus.map(item => ({
      label: item.name,
      data: item.value,
      backgroundColor: item.color,
      borderColor: item.color,
      borderWidth: 2
    }));

    statusChartRef.current.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.data),
          backgroundColor: data.map(d => d.backgroundColor),
          borderColor: data.map(d => d.borderColor),
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  };

  const initializeTrendChart = () => {
    if (!trendChartRef.current || !analyticsData.trendData.length) return;

    const ctx = trendChartRef.current.getContext('2d');
    
    if (trendChartRef.current.chart) {
      trendChartRef.current.chart.destroy();
    }

    const labels = analyticsData.trendData.map(item => 
      new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );

    trendChartRef.current.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Complaints',
          data: analyticsData.trendData.map(item => item.total),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'Resolved',
          data: analyticsData.trendData.map(item => item.resolved),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  };

  const initializePerformanceChart = () => {
    if (!performanceChartRef.current || !analyticsData.performanceMetrics) return;

    const ctx = performanceChartRef.current.getContext('2d');
    
    if (performanceChartRef.current.chart) {
      performanceChartRef.current.chart.destroy();
    }

    const metrics = analyticsData.performanceMetrics;
    
    performanceChartRef.current.chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Resolution Rate', 'Response Time', 'Satisfaction', 'Efficiency'],
        datasets: [{
          label: 'Performance Metrics',
          data: [
            metrics.resolutionRate,
            100 - Math.min(metrics.responseTime * 2, 100), // Invert response time for radar
            metrics.customerSatisfaction,
            100 - metrics.reopenRate // Invert reopen rate
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: '#3b82f6',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#3b82f6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        elements: {
          line: {
            borderWidth: 3
          }
        },
        scales: {
          r: {
            angleLines: {
              display: true
            },
            suggestedMin: 0,
            suggestedMax: 100
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  };

  // Initialize charts when analytics data changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      setTimeout(() => {
        initializeStatusChart();
        initializeTrendChart();
        initializePerformanceChart();
        initializeAnalyticsMiniMap();
      }, 100);
    }
  }, [analyticsData, activeTab]);

  // Initialize map when map tab becomes active
  useEffect(() => {
    if (activeTab === 'map') {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      const initMap = () => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = mapContainerRef.current || document.getElementById('admin-map-container');
            if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
              loadMapComponent();
              // Apply any existing filters to the map
              if (isFilterApplied) {
                fetchMapComplaints(complaintFilters);
              }
            } else {
              // Retry if container not ready
              setTimeout(initMap, 100);
            }
          }, 50);
        });
      };
      initMap();
    }
    
    // Cleanup function to prevent memory leaks and DOM conflicts
    return () => {
      if (activeTab !== 'map') {
        // Clean up map instance when leaving map tab
        if (window.adminMapInstance) {
          try {
            // Prevent React from trying to clean up DOM nodes that Leaflet manages
            const container = mapContainerRef.current || document.getElementById('admin-map-container');
            if (container) {
              // Let Leaflet clean up its own DOM nodes
              window.adminMapInstance.off();
              window.adminMapInstance.remove();
              window.adminMapInstance = null;
              
              // Clear the container to prevent React conflicts
              container.innerHTML = '';
            }
          } catch (error) {
            console.warn('Error during map cleanup:', error);
            // Force clear the container if cleanup fails
            const container = mapContainerRef.current || document.getElementById('admin-map-container');
            if (container) {
              container.innerHTML = '';
            }
          }
        }
        
        if (window.adminMapCleanup) {
          window.adminMapCleanup();
          window.adminMapCleanup = null;
        }
      }
    };
  }, [activeTab, complaints]); // Re-initialize when activeTab changes or complaints data updates

  // Initialize mini analytics map
  const initializeAnalyticsMiniMap = () => {
    const mapContainer = document.getElementById('analytics-mini-map');
    if (!mapContainer || window.analyticsMiniMap) return;

    try {
      const miniMap = L.map('analytics-mini-map', {
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: false,
        touchZoom: false
      }).setView([40.7128, -74.0060], 10);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        opacity: 0.7
      }).addTo(miniMap);

      // Add heatmap if data available
      if (analyticsData.heatmapData && analyticsData.heatmapData.length > 0) {
        const heatLayer = L.heatLayer(analyticsData.heatmapData, {
          radius: 20,
          blur: 10,
          maxZoom: 17,
          gradient: {
            0.0: 'blue',
            0.2: 'lime', 
            0.4: 'yellow',
            0.6: 'orange',
            0.8: 'red',
            1.0: 'magenta'
          }
        }).addTo(miniMap);

        // Fit map to heatmap bounds
        if (analyticsData.heatmapData.length > 1) {
          const bounds = L.latLngBounds(analyticsData.heatmapData.map(point => [point[0], point[1]]));
          miniMap.fitBounds(bounds, { padding: [10, 10] });
        }
      }

      // Add cluster markers
      if (analyticsData.geospatialData && analyticsData.geospatialData.length > 0) {
        analyticsData.geospatialData.slice(0, 10).forEach((cluster, index) => {
          const marker = L.circleMarker([cluster.center.lat, cluster.center.lng], {
            radius: Math.min(8 + (cluster.totalComplaints / 5), 15),
            fillColor: cluster.totalComplaints > 10 ? '#ef4444' : 
                      cluster.totalComplaints > 5 ? '#f59e0b' : '#10b981',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(miniMap);

          marker.bindTooltip(`Cluster ${index + 1}: ${cluster.totalComplaints} complaints`, {
            permanent: false,
            direction: 'top'
          });
        });
      }

      window.analyticsMiniMap = miniMap;
    } catch (error) {
      console.error('Error initializing analytics mini map:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  
  // Function to load map component in admin dashboard
  const loadMapComponent = () => {
    const adminMapContainer = mapContainerRef.current || document.getElementById('admin-map-container');
    if (!adminMapContainer) {
      console.warn('Admin map container not found');
      return;
    }

    // Check if container has proper dimensions
    const containerRect = adminMapContainer.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn('Admin map container has no dimensions, retrying...');
      setTimeout(loadMapComponent, 100);
      return;
    }

    // Remove existing map instance if it exists
    if (window.adminMapInstance) {
      try {
        // Properly clean up all Leaflet components
        window.adminMapInstance.off(); // Remove all event listeners
        window.adminMapInstance.eachLayer((layer) => {
          try {
            window.adminMapInstance.removeLayer(layer);
          } catch (e) {
            console.warn('Error removing layer:', e);
          }
        });
        window.adminMapInstance.remove();
        window.adminMapInstance = null;
      } catch (error) {
        console.warn('Error removing existing map:', error);
        // Force cleanup
        window.adminMapInstance = null;
      }
    }
    
    console.log('Initializing admin map with enhanced features');
    console.log('Map container ready:', {
      element: adminMapContainer,
      bounds: containerRect,
      visible: adminMapContainer.offsetParent !== null
    });

    try {
      // Show loading indicator that won't conflict with Leaflet
      adminMapContainer.innerHTML = `
        <div id="map-loading" style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f8f9fa;
          z-index: 1000;
        ">
          <div style="text-align: center;">
            <div style="font-size: 24px; margin-bottom: 8px;">🗺️</div>
            <p style="color: #6b7280; font-size: 14px;">Loading map...</p>
          </div>
        </div>
      `;
      
      // Force container dimensions
      adminMapContainer.style.width = '100%';
      adminMapContainer.style.height = '600px';
      adminMapContainer.style.minHeight = '600px';
      adminMapContainer.style.position = 'relative';
      adminMapContainer.style.zIndex = '1';
      
      console.log('Container dimensions:', {
        width: adminMapContainer.offsetWidth,
        height: adminMapContainer.offsetHeight,
        clientWidth: adminMapContainer.clientWidth,
        clientHeight: adminMapContainer.clientHeight
      });
      
      // Create a Leaflet map instance for admin (Default to Pakistan - Islamabad)
      const map = L.map(adminMapContainer, {
        preferCanvas: false, // Try raster rendering first
        attributionControl: true,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false
      }).setView([33.6844, 73.0479], 6); // Center on Pakistan
      
      // Add tile layer with error handling and multiple sources
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        detectRetina: true,
        crossOrigin: true,
        subdomains: ['a', 'b', 'c']
      });
      
      tileLayer.on('loading', () => {
        console.log('Tiles are loading...');
      });
      
      tileLayer.on('load', () => {
        console.log('Tiles have loaded successfully');
      });
      
      tileLayer.on('tileerror', (e) => {
        console.warn('Tile loading error:', e);
      });
      
      tileLayer.addTo(map);
      
      // Store reference
      window.adminMapInstance = map;
      
      // Remove loading indicator once map is ready
      const loadingElement = document.getElementById('map-loading');
      if (loadingElement) {
        loadingElement.remove();
      }
      
      // Add a test marker to verify map is working
      const testMarker = L.marker([33.6844, 73.0479]).addTo(map);
      testMarker.bindPopup('<b>Map Test</b><br>Admin Dashboard Map is working!').openPopup();
      console.log('Test marker added to map');
      
      // Initialize drawing controls
      initializeDrawingControls(map);
      
      // Add heatmap layer
      addHeatmapLayer(map);
      
      // Load complaints data and fit bounds if available
      if (complaints.length > 0) {
        addComplaintsToAdminMap(map, complaints);
        
        // Calculate bounds from complaints and fit map view
        const validComplaintsWithCoords = complaints.filter(complaint => {
          if (!complaint.location) return false;
          
          let lat = null, lng = null;
          if (typeof complaint.location === 'string') {
            const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)\s*\)/i);
            if (pointMatch && pointMatch.length >= 3) {
              lng = parseFloat(pointMatch[1]);
              lat = parseFloat(pointMatch[2]);
            }
          } else if (typeof complaint.location === 'object' && complaint.location.coordinates) {
            [lng, lat] = complaint.location.coordinates;
          }
          
          return lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
        });

        if (validComplaintsWithCoords.length > 0) {
          const bounds = L.latLngBounds();
          validComplaintsWithCoords.forEach(complaint => {
            let lat = null, lng = null;
            if (typeof complaint.location === 'string') {
              const pointMatch = complaint.location.match(/POINT\s*\(\s*([-+]?\d+\.?\d*)\s+([-+]?\d+\.?\d*)\s*\)/i);
              if (pointMatch && pointMatch.length >= 3) {
                lng = parseFloat(pointMatch[1]);
                lat = parseFloat(pointMatch[2]);
              }
            } else if (typeof complaint.location === 'object' && complaint.location.coordinates) {
              [lng, lat] = complaint.location.coordinates;
            }
            
            if (lat !== null && lng !== null) {
              bounds.extend([lat, lng]);
            }
          });
          
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20] });
          }
        }
      } else {
        fetchMapComplaints(complaintFilters);
      }
      
      // Force a pan to refresh tiles
      setTimeout(() => {
        if (window.adminMapInstance) {
          try {
            console.log('Forcing map pan to refresh tiles');
            const currentCenter = window.adminMapInstance.getCenter();
            window.adminMapInstance.panTo([currentCenter.lat + 0.001, currentCenter.lng + 0.001]);
            setTimeout(() => {
              window.adminMapInstance.panTo(currentCenter);
            }, 100);
          } catch (error) {
            console.warn('Error in map pan refresh:', error);
          }
        }
      }, 200);
      
      // Add layer control for toggling features
      const baseLayers = {
        "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18,
          crossOrigin: true
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '© Esri',
          maxZoom: 18
        })
      };
      
      const overlayLayers = {};
      if (window.adminHeatmapLayer) {
        overlayLayers["Heatmap"] = window.adminHeatmapLayer;
      }
      
      L.control.layers(baseLayers, overlayLayers, {
        position: 'topleft'
      }).addTo(map);
      
      // Force immediate size invalidation
      setTimeout(() => {
        if (window.adminMapInstance) {
          try {
            console.log('Force invalidating map size immediately');
            window.adminMapInstance.invalidateSize(true);
          } catch (error) {
            console.warn('Error in immediate size invalidation:', error);
          }
        }
      }, 50);
      
      // Wait for map to be fully initialized before invalidating size
      map.whenReady(() => {
        console.log('Map is ready, invalidating size');
        
        // Force multiple size validations
        setTimeout(() => {
          if (window.adminMapInstance) {
            try {
              console.log('Map ready - invalidating size (100ms)');
              window.adminMapInstance.invalidateSize(true);
            } catch (error) {
              console.warn('Error invalidating map size:', error);
            }
          }
        }, 100);
        
        setTimeout(() => {
          if (window.adminMapInstance) {
            try {
              console.log('Map ready - invalidating size (300ms)');
              window.adminMapInstance.invalidateSize(true);
            } catch (error) {
              console.warn('Error in second size invalidation:', error);
            }
          }
        }, 300);
      });
      
      // Additional safety checks for resize after DOM updates
      setTimeout(() => {
        if (window.adminMapInstance) {
          try {
            console.log('Delayed resize check (500ms)');
            window.adminMapInstance.invalidateSize(true);
          } catch (error) {
            console.warn('Error in delayed map resize:', error);
          }
        }
      }, 500);
      
      setTimeout(() => {
        if (window.adminMapInstance) {
          try {
            console.log('Final resize check (1000ms)');
            window.adminMapInstance.invalidateSize(true);
          } catch (error) {
            console.warn('Error in final map resize:', error);
          }
        }
      }, 1000);

      // Add window resize listener to handle container size changes
      const handleResize = () => {
        if (window.adminMapInstance && activeTab === 'map') {
          try {
            setTimeout(() => {
              window.adminMapInstance.invalidateSize(true);
            }, 100);
          } catch (error) {
            console.warn('Error in resize handler:', error);
          }
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // Store cleanup function
      window.adminMapCleanup = () => {
        try {
          window.removeEventListener('resize', handleResize);
          
          if (window.adminMapInstance) {
            // Remove all layers first
            window.adminMapInstance.eachLayer((layer) => {
              try {
                window.adminMapInstance.removeLayer(layer);
              } catch (e) {
                console.warn('Error removing layer during cleanup:', e);
              }
            });
            
            // Remove all event listeners
            window.adminMapInstance.off();
            
            // Remove the map instance
            window.adminMapInstance.remove();
            window.adminMapInstance = null;
          }
          
          // Clear the container
          const container = mapContainerRef.current || document.getElementById('admin-map-container');
          if (container && container.parentNode) {
            container.innerHTML = '';
          }
        } catch (error) {
          console.warn('Error in map cleanup:', error);
          // Force cleanup
          window.adminMapInstance = null;
        }
      };
      
    } catch (error) {
      console.error('Error initializing admin map:', error);
      // Show error message in the map container
      adminMapContainer.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center bg-red-50">
          <div class="text-center">
            <div class="text-red-500 mb-2">⚠️</div>
            <p class="text-red-600 text-sm">Failed to load map: ${error.message}</p>
            <button onclick="setTimeout(() => window.loadMapComponent(), 100)" class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
              Retry
            </button>
          </div>
        </div>
      `;
      
      // Make retry function globally available
      window.loadMapComponent = loadMapComponent;
    }
  };
  
  // Function to add complaints to admin map
  const addComplaintsToAdminMap = (map, complaintsData) => {
    if (!map || !complaintsData) {
      console.log('No map or complaints data available');
      return;
    }
    
    console.log(`Processing ${complaintsData.length} complaints for map display`);
    
    // Create features from complaints
    const features = complaintsData
      .filter(complaint => complaint.parsedLocation)
      .map(complaint => {
        const { parsedLocation } = complaint;
        
        if (!parsedLocation || parsedLocation.latitude === undefined || parsedLocation.longitude === undefined) {
          return null;
        }
        
        // Create marker feature
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parsedLocation.longitude, parsedLocation.latitude]
          },
          properties: {
            id: complaint.id,
            title: complaint.title || 'No Title',
            description: complaint.description || '',
            status: complaint.status || 'unknown',
            category_id: complaint.category_id,
            category_name: complaint.categories?.name || 'Uncategorized',
            category_icon: complaint.categories?.icon || '📍',
            created_at: complaint.created_at
          }
        };
      }).filter(f => f !== null);
      
    console.log(`Created ${features.length} valid map features`);
    
    const geojson = {
      type: 'FeatureCollection',
      features: features
    };
    
    // Add complaint data to map immediately
    addComplaintDataToMap(map, geojson);
  };
  
  // Helper function to add complaint data to map
  const addComplaintDataToMap = (map, geojson) => {
    try {
      console.log('Adding complaint data to map with Leaflet markers');
      
      // Clear existing markers if any
      if (window.adminMarkersLayer) {
        map.removeLayer(window.adminMarkersLayer);
      }
      
      // Create marker cluster group
      const markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        iconCreateFunction: function(cluster) {
          const count = cluster.getChildCount();
          let size = 'small';
          if (count >= 30) size = 'large';
          else if (count >= 10) size = 'medium';
          
          return new L.DivIcon({
            html: `<div class="cluster-${size}">${count}</div>`,
            className: 'marker-cluster',
            iconSize: new L.Point(40, 40)
          });
        }
      });
      
      // Add markers for each complaint
      geojson.features.forEach(feature => {
        const { coordinates } = feature.geometry;
        const props = feature.properties;
        
        // Create status color
        let statusColor = '#3498db'; // Default blue
        if (props.status === 'open') statusColor = '#e74c3c'; // Red
        else if (props.status === 'in_progress') statusColor = '#f39c12'; // Yellow
        else if (props.status === 'resolved') statusColor = '#2ecc71'; // Green
        
        // Create custom marker icon
        const markerIcon = L.divIcon({
          className: 'complaint-marker',
          html: `<div style="background-color: ${statusColor}; border: 2px solid white; border-radius: 50%; width: 16px; height: 16px;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        
        // Create marker
        const marker = L.marker([coordinates[1], coordinates[0]], { icon: markerIcon });
        
        // Format status for display
        const displayStatus = props.status === 'in_progress' ? 'In Progress' : 
                              props.status.charAt(0).toUpperCase() + props.status.slice(1);
                              
        // Format date
        const date = props.created_at ? new Date(props.created_at).toLocaleDateString() : 'Unknown date';
        
        // Create popup content
        const popupContent = `
          <div class="font-sans p-2">
            <h3 class="font-bold text-sm">${props.title}</h3>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs">${props.category_icon || '📍'} ${props.category_name}</span>
              <span class="px-1.5 py-0.5 text-xs rounded-full 
                ${props.status === 'open' ? 'bg-red-100 text-red-800' :
                  props.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'}">
                ${displayStatus}
              </span>
            </div>
            <p class="text-xs mt-1">ID: ${props.id} • Reported: ${date}</p>
            <p class="text-xs mt-1 text-blue-600">Click for details</p>
          </div>
        `;
        
        // Bind popup to marker
        marker.bindPopup(popupContent);
        
        // Add click event
        marker.on('click', () => {
          navigate(`/complaint/${props.id}`);
        });
        
        // Add marker to cluster group
        markers.addLayer(marker);
      });
      
      // Add cluster group to map
      map.addLayer(markers);
      window.adminMarkersLayer = markers;
      
      console.log('Successfully updated map with complaint markers');
    } catch (error) {
      console.error('Error adding complaint data to map:', error);
    }
  };
  
  // Enhance the map tab initialization to properly handle filters
  const handleMapTabClick = () => {
    setActiveTab('map');
    // Map initialization will be handled by useEffect
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      {/* Enhanced Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-indigo-900 via-indigo-800 to-indigo-900 text-white shadow-xl">
        <div className="h-16 flex items-center justify-center bg-indigo-800/50 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Settings className="h-5 w-5 text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold">Admin Portal</h1>
          </div>
        </div>
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            <button
              onClick={() => handleTabChange('overview')}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'overview' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <Home className="h-5 w-5 mr-3" />
              Overview
              {activeTab === 'overview' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('users')}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'users' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <Users className="h-5 w-5 mr-3" />
              User Management
              {activeTab === 'users' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('departments')}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'departments' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <Building className="h-5 w-5 mr-3" />
              Departments
              {activeTab === 'departments' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('complaints')}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'complaints' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <AlertTriangle className="h-5 w-5 mr-3" />
              Complaints
              {stats.openComplaints > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {stats.openComplaints}
                </span>
              )}
              {activeTab === 'complaints' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleMapTabClick()}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'map' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <MapIcon className="h-5 w-5 mr-3" />
              Map View
              {activeTab === 'map' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('analytics')}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'analytics' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <BarChart2 className="h-5 w-5 mr-3" />
              Analytics
              {activeTab === 'analytics' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`w-full flex items-center px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
                activeTab === 'settings' 
                  ? 'bg-white/20 font-medium text-white shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/10 text-indigo-100 hover:text-white'
              }`}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
              {activeTab === 'settings' && (
                <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
              )}
            </button>
          </div>
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-indigo-700/50 bg-indigo-900/50 backdrop-blur-sm">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center px-4 py-2.5 text-indigo-200 hover:text-white mb-3 rounded-lg hover:bg-white/10 transition-all duration-200"
          >
            <ArrowLeft className="h-5 w-5 mr-3" />
            Back to User Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2.5 text-indigo-200 hover:text-white rounded-lg hover:bg-white/10 transition-all duration-200"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Enhanced Header */}
        <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-indigo-600 bg-clip-text text-transparent">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'users' && 'User Management'}
                {activeTab === 'departments' && 'Department Management'}
                {activeTab === 'complaints' && 'Complaints Management'}
                {activeTab === 'map' && 'Map View'}
                {activeTab === 'analytics' && 'Analytics'}
                {activeTab === 'settings' && 'System Settings'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {activeTab === 'overview' && 'Monitor system performance and key metrics'}
                {activeTab === 'users' && 'Manage user accounts and permissions'}
                {activeTab === 'departments' && 'Organize departments and assignments'}
                {activeTab === 'complaints' && 'Track and resolve complaints'}
                {activeTab === 'map' && 'Visualize complaints geographically'}
                {activeTab === 'analytics' && 'Advanced analytics and insights'}
                {activeTab === 'settings' && 'Configure system settings'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:text-gray-600 hover:bg-gray-200 focus:outline-none transition-all duration-200">
                  <Bell className="h-5 w-5" />
                  {stats.openComplaints > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {stats.openComplaints > 9 ? '9+' : stats.openComplaints}
                    </span>
                  )}
                </button>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.roles?.name} • {user?.departments?.name || 'No Department'}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-semibold shadow-lg">
                {user?.first_name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Overview Tab - Using DashboardStats component */}
          {activeTab === 'overview' && (
            <DashboardStats 
              stats={stats}
              complaints={complaints}
              formatDate={formatDate}
              handleTabChange={handleTabChange}
            />
          )}

          {/* Users Tab - Using UserManagement component */}
          {activeTab === 'users' && (
            <UserManagement 
              users={users}
              setUsers={setUsers}
              formatDate={formatDate}
              handlePromoteUser={handlePromoteUser}
              departments={departments}
              roles={roles}
            />
          )}

          {/* Department Management Tab */}
          {activeTab === 'departments' && (
            <DepartmentManagement />
          )}

          {/* Complaints Tab - Using ComplaintsTable component */}
          {activeTab === 'complaints' && (
            <ComplaintsTable
              complaints={complaints}
              complaintFilters={complaintFilters}
              setComplaintFilters={setComplaintFilters}
              isFilterApplied={isFilterApplied}
              setIsFilterApplied={setIsFilterApplied}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              handleFilterChange={handleFilterChange}
              applyFilters={applyFilters}
              clearFilters={clearFilters}
              fetchComplaints={fetchComplaints}
              complaintsSorting={complaintsSorting}
              handleSortChange={handleSortChange}
              complaintsPage={complaintsPage}
              complaintsPagination={complaintsPagination}
              handlePageChange={handlePageChange}
              selectedComplaints={selectedComplaints}
              setSelectedComplaints={setSelectedComplaints}
              handleBulkStatusChange={handleBulkStatusChange}
              handleIndividualStatusChange={handleIndividualStatusChange}
              categories={categories}
              handleExportComplaints={handleExportComplaints}
              isExporting={isExporting}
              formatDate={formatDate}
            />
          )}

          {/* Enhanced Map View with Analytics Integration */}
          {activeTab === 'map' && (
            <div className="space-y-6">
              {/* Map Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg">
                <div className="px-6 py-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">Interactive Complaints Map</h3>
                      <p className="text-blue-100 text-sm mt-1">
                        Geographic distribution and clustering analysis with real-time data
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="bg-white/20 rounded-lg px-3 py-1 text-white text-sm">
                        {complaints.length} Total
                      </div>
                      <div className="bg-white/20 rounded-lg px-3 py-1 text-white text-sm">
                        {analyticsData.heatmapData?.length || 0} Mapped
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Controls and Filters */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 mb-6">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
                      <select
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg transition-all duration-200"
                        onChange={(e) => {
                          setComplaintFilters(prev => ({...prev, status: e.target.value}));
                          fetchMapComplaints({...complaintFilters, status: e.target.value});
                        }}
                        value={complaintFilters.status}
                      >
                        <option value="">All Statuses</option>
                        <option value="open">🔴 Open</option>
                        <option value="in_progress">🟡 In Progress</option>
                        <option value="resolved">🟢 Resolved</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category Filter</label>
                      <select
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg transition-all duration-200"
                        onChange={(e) => {
                          setComplaintFilters(prev => ({...prev, category: e.target.value}));
                          fetchMapComplaints({...complaintFilters, category: e.target.value});
                        }}
                        value={complaintFilters.category}
                      >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Heatmap</label>
                      <button
                        onClick={toggleHeatmap}
                        className={`w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium transition-all duration-200 ${
                          heatmapVisible 
                            ? 'bg-red-50 text-red-700 border-red-300' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {heatmapVisible ? 'Hide Heatmap' : 'Show Heatmap'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Actions</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fetchGeospatialAnalysis().then(geoData => {
                            console.log('Refreshed geospatial analysis:', geoData);
                            setAnalyticsData(prev => ({
                              ...prev,
                              geospatialData: geoData.clusters,
                              heatmapData: geoData.heatmap,
                              densityAnalysis: geoData.density
                            }));
                          })}
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh
                        </button>
                        
                        {isFilterApplied && (
                          <button
                            onClick={() => {
                              clearFilters();
                              fetchMapComplaints({
                                status: '',
                                category: '',
                                startDate: '',
                                endDate: '',
                                search: '',
                              });
                            }}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Map Analytics Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <MapIcon className="h-8 w-8 text-blue-600 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-blue-700">Total Mapped</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {analyticsData.heatmapData?.length || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                    <div className="flex items-center">
                      <Target className="h-8 w-8 text-indigo-600 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-indigo-700">Clusters</div>
                        <div className="text-2xl font-bold text-indigo-900">
                          {analyticsData.geospatialData?.length || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-red-700">High Density</div>
                        <div className="text-2xl font-bold text-red-900">
                          {analyticsData.densityAnalysis?.filter(d => d.density === 'high').length || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <BarChart2 className="h-8 w-8 text-green-600 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-green-700">Coverage</div>
                        <div className="text-2xl font-bold text-green-900">
                          {complaints.length > 0 ? 
                            ((analyticsData.heatmapData?.length || 0) / complaints.length * 100).toFixed(0) : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Drawing Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Drawing Tools
                  </h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => setDrawingTool('polygon')}
                      className={`w-full flex items-center px-3 py-2 text-xs rounded-lg transition-all duration-200 ${
                        drawingTool === 'polygon' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Polygon Analysis
                    </button>
                    <button
                      onClick={() => setDrawingTool('circle')}
                      className={`w-full flex items-center px-3 py-2 text-xs rounded-lg transition-all duration-200 ${
                        drawingTool === 'circle' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Buffer Analysis
                    </button>
                    <button
                      onClick={clearDrawnFeatures}
                      className="w-full flex items-center px-3 py-2 text-xs rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-all duration-200"
                    >
                      Clear Drawings
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <Layers className="h-4 w-4 mr-2" />
                    Map Layers
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={clusteringEnabled}
                        onChange={(e) => setClusteringEnabled(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-xs text-gray-700">Clustering</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={heatmapVisible}
                        onChange={toggleHeatmap}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                      />
                      <span className="text-xs text-gray-700">Heatmap</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => exportAnalyticsData('geospatial')}
                      disabled={isExporting}
                      className="w-full flex items-center px-3 py-2 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-all duration-200 disabled:opacity-50"
                    >
                      {isExporting ? 'Exporting...' : 'Export GeoData'}
                    </button>
                    <button
                      onClick={() => navigate('/map')}
                      className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      <MapIcon className="h-4 w-4 mr-2" />
                      Full Screen Map
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Analysis Results
                  </h4>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div>Drawn Features: {drawnFeatures.length}</div>
                    <div>Active Analysis: {spatialAnalysisResults ? Object.keys(spatialAnalysisResults).length : 0}</div>
                    {spatialAnalysisResults && Object.keys(spatialAnalysisResults).length > 0 && (
                      <div className="text-blue-600">
                        Click features for details
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Main Map Container */} 
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <div 
                  ref={mapContainerRef}
                  id="admin-map-container" 
                  className="w-full relative admin-map-wrapper"
                  style={{ 
                    minHeight: '600px', 
                    height: '600px',
                    maxHeight: '600px',
                    position: 'relative',
                    zIndex: 1
                  }}
                  suppressHydrationWarning={true}
                >
                  {/* Loading indicator - will be replaced by Leaflet */}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Analytics Tab with Department Focus */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Department Filter */}
              <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Analytics Dashboard</h3>
                  <div className="flex items-center space-x-4">
                    {user?.roles?.name === 'Super Admin' && (
                      <select
                        className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        onChange={(e) => {
                          // Filter analytics by department
                          const deptId = e.target.value;
                          // Re-fetch analytics with department filter
                          fetchAnalyticsData();
                        }}
                      >
                        <option value="">All Departments</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => fetchAnalyticsData()}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </button>
                  </div>
                </div>
              </div>

              {/* Performance Overview Cards Enhanced */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Clock className="h-8 w-8 text-white" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-blue-100 truncate">
                            Avg Response Time
                          </dt>
                          <dd className="text-2xl font-bold text-white">
                            {analyticsData.performanceMetrics?.responseTime ? 
                              `${analyticsData.performanceMetrics.responseTime.toFixed(1)}h` : 
                              '...'
                            }
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <CheckCircle className="h-8 w-8 text-white" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-green-100 truncate">
                            Resolution Rate
                          </dt>
                          <dd className="text-2xl font-bold text-white">
                            {analyticsData.performanceMetrics?.resolutionRate ? 
                              `${analyticsData.performanceMetrics.resolutionRate.toFixed(1)}%` : 
                              '...'
                            }
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <BarChart2 className="h-8 w-8 text-white" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-purple-100 truncate">
                            Satisfaction
                          </dt>
                          <dd className="text-2xl font-bold text-white">
                            {analyticsData.performanceMetrics?.customerSatisfaction ? 
                              `${analyticsData.performanceMetrics.customerSatisfaction.toFixed(0)}%` : 
                              '...'
                            }
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <RefreshCw className="h-8 w-8 text-white" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-orange-100 truncate">
                            Reopen Rate
                          </dt>
                          <dd className="text-2xl font-bold text-white">
                            {analyticsData.performanceMetrics?.reopenRate ? 
                              `${analyticsData.performanceMetrics.reopenRate.toFixed(1)}%` : 
                              '...'
                            }
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Building className="h-8 w-8 text-white" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-indigo-100 truncate">
                            Departments
                          </dt>
                          <dd className="text-2xl font-bold text-white">
                            {analyticsData.complaintsByDepartment?.length || 0}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Analytics Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Complaints by Category Chart */}
                <div className="xl:col-span-1 bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Complaints by Category</h3>
                    <div className="text-sm text-gray-500">
                      Top {analyticsData.complaintsByCategory.slice(0, 8).length} Categories
                    </div>
                  </div>
                  {analyticsData.complaintsByCategory.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analyticsData.complaintsByCategory.slice(0, 8)}
                          margin={{ top: 20, right: 10, left: 10, bottom: 80 }}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={100}
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip 
                            formatter={(value, name) => [value, 'Complaints']}
                            labelFormatter={(label) => `${label}`}
                          />
                          <Bar 
                            dataKey="total" 
                            fill="#3b82f6" 
                            radius={[0, 4, 4, 0]}
                          >
                            {analyticsData.complaintsByCategory.slice(0, 8).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={[
                                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
                                '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
                              ][index % 8]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <BarChart2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p>Loading category data...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resolution Time by Category */}
                <div className="xl:col-span-1 bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Resolution Time by Category</h3>
                    <div className="text-sm text-gray-500">Hours</div>
                  </div>
                  {analyticsData.complaintsByCategory.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analyticsData.complaintsByCategory.slice(0, 6).map(cat => ({
                            ...cat,
                            shortName: cat.name.split(' ')[0] // Shorten names for better display
                          }))}
                          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis 
                            dataKey="shortName"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            interval={0}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis 
                            tick={{ fontSize: 10 }}
                            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip 
                            formatter={(value) => [`${value.toFixed(1)}h`, 'Avg Resolution Time']}
                            labelFormatter={(label) => {
                              const category = analyticsData.complaintsByCategory.find(cat => 
                                cat.name.split(' ')[0] === label
                              );
                              return category ? category.name : label;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="avgResolutionTime" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fill="url(#resolutionGradient)"
                          />
                          <defs>
                            <linearGradient id="resolutionGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p>Loading resolution data...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mini Analytics Map */}
                <div className="xl:col-span-1 bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Geographic Overview</h3>
                    <button
                      onClick={() => setActiveTab('map')}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      View Full Map
                    </button>
                  </div>
                  <div id="analytics-mini-map" className="h-80 bg-gray-100 rounded-lg"></div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {analyticsData.geospatialData?.length || 0}
                      </p>
                      <p className="text-xs text-gray-500">Hotspots</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {analyticsData.heatmapData?.length || 0}
                      </p>
                      <p className="text-xs text-gray-500">Points</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Analysis Section */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Department Performance Matrix */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Department Performance Matrix</h3>
                  {analyticsData.complaintsByDepartment.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.complaintsByDepartment.slice(0, 6)}
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            innerRadius={40}
                            fill="#8884d8"
                            dataKey="total"
                            label={({name, value, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {analyticsData.complaintsByDepartment.slice(0, 6).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={[
                                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
                              ][index % 6]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [value, 'Total Complaints']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Building className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p>Loading department data...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Department Efficiency Radar */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Department Efficiency Analysis</h3>
                  {analyticsData.complaintsByDepartment.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart 
                          cx="50%" 
                          cy="50%" 
                          innerRadius="10%" 
                          outerRadius="80%" 
                          data={analyticsData.complaintsByDepartment.slice(0, 5).map((dept, index) => ({
                            ...dept,
                            fill: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index],
                            shortName: dept.name.split(' ')[0]
                          }))}
                        >
                          <RadialBar 
                            dataKey="efficiency" 
                            cornerRadius={4} 
                            fill="#8884d8" 
                            label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
                          />
                          <Tooltip formatter={(value, name) => [`${value}%`, 'Efficiency Score']} />
                          <Legend />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p>Loading efficiency data...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Trend Analysis with Enhanced Visualization */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">30-Day Trend Analysis</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                        Total Complaints
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                        Resolved
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                        In Progress
                      </div>
                    </div>
                  </div>
                </div>
                {analyticsData.trendData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={analyticsData.trendData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="date"
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval="preserveStartEnd"
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                          formatter={(value, name) => [value, name === 'total' ? 'Total Complaints' : name === 'resolved' ? 'Resolved' : 'In Progress']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="resolved" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="in_progress" 
                          stroke="#f59e0b" 
                          strokeWidth={3}
                          dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p>Loading trend data...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Distribution with Chart.js */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Status Distribution</h3>
                    <div className="text-sm text-gray-500">
                      Total: {analyticsData.complaintsByStatus.reduce((sum, s) => sum + s.value, 0)}
                    </div>
                  </div>
                  <div className="h-64">
                    <canvas ref={statusChartRef}></canvas>
                  </div>
                  {analyticsData.complaintsByStatus.length === 0 && (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      Loading status data...
                    </div>
                  )}
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Performance Radar</h3>
                    <button
                      onClick={() => fetchAnalyticsData()}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="h-64">
                    <canvas ref={performanceChartRef}></canvas>
                  </div>
                  {!analyticsData.performanceMetrics && (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      Loading performance data...
                    </div>
                  )}
                </div>
              </div>

              {/* Department Performance with Recharts */}
              {analyticsData.complaintsByDepartment.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Department Performance Analysis</h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">Resolution Rate by Department</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.complaintsByDepartment.slice(0, 6)}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="resolutionRate"
                              label={({name, value}) => `${name}: ${value}%`}
                            >
                              {analyticsData.complaintsByDepartment.slice(0, 6).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={[
                                  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
                                ][index % 6]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">Department Efficiency</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart 
                            cx="50%" 
                            cy="50%" 
                            innerRadius="20%" 
                            outerRadius="90%" 
                            data={analyticsData.complaintsByDepartment.slice(0, 4).map((dept, index) => ({
                              ...dept,
                              fill: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index]
                            }))}
                          >
                            <RadialBar 
                              dataKey="efficiency" 
                              cornerRadius={10} 
                              fill="#8884d8" 
                            />
                            <Tooltip formatter={(value) => [`${value}%`, 'Efficiency']} />
                            <Legend />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  
                  {/* Department Table */}
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Complaints
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Resolution Rate
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Avg Resolution Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Efficiency Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {analyticsData.complaintsByDepartment.map((dept) => (
                          <tr key={dept.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {dept.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {dept.total}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                dept.resolutionRate >= 80 ? 'bg-green-100 text-green-800' :
                                dept.resolutionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {dept.resolutionRate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {dept.avgResolutionTime > 0 ? `${dept.avgResolutionTime.toFixed(1)}h` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      dept.efficiency >= 90 ? 'bg-green-500' :
                                      dept.efficiency >= 70 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(dept.efficiency, 100)}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium text-gray-900">
                                  {dept.efficiency}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Geographic Analytics */}
              {analyticsData.geospatialData.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Geographic Hotspots Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {analyticsData.geospatialData.length}
                      </p>
                      <p className="text-sm text-blue-600">Active Clusters</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">
                        {analyticsData.densityAnalysis?.filter(d => d.density === 'high').length || 0}
                      </p>
                      <p className="text-sm text-red-600">High Density Areas</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {analyticsData.heatmapData?.length || 0}
                      </p>
                      <p className="text-sm text-green-600">Geolocated Points</p>
                    </div>
                  </div>
                  
                  {/* Hotspot Table */}
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-2">Top Complaint Clusters</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Cluster
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Location
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Total
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Status Breakdown
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Top Category
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {analyticsData.geospatialData.slice(0, 5).map((cluster, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                #{index + 1}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {cluster.center.lat.toFixed(4)}, {cluster.center.lng.toFixed(4)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {cluster.totalComplaints}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex space-x-2">
                                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                    O: {cluster.statusBreakdown.open}
                                  </span>
                                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                    P: {cluster.statusBreakdown.in_progress}
                                  </span>
                                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                    R: {cluster.statusBreakdown.resolved}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {Object.entries(cluster.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Export Controls */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Export Analytics Data</h3>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => exportAnalyticsData('summary')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Export Summary Report
                  </button>
                  <button
                    onClick={() => exportAnalyticsData('detailed')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Export Detailed Analytics
                  </button>
                  <button
                    onClick={() => exportAnalyticsData('geospatial')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Export Geographic Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">System Settings</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Configure the application settings.
                </p>
              </div>
              {/* Settings content would go here */}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
