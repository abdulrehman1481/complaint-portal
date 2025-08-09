import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { supabase } from '../supabaseClient';
import { 
  Users, AlertTriangle, CheckCircle, Clock, LogOut, 
  Settings, Home, Map as MapIcon, BarChart2, Bell, ArrowLeft,
  Building, RefreshCw, X, Edit3, FileText, Download, Filter,
  Search, ChevronLeft, ChevronRight, Eye, MessageSquare, User
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  Area, AreaChart
} from 'recharts';
import '../styles/leaflet-admin.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const DepartmentAdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [stats, setStats] = useState({
    totalComplaints: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    avgResolutionTime: null,
    departmentUsers: 0
  });

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
  
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Field Agent Creation Modal State
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentFormData, setAgentFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  });
  
  const [analyticsData, setAnalyticsData] = useState({
    complaintsByCategory: [],
    complaintsByStatus: [],
    resolutionTime: null,
    avgResolutionTime: 0,
    trendData: [],
    performanceMetrics: {
      responseTime: 0,
      resolutionRate: 0,
      reopenRate: 0
    }
  });

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDepartmentData();
  }, []);

  const fetchDepartmentData = async () => {
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
          departments (id, name, contact_email)
        `)
        .eq('id', authUser.id)
        .single();
      
      if (userError) {
        console.error('User data fetch error:', userError);
        throw userError;
      }
      
      if (!userData) {
        console.error('No user data found');
        navigate('/');
        return;
      }
      
      if (userData.roles?.name !== 'Department Admin') {
        console.log('User is not a Department Admin, redirecting to dashboard');
        navigate('/dashboard');
        return;
      }
      
      setUser({ ...authUser, ...userData });
      
      // Fetch department-specific data
      await Promise.all([
        fetchDepartmentComplaints(userData.department_id),
        fetchDepartmentStats(userData.department_id),
        fetchDepartmentUsers(userData.department_id),
        fetchCategories(userData.department_id)
      ]);
      
    } catch (error) {
      console.error('Error fetching department data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentComplaints = async (departmentId, page = 1, filters = complaintFilters) => {
    try {
      console.log('Fetching complaints for department:', departmentId);
      
      // Start with a simple query first
      let query = supabase
        .from('complaints')
        .select('*', { count: 'exact' });

      // Apply basic filtering first
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Try department-based filtering
      const { data: departmentCategories } = await supabase
        .from('department_categories')
        .select('category_id')
        .eq('department_id', departmentId);
      
      const categoryIds = departmentCategories?.map(dc => dc.category_id) || [];
      
      if (categoryIds.length > 0) {
        query = query.or(`department_id.eq.${departmentId},category_id.in.(${categoryIds.join(',')})`);
      } else {
        query = query.eq('department_id', departmentId);
      }

      const pageSize = complaintsPagination.pageSize || 10;
      const { data: basicComplaints, error: basicError, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (basicError) {
        console.error('Basic query error:', basicError);
        throw basicError;
      }

      console.log('Basic complaints fetched:', basicComplaints);

      // Now fetch related data separately to avoid join issues
      const enrichedComplaints = await Promise.all(
        (basicComplaints || []).map(async (complaint) => {
          // Fetch category
          let category = null;
          if (complaint.category_id) {
            const { data: cat } = await supabase
              .from('categories')
              .select('id, name, icon, severity_level')
              .eq('id', complaint.category_id)
              .single();
            category = cat;
          }

          // Fetch reporter
          let reporter = null;
          if (complaint.reported_by && !complaint.anonymous) {
            const { data: rep } = await supabase
              .from('users')
              .select('first_name, last_name, email, phone_number')
              .eq('id', complaint.reported_by)
              .single();
            reporter = rep;
          }

          // Fetch assignee
          let assignee = null;
          if (complaint.assigned_to) {
            const { data: ass } = await supabase
              .from('users')
              .select('first_name, last_name, official_position, email')
              .eq('id', complaint.assigned_to)
              .single();
            assignee = ass;
          }

          // Fetch department
          let department = null;
          if (complaint.department_id) {
            const { data: dept } = await supabase
              .from('departments')
              .select('id, name')
              .eq('id', complaint.department_id)
              .single();
            department = dept;
          }

          return {
            ...complaint,
            categories: category,
            reporter: reporter,
            assignee: assignee,
            departments: department
          };
        })
      );

      console.log('Enriched complaints:', enrichedComplaints);
      
      setComplaints(enrichedComplaints || []);
      setComplaintsPagination(prev => ({
        ...prev,
        total: count || 0,
        currentPage: page
      }));
      setComplaintsPage(page);
      
      // Update analytics with category data
      updateCategoryAnalytics(enrichedComplaints || []);
      
    } catch (error) {
      console.error('Error fetching department complaints:', error);
      setComplaints([]);
      setComplaintsPagination(prev => ({
        ...prev,
        total: 0,
        currentPage: 1
      }));
    }
  };

  const updateCategoryAnalytics = (complaintsData) => {
    try {
      if (!complaintsData || complaintsData.length === 0) {
        setAnalyticsData(prev => ({
          ...prev,
          complaintsByCategory: [],
          complaintsByStatus: [],
          trendData: [],
          performanceMetrics: {
            responseTime: 0,
            resolutionRate: 0,
            reopenRate: 0
          }
        }));
        return;
      }

      // Group complaints by category
      const categoryGroups = complaintsData.reduce((acc, complaint) => {
        const categoryName = complaint.categories?.name || 'Uncategorized';
        if (!acc[categoryName]) {
          acc[categoryName] = 0;
        }
        acc[categoryName]++;
        return acc;
      }, {});

      const categoryData = Object.entries(categoryGroups).map(([name, value], index) => ({
        name,
        value,
        color: `hsl(${(index * 137.5) % 360}, 70%, 50%)`
      }));

      // Group complaints by status
      const statusGroups = complaintsData.reduce((acc, complaint) => {
        const status = complaint.status || 'unknown';
        if (!acc[status]) {
          acc[status] = 0;
        }
        acc[status]++;
        return acc;
      }, {});

      const statusColors = {
        'open': '#ef4444',
        'in_progress': '#f59e0b',
        'resolved': '#10b981',
        'unknown': '#6b7280'
      };

      const statusData = Object.entries(statusGroups).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value,
        color: statusColors[name] || statusColors.unknown
      }));

      // Calculate trend data (last 7 days)
      const now = new Date();
      const trendData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayComplaints = complaintsData.filter(complaint => {
          const complaintDate = new Date(complaint.created_at).toISOString().split('T')[0];
          return complaintDate === dateStr;
        });

        const dayResolved = complaintsData.filter(complaint => {
          if (!complaint.resolved_at) return false;
          const resolvedDate = new Date(complaint.resolved_at).toISOString().split('T')[0];
          return resolvedDate === dateStr;
        });

        trendData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          complaints: dayComplaints.length,
          resolved: dayResolved.length
        });
      }

      // Calculate performance metrics
      const totalComplaints = complaintsData.length;
      const resolvedComplaints = complaintsData.filter(c => c.status === 'resolved').length;
      const resolutionRate = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;

      // Calculate average response time (time from creation to first assignment)
      const assignedComplaints = complaintsData.filter(c => c.assigned_to && c.created_at);
      let avgResponseTime = 0;
      if (assignedComplaints.length > 0) {
        const totalResponseTime = assignedComplaints.reduce((acc, complaint) => {
          const created = new Date(complaint.created_at);
          const assigned = new Date(complaint.updated_at); // Approximation
          return acc + (assigned - created);
        }, 0);
        avgResponseTime = totalResponseTime / assignedComplaints.length / (1000 * 60 * 60); // Convert to hours
      }

      setAnalyticsData(prev => ({
        ...prev,
        complaintsByCategory: categoryData,
        complaintsByStatus: statusData,
        trendData,
        performanceMetrics: {
          responseTime: Math.round(avgResponseTime * 10) / 10, // Round to 1 decimal
          resolutionRate: Math.round(resolutionRate * 10) / 10,
          reopenRate: 0 // This would require tracking status changes
        }
      }));
    } catch (error) {
      console.error('Error updating category analytics:', error);
    }
  };

  const fetchDepartmentStats = async (departmentId) => {
    try {
      console.log('Fetching stats for department:', departmentId);
      
      const { data, error } = await supabase
        .from('complaints')
        .select('status, created_at, resolved_at')
        .eq('department_id', departmentId);

      if (error) {
        console.error('Stats query error:', error);
        throw error;
      }
      
      console.log('Stats data:', data);

      const totalComplaints = data?.length || 0;
      const openComplaints = data?.filter(c => c.status === 'open').length || 0;
      const inProgressComplaints = data?.filter(c => c.status === 'in_progress').length || 0;
      const resolvedComplaints = data?.filter(c => c.status === 'resolved').length || 0;

      // Calculate average resolution time safely
      const resolvedWithTime = data?.filter(c => c.status === 'resolved' && c.resolved_at) || [];
      const avgResolutionTime = resolvedWithTime.length > 0 
        ? resolvedWithTime.reduce((acc, complaint) => {
            const created = new Date(complaint.created_at);
            const resolved = new Date(complaint.resolved_at);
            return acc + (resolved - created);
          }, 0) / resolvedWithTime.length / (1000 * 60 * 60 * 24) // Convert to days
        : null;

      setStats({
        totalComplaints,
        openComplaints,
        inProgressComplaints,
        resolvedComplaints,
        avgResolutionTime: avgResolutionTime ? Math.round(avgResolutionTime * 10) / 10 : null,
        departmentUsers: 0 // Will be updated by fetchDepartmentUsers
      });

      // Analytics data
      const statusData = [
        { name: 'Open', value: openComplaints, color: '#ef4444' },
        { name: 'In Progress', value: inProgressComplaints, color: '#f59e0b' },
        { name: 'Resolved', value: resolvedComplaints, color: '#10b981' }
      ].filter(item => item.value > 0); // Only show non-zero values
      
      setAnalyticsData(prev => ({
        ...prev,
        complaintsByStatus: statusData,
        avgResolutionTime: avgResolutionTime || 0,
        performanceMetrics: {
          ...prev.performanceMetrics,
          resolutionRate: totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0
        }
      }));

      // Calculate trend data for the last 7 days
      calculateTrendData(data || []);

    } catch (error) {
      console.error('Error fetching department stats:', error);
      // Set default stats on error
      setStats({
        totalComplaints: 0,
        openComplaints: 0,
        inProgressComplaints: 0,
        resolvedComplaints: 0,
        avgResolutionTime: null,
        departmentUsers: 0
      });
    }
  };

  const calculateTrendData = (complaintsData) => {
    try {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const trendData = last7Days.map(date => {
        const dayComplaints = complaintsData.filter(complaint => 
          complaint.created_at.split('T')[0] === date
        );
        
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          complaints: dayComplaints.length,
          resolved: dayComplaints.filter(c => c.status === 'resolved').length
        };
      });

      setAnalyticsData(prev => ({
        ...prev,
        trendData
      }));
    } catch (error) {
      console.error('Error calculating trend data:', error);
    }
  };

  const fetchDepartmentUsers = async (departmentId) => {
    try {
      console.log('Fetching department users for department:', departmentId);
      
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name)
        `)
        .eq('department_id', departmentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching department users:', error);
        throw error;
      }
      
      console.log('Fetched department users:', data);
      setDepartmentUsers(data || []);
      setStats(prev => ({ ...prev, departmentUsers: data?.length || 0 }));
    } catch (error) {
      console.error('Error fetching department users:', error);
      setDepartmentUsers([]);
      setStats(prev => ({ ...prev, departmentUsers: 0 }));
    }
  };

  const fetchCategories = async (departmentId) => {
    try {
      // Fetch categories assigned to this department through department_categories junction table
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          department_categories!inner(department_id)
        `)
        .eq('department_categories.department_id', departmentId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
      
      // Update analytics data with category breakdown
      const categoryData = data?.map(category => ({
        name: category.name,
        value: 0, // Will be updated when complaints are fetched
        color: `hsl(${Math.random() * 360}, 70%, 50%)`
      })) || [];
      
      setAnalyticsData(prev => ({
        ...prev,
        complaintsByCategory: categoryData
      }));
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to default department method if junction table query fails
      try {
        const { data, error: fallbackError } = await supabase
          .from('categories')
          .select('*')
          .eq('default_department_id', departmentId)
          .eq('is_active', true)
          .order('name');
        
        if (!fallbackError) {
          setCategories(data || []);
        }
      } catch (fallbackErr) {
        console.error('Fallback category fetch also failed:', fallbackErr);
      }
    }
  };

  const handleComplaintStatusUpdate = async (complaintId, newStatus) => {
    try {
      console.log('Updating complaint status:', complaintId, 'to', newStatus);
      
      const updates = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaintId);

      if (error) {
        console.error('Status update error:', error);
        throw error;
      }
      
      // Add system comment about status change
      await supabase
        .from('complaint_comments')
        .insert({
          complaint_id: complaintId,
          user_id: user.id,
          content: `Status changed to ${newStatus.replace('_', ' ')}`,
          is_internal: true,
          is_system: true
        });
      
      // Refresh data
      await Promise.all([
        fetchDepartmentComplaints(user.department_id, complaintsPage, complaintFilters),
        fetchDepartmentStats(user.department_id)
      ]);
      
    } catch (error) {
      console.error('Error updating complaint status:', error);
      alert('Error updating status: ' + error.message);
    }
  };

  const handleAssignComplaint = async (complaintId, userId) => {
    try {
      console.log('Assigning complaint', complaintId, 'to user', userId);
      
      const updates = { 
        assigned_to: userId,
        updated_at: new Date().toISOString()
      };
      
      // If assigning to someone, update status to in_progress if it's still open
      if (userId) {
        const complaint = complaints.find(c => c.id === complaintId);
        if (complaint?.status === 'open') {
          updates.status = 'in_progress';
        }
      }

      const { error } = await supabase
        .from('complaints')
        .update(updates)
        .eq('id', complaintId);

      if (error) {
        console.error('Assignment error:', error);
        throw error;
      }
      
      // Add system comment about assignment
      if (userId) {
        const assignedUser = departmentUsers.find(u => u.id === userId);
        if (assignedUser) {
          await supabase
            .from('complaint_comments')
            .insert({
              complaint_id: complaintId,
              user_id: user.id,
              content: `Complaint assigned to ${assignedUser.first_name} ${assignedUser.last_name}`,
              is_internal: true,
              is_system: true
            });
        }
      } else {
        await supabase
          .from('complaint_comments')
          .insert({
            complaint_id: complaintId,
            user_id: user.id,
            content: 'Complaint unassigned',
            is_internal: true,
            is_system: true
          });
      }
      
      // Refresh complaints and stats
      await Promise.all([
        fetchDepartmentComplaints(user.department_id, complaintsPage, complaintFilters),
        fetchDepartmentStats(user.department_id)
      ]);
      
    } catch (error) {
      console.error('Error assigning complaint:', error);
      alert('Error assigning complaint: ' + error.message);
    }
  };

  const handleCreateFieldAgent = async (e) => {
    e.preventDefault();
    setCreatingAgent(true);
    
    try {
      // Validate form data
      if (!agentFormData.firstName || !agentFormData.lastName || !agentFormData.email || !agentFormData.password) {
        throw new Error('All fields are required');
      }

      if (agentFormData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Get the Field Agent role ID
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'Field Agent')
        .single();

      if (roleError) {
        console.error('Role fetch error:', roleError);
        throw new Error('Field Agent role not found. Please contact system administrator.');
      }

      // Create field agent using regular signup but ensure current user session is preserved
      // Store current session info before creating new user
      const { data: currentSession } = await supabase.auth.getSession();
      
      try {
        // Try admin API first (requires service role key)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: agentFormData.email,
          password: agentFormData.password,
          user_metadata: {
            first_name: agentFormData.firstName,
            last_name: agentFormData.lastName,
            phone_number: agentFormData.phone,
            role: 'Field Agent',
            department_id: user.department_id
          },
          email_confirm: true
        });

        if (authError) throw authError;
        
        if (!authData.user) {
          throw new Error('User creation failed - no user data returned');
        }

        var createdUserId = authData.user.id;
        
      } catch (adminError) {
        console.warn('Admin API not available, using regular signup:', adminError);
        
        // Fallback to regular signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: agentFormData.email,
          password: agentFormData.password,
          options: {
            data: {
              first_name: agentFormData.firstName,
              last_name: agentFormData.lastName,
              phone_number: agentFormData.phone,
              role: 'Field Agent',
              department_id: user.department_id
            }
          }
        });

        if (authError) {
          console.error('Regular signup error:', authError);
          throw new Error(authError.message || 'Failed to create user account');
        }

        if (!authData.user) {
          throw new Error('User creation failed - no user data returned');
        }

        var createdUserId = authData.user.id;
        
        // Restore current user session immediately after signup
        if (currentSession?.session) {
          await supabase.auth.setSession(currentSession.session);
        }
      }

      // Create the user record in our users table
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: createdUserId,
          email: agentFormData.email,
          first_name: agentFormData.firstName,
          last_name: agentFormData.lastName,
          phone_number: agentFormData.phone,
          role_id: roleData.id,
          department_id: user.department_id,
          official_position: 'Field Agent',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (userError) {
        console.error('User record creation error:', userError);
        // Try to clean up the auth user if our database insert failed
        try {
          await supabase.auth.admin.deleteUser(createdUserId);
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
        throw new Error('Failed to create user record: ' + userError.message);
      }

      // Reset form and close modal
      setAgentFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: ''
      });
      setShowCreateAgentModal(false);
      
      // Refresh department users
      await fetchDepartmentUsers(user.department_id);
      
      // Ensure current session is maintained
      const { data: postCreationSession } = await supabase.auth.getSession();
      if (!postCreationSession?.session) {
        // Re-authenticate current user if session was lost
        window.location.reload();
        return;
      }
      
      alert('Field Agent created successfully! They will receive a confirmation email.');
      
    } catch (error) {
      console.error('Error creating field agent:', error);
      alert('Error creating field agent: ' + error.message);
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Building className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Department Dashboard</h1>
                <p className="text-sm text-gray-600">
                  Welcome back, {user?.first_name} {user?.last_name} | {user?.departments?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>User View</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart2 },
              { id: 'complaints', label: 'Complaints', icon: AlertTriangle },
              { id: 'team', label: 'Team', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Complaints</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalComplaints}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Clock className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Open</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.openComplaints}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <RefreshCw className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.inProgressComplaints}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Resolved</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.resolvedComplaints}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
                <div className="h-64">
                  {analyticsData.complaintsByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData.complaintsByStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {analyticsData.complaintsByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                <div className="h-64">
                  {analyticsData.complaintsByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.complaintsByCategory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No category data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trend Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Trend</h3>
                <div className="h-64">
                  {analyticsData.trendData && analyticsData.trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="complaints" stroke="#3B82F6" name="New Complaints" />
                        <Line type="monotone" dataKey="resolved" stroke="#10B981" name="Resolved" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No trend data available
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Resolution Rate</span>
                    <span className="font-semibold text-green-600">
                      {analyticsData.performanceMetrics.resolutionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg. Response Time</span>
                    <span className="font-semibold">
                      {analyticsData.performanceMetrics.responseTime > 0 
                        ? `${analyticsData.performanceMetrics.responseTime}h` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Complaints</span>
                    <span className="font-semibold">{stats.totalComplaints}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Open Complaints</span>
                    <span className="font-semibold text-red-600">{stats.openComplaints}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">In Progress</span>
                    <span className="font-semibold text-yellow-600">{stats.inProgressComplaints}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Team Members</span>
                    <span className="font-semibold">{stats.departmentUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Field Agents</span>
                    <span className="font-semibold">
                      {departmentUsers.filter(u => u.roles?.name === 'Field Agent').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'complaints' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Department Complaints</h3>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                  <select
                    value={complaintFilters.status}
                    onChange={(e) => setComplaintFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>

                  <select
                    value={complaintFilters.category}
                    onChange={(e) => setComplaintFilters(prev => ({ ...prev, category: e.target.value }))}
                    className="rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={complaintFilters.startDate}
                    onChange={(e) => setComplaintFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  />

                  <input
                    type="date"
                    value={complaintFilters.endDate}
                    onChange={(e) => setComplaintFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  />

                  <button
                    onClick={() => fetchDepartmentComplaints(user.department_id, 1, complaintFilters)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              )}

              {/* Complaints Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Complaint
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reporter
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {complaints.map((complaint) => (
                      <tr key={complaint.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{complaint.title}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{complaint.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={complaint.status}
                            onChange={(e) => handleComplaintStatusUpdate(complaint.id, e.target.value)}
                            className={`text-sm rounded-full px-3 py-1 font-medium ${
                              complaint.status === 'open' ? 'bg-red-100 text-red-800' :
                              complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{complaint.categories?.icon}</span>
                            <span className="text-sm text-gray-900">{complaint.categories?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {complaint.reporter?.first_name} {complaint.reporter?.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="min-w-0">
                            {complaint.assigned_to ? (
                              <div className="flex items-center space-x-2">
                                <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
                                  {(complaint.assignee && complaint.assignee.first_name) ? 
                                    complaint.assignee.first_name.charAt(0) : 'A'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {complaint.assignee ? 
                                      `${complaint.assignee.first_name || ''} ${complaint.assignee.last_name || ''}`.trim() : 
                                      'Assigned User'}
                                  </p>
                                  <select
                                    value={complaint.assigned_to}
                                    onChange={(e) => handleAssignComplaint(complaint.id, e.target.value || null)}
                                    className="text-xs rounded border-gray-300 focus:ring-blue-500 focus:border-blue-500 mt-1"
                                  >
                                    <option value="">Unassign</option>
                                    {departmentUsers.filter(u => u.roles?.name === 'Field Agent').map(agent => (
                                      <option key={agent.id} value={agent.id}>
                                        {agent.first_name} {agent.last_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => handleAssignComplaint(complaint.id, e.target.value)}
                                className="text-sm rounded border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-full"
                              >
                                <option value="">Assign to Agent</option>
                                {departmentUsers.filter(u => u.roles?.name === 'Field Agent').map(agent => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.first_name} {agent.last_name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(complaint.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => navigate(`/complaint/${complaint.id}`)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">
                  Showing {(complaintsPagination.currentPage - 1) * complaintsPagination.pageSize + 1} to{' '}
                  {Math.min(complaintsPagination.currentPage * complaintsPagination.pageSize, complaintsPagination.total)} of{' '}
                  {complaintsPagination.total} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchDepartmentComplaints(user.department_id, complaintsPage - 1, complaintFilters)}
                    disabled={complaintsPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fetchDepartmentComplaints(user.department_id, complaintsPage + 1, complaintFilters)}
                    disabled={complaintsPage * complaintsPagination.pageSize >= complaintsPagination.total}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Department Team</h3>
              <button
                onClick={() => setShowCreateAgentModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Users className="h-4 w-4 mr-2" />
                Create Field Agent
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departmentUsers.map((teamMember) => (
                <div key={teamMember.id} className="border rounded-lg p-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {teamMember.first_name} {teamMember.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{teamMember.roles?.name}</p>
                      <p className="text-sm text-gray-500">{teamMember.email}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      Position: {teamMember.official_position || 'Not specified'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Joined: {formatDate(teamMember.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Analytics</h3>
              <p className="text-gray-600">Advanced analytics and reporting features coming soon...</p>
            </div>
          </div>
        )}
      </main>

      {/* Create Field Agent Modal */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create Field Agent</h3>
                <button
                  onClick={() => setShowCreateAgentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateFieldAgent} className="space-y-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    required
                    value={agentFormData.firstName}
                    onChange={(e) => setAgentFormData({...agentFormData, firstName: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    required
                    value={agentFormData.lastName}
                    onChange={(e) => setAgentFormData({...agentFormData, lastName: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={agentFormData.email}
                    onChange={(e) => setAgentFormData({...agentFormData, email: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={agentFormData.phone}
                    onChange={(e) => setAgentFormData({...agentFormData, phone: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    required
                    value={agentFormData.password}
                    onChange={(e) => setAgentFormData({...agentFormData, password: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                </div>
                
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateAgentModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAgent}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {creatingAgent ? 'Creating...' : 'Create Agent'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentAdminDashboard;
