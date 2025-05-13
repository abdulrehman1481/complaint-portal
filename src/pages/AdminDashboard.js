import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  Users, AlertTriangle, CheckCircle, Clock, LogOut, 
  Settings, Home, Map as MapIcon, BarChart2, Bell, ArrowLeft,
  Building, RefreshCw, X 
} from 'lucide-react';

// Import our components
import DashboardStats from '../components/admin/DashboardStats';
import ComplaintsTable from '../components/admin/ComplaintsTable';
import UserManagement from '../components/admin/UserManagement';
import DepartmentManagement from '../components/admin/DepartmentManagement';

// Import the fixed location parser
import { parseLocation, formatLocationForDisplay } from '../utils/locationFormatter';

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
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState({
    complaintsByCategory: [],
    complaintsByStatus: [],
    resolutionTime: null,
    trendData: []
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
          assigned_to_user:assigned_to (first_name, last_name)
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
    if (selectedComplaints.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ 
          status: newStatus,
          ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {})
        })
        .in('id', selectedComplaints);
        
      if (error) throw error;
      
      fetchComplaints(complaintsPage, complaintFilters, complaintsSorting);
      setSelectedComplaints([]);
      
      alert(`Successfully updated ${selectedComplaints.length} complaints to ${newStatus}`);
      
    } catch (error) {
      console.error('Error updating complaints:', error);
      alert('Failed to update complaints. Please try again.');
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
  
  const fetchAnalyticsData = async () => {
    // Implement analytics data fetching
    console.log("Analytics data would be fetched here");
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
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
  
  // Function to load map component in admin dashboard
  const loadMapComponent = () => {
    if (!window.adminMapInstance) {
      setTimeout(() => {
        const adminMapContainer = document.getElementById('admin-map-container');
        if (!adminMapContainer) return;
        
        console.log('Initializing admin map');
        
        // Use same mapbox token
        const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJyZWhtYW4xMTIyIiwiYSI6ImNtNHlrY3Q2cTBuYmsyaXIweDZrZG9yZnoifQ.FkDynV0HksdN7ICBxt2uPg';
        
        try {
          // Create a map instance for admin
          const map = new mapboxgl.Map({
            container: 'admin-map-container',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [-74.0060, 40.7128], // Default center - NYC
            zoom: 10,
            accessToken: MAPBOX_TOKEN
          });
          
          // Add navigation and other controls
          map.addControl(new mapboxgl.NavigationControl(), 'top-right');
          map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
          }), 'top-right');
          
          // Add scale control for better spatial context
          map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
          
          // Store reference
          window.adminMapInstance = map;
          
          // Add complaint markers once map is loaded
          map.on('load', () => {
            console.log('Admin map loaded, adding complaints');
            // Add complaint source and layers for admin view
            if (complaints.length > 0) {
              addComplaintsToAdminMap(map, complaints);
            } else {
              fetchMapComplaints(complaintFilters);
            }
          });
        } catch (error) {
          console.error('Error initializing admin map:', error);
        }
      }, 100);
    } else {
      console.log('Map already initialized, updating data');
      // If map exists, just update the data
      if (complaints.length > 0) {
        addComplaintsToAdminMap(window.adminMapInstance, complaints);
      } else {
        fetchMapComplaints(complaintFilters);
      }
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
    
    // Check if the map is fully loaded
    if (!map.loaded()) {
      console.log('Map not fully loaded, waiting for load event');
      map.once('load', () => {
        addComplaintDataToMap(map, geojson);
      });
    } else {
      addComplaintDataToMap(map, geojson);
    }
  };
  
  // Helper function to add complaint data to map
  const addComplaintDataToMap = (map, geojson) => {
    try {
      console.log('Adding complaint data to map');
      
      // Add source and layers if they don't exist or update them if they do
      if (!map.getSource('admin-complaints')) {
        console.log('Creating new source and layers');
        map.addSource('admin-complaints', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        });
        
        // Add cluster layer
        map.addLayer({
          id: 'admin-clusters',
          type: 'circle',
          source: 'admin-complaints',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#51bbd6',  // Small clusters
              10, '#f1f075',  // Medium clusters
              30, '#f28cb1'   // Large clusters
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20,  // Default radius
              10, 30,  // Medium clusters
              30, 40   // Large clusters
            ]
          }
        });
      
        // Add cluster count layer
        map.addLayer({
          id: 'admin-cluster-count',
          type: 'symbol',
          source: 'admin-complaints',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          }
        });
        
        // Add unclustered point layer with color based on status
        map.addLayer({
          id: 'admin-unclustered-point',
          type: 'circle',
          source: 'admin-complaints',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'status'],
              'open', '#e74c3c',       // Red for open
              'in_progress', '#f39c12', // Yellow for in progress
              'resolved', '#2ecc71',   // Green for resolved
              '#3498db'                // Blue default
            ],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
        
        // Add a popup on hover
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false
        });
        
        // Show popup on mouseenter
        map.on('mouseenter', 'admin-unclustered-point', (e) => {
          map.getCanvas().style.cursor = 'pointer';
          
          if (e.features.length === 0) return;
          
          const coordinates = e.features[0].geometry.coordinates.slice();
          const { id, title, status, category_name, category_icon, created_at } = e.features[0].properties;
          
          // Format status for display
          const displayStatus = status === 'in_progress' ? 'In Progress' : 
                                status.charAt(0).toUpperCase() + status.slice(1);
                                
          // Format date
          const date = created_at ? new Date(created_at).toLocaleDateString() : 'Unknown date';
          
          // Create popup content with more details
          const popupContent = `
            <div class="font-sans p-2">
              <h3 class="font-bold text-sm">${title}</h3>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs">${category_icon || '📍'} ${category_name}</span>
                <span class="px-1.5 py-0.5 text-xs rounded-full 
                  ${status === 'open' ? 'bg-red-100 text-red-800' :
                    status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'}">
                  ${displayStatus}
                </span>
              </div>
              <p class="text-xs mt-1">ID: ${id} • Reported: ${date}</p>
              <p class="text-xs mt-1 text-blue-600">Click for details</p>
            </div>
          `;
          
          // Set popup position and content
          popup.setLngLat(coordinates)
               .setHTML(popupContent)
               .addTo(map);
        });
        
        // Hide popup on mouseleave
        map.on('mouseleave', 'admin-unclustered-point', () => {
          map.getCanvas().style.cursor = '';
          popup.remove();
        });
        
        // Add click event for the points
        map.on('click', 'admin-unclustered-point', (e) => {
          if (e.features && e.features.length > 0) {
            const complaintId = e.features[0].properties.id;
            navigate(`/complaint/${complaintId}`);
          }
        });
        
        // Add click event for clusters to zoom in
        map.on('click', 'admin-clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ['admin-clusters']
          });
          
          if (features.length > 0 && features[0].properties.cluster_id) {
            const clusterId = features[0].properties.cluster_id;
            map.getSource('admin-complaints').getClusterExpansionZoom(
              clusterId,
              (err, zoom) => {
                if (err) return;
                
                map.easeTo({
                  center: features[0].geometry.coordinates,
                  zoom: zoom
                });
              }
            );
          }
        });
        
        // Change cursor on hover over clusters
        map.on('mouseenter', 'admin-clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'admin-clusters', () => {
          map.getCanvas().style.cursor = '';
        });
        
      } else {
        // Update the data if source already exists
        console.log('Updating existing source data');
        map.getSource('admin-complaints').setData(geojson);
      }
      
      console.log('Successfully updated map with complaint data');
    } catch (error) {
      console.error('Error adding complaint data to map:', error);
    }
  };
  
  // Enhance the map tab initialization to properly handle filters
  const handleMapTabClick = () => {
    setActiveTab('map');
    
    // Initialize or refresh the map
    setTimeout(() => {
      loadMapComponent();
      // Apply any existing filters to the map
      if (isFilterApplied) {
        fetchMapComplaints(complaintFilters);
      }
    }, 100);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-indigo-800 text-white">
        <div className="h-16 flex items-center justify-center">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
        <nav className="mt-6">
          <div>
            <button
              onClick={() => handleTabChange('overview')}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'overview' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <Home className="h-5 w-5 mr-3" />
              Overview
            </button>
            <button
              onClick={() => handleTabChange('users')}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'users' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <Users className="h-5 w-5 mr-3" />
              User Management
            </button>
            <button
              onClick={() => handleTabChange('departments')}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'departments' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <Building className="h-5 w-5 mr-3" />
              Departments
            </button>
            <button
              onClick={() => handleTabChange('complaints')}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'complaints' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <AlertTriangle className="h-5 w-5 mr-3" />
              Complaints
            </button>
            <button
              onClick={() => handleMapTabClick()}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'map' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <MapIcon className="h-5 w-5 mr-3" />
              Map View
            </button>
            <button
              onClick={() => handleTabChange('analytics')}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'analytics' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <BarChart2 className="h-5 w-5 mr-3" />
              Analytics
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`w-full flex items-center px-6 py-2.5 text-sm ${
                activeTab === 'settings' ? 'bg-indigo-900 font-medium' : 'hover:bg-indigo-700'
              }`}
            >
              <Settings className="h-5 w-5 mr-3" />
              Settings
            </button>
          </div>
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-indigo-700">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center px-4 py-2 text-indigo-200 hover:text-white mb-3"
          >
            <ArrowLeft className="h-5 w-5 mr-3" />
            Back to User Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-indigo-200 hover:text-white"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'departments' && 'Department Management'}
              {activeTab === 'complaints' && 'Complaints Management'}
              {activeTab === 'map' && 'Map View'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'settings' && 'System Settings'}
            </h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-1 rounded-full text-gray-500 hover:text-gray-600 focus:outline-none">
                  <Bell className="h-6 w-6" />
                  <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
                </button>
              </div>
              <span className="text-sm text-gray-600">
                Welcome, {user?.first_name} {user?.last_name}
              </span>
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                {user?.first_name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              categories={categories}
              handleExportComplaints={handleExportComplaints}
              isExporting={isExporting}
              formatDate={formatDate}
            />
          )}

          {/* Map View */}
          {activeTab === 'map' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Complaints Map</h3>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  {/* Status filter dropdown */}
                  <select
                    className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    onChange={(e) => {
                      setComplaintFilters(prev => ({...prev, status: e.target.value}));
                      fetchMapComplaints({...complaintFilters, status: e.target.value});
                    }}
                    value={complaintFilters.status}
                  >
                    <option value="">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  
                  {/* Category filter dropdown */}
                  <select
                    className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
                  
                  <button
                    onClick={() => navigate('/map')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Open Full Map
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
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
              
              {/* Map container */}
              <div id="admin-map-container" className="bg-gray-100 h-[600px] rounded-lg"></div>
              
              {/* Map legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded-full bg-red-500 inline-block mr-2"></span>
                  <span>Open</span>
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded-full bg-yellow-500 inline-block mr-2"></span>
                  <span>In Progress</span>
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded-full bg-green-500 inline-block mr-2"></span>
                  <span>Resolved</span>
                </div>
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded-full inline-block mr-2 border-2 border-gray-500"></span>
                  <span>Click clusters to zoom in</span>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="text-center py-8">
              <BarChart2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
              <p className="text-gray-500">Analytics components would be displayed here</p>
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
