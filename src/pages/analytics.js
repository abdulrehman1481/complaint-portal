import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// Update Chart.js import to be more specific
import Chart from 'chart.js/auto';
import { 
  BarChart2, 
  PieChart, 
  TrendingUp, 
  Calendar, 
  Filter, 
  Download, 
  RefreshCw,
  MapPin,
  Clock,
  AlertTriangle
} from 'lucide-react';
// Ensure date-fns adapter is properly imported
import 'chartjs-adapter-date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Update refs initialization
const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month'); // week, month, year, all
  const [filterDepartment, setFilterDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState({
    totalComplaints: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    avgResolutionTime: 0,
    complaintsByCategory: [],
    complaintsByStatus: [],
    complaintsByDepartment: [],
    complaintsTrend: [],
    resolutionTimeByDepartment: [],
    locationHeatmapData: []
  });
  
  // Chart references
  const statusChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const deptPerformanceChartRef = useRef(null);
  const resolutionTimeChartRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const heatmapLayer = useRef(null);
  
  // Canvas element references
  const statusCanvasRef = useRef(null);
  const categoryCanvasRef = useRef(null);
  const trendCanvasRef = useRef(null);
  const departmentCanvasRef = useRef(null);
  const resolutionTimeCanvasRef = useRef(null);
  
  const navigate = useNavigate();
  
  // Chart initialization functions
  const initializeCategoryChart = (data) => {
    if (!categoryCanvasRef.current) {
      console.error('Category chart canvas element not found');
      return;
    }
    
    if (categoryChartRef.current) {
      categoryChartRef.current.destroy();
    }
    
    try {
      const ctx = categoryCanvasRef.current.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get category chart context');
        return;
      }
      
      // Sort data by count for better visualization
      const sortedData = [...data].sort((a, b) => b.count - a.count);
      
      // Only show top 5 categories for clarity
      const topCategories = sortedData.slice(0, 5);
      
      categoryChartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topCategories.map(cat => cat.name),
          datasets: [{
            label: 'Number of Complaints',
            data: topCategories.map(cat => cat.count),
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
            ],
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    } catch (err) {
      console.error('Error initializing category chart:', err);
    }
  };
  
  const initializeStatusChart = (data) => {
    if (!statusCanvasRef.current) {
      console.error('Status chart canvas element not found');
      return;
    }
    
    if (statusChartRef.current) {
      statusChartRef.current.destroy();
    }
    
    try {
      const ctx = statusCanvasRef.current.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get status chart context');
        return;
      }
      
      statusChartRef.current = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: data.map(item => item.status),
          datasets: [{
            data: data.map(item => item.count),
            backgroundColor: [
              'rgba(239, 68, 68, 0.7)',  // Red for Open
              'rgba(245, 158, 11, 0.7)', // Orange for In Progress
              'rgba(34, 197, 94, 0.7)'   // Green for Resolved
            ],
            borderColor: [
              'rgba(239, 68, 68, 1)',
              'rgba(245, 158, 11, 1)',
              'rgba(34, 197, 94, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    } catch (err) {
      console.error('Error initializing status chart:', err);
    }
  };
  
  const initializeDepartmentChart = (data) => {
    if (!departmentCanvasRef.current) {
      console.error('Department chart canvas element not found');
      return;
    }
    
    if (deptPerformanceChartRef.current) {
      deptPerformanceChartRef.current.destroy();
    }
    
    try {
      const ctx = departmentCanvasRef.current.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get department chart context');
        return;
      }
      
      // Sort data by total count for better visualization
      const sortedData = [...data].sort((a, b) => b.totalCount - a.totalCount);
      
      // Only show top departments for clarity
      const topDepartments = sortedData.slice(0, 8);
      
      deptPerformanceChartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topDepartments.map(dept => dept.name),
          datasets: [
            {
              label: 'Open',
              data: topDepartments.map(dept => dept.openCount),
              backgroundColor: 'rgba(239, 68, 68, 0.7)', // Red
              borderColor: 'rgba(239, 68, 68, 1)',
              borderWidth: 1
            },
            {
              label: 'In Progress',
              data: topDepartments.map(dept => dept.inProgressCount),
              backgroundColor: 'rgba(245, 158, 11, 0.7)', // Orange
              borderColor: 'rgba(245, 158, 11, 1)',
              borderWidth: 1
            },
            {
              label: 'Resolved',
              data: topDepartments.map(dept => dept.resolvedCount),
              backgroundColor: 'rgba(34, 197, 94, 0.7)', // Green
              borderColor: 'rgba(34, 197, 94, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Complaints by Department and Status'
            }
          },
          scales: {
            x: {
              stacked: false,
            },
            y: {
              stacked: false,
              beginAtZero: true
            }
          }
        }
      });
    } catch (err) {
      console.error('Error initializing department chart:', err);
    }
  };
  
  const initializeResolutionTimeChart = (data) => {
    if (!resolutionTimeCanvasRef.current) {
      console.error('Resolution time chart canvas element not found');
      return;
    }
    
    if (resolutionTimeChartRef.current) {
      resolutionTimeChartRef.current.destroy();
    }
    
    try {
      const ctx = resolutionTimeCanvasRef.current.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get resolution time chart context');
        return;
      }
      
      // Sort and filter data
      const validData = data.filter(dept => dept.avgResolutionHours > 0);
      const sortedData = [...validData].sort((a, b) => a.avgResolutionHours - b.avgResolutionHours);
      
      resolutionTimeChartRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sortedData.map(dept => dept.name),
          datasets: [{
            label: 'Average Resolution Time (hours)',
            data: sortedData.map(dept => dept.avgResolutionHours),
            backgroundColor: 'rgba(79, 70, 229, 0.7)',
            borderColor: 'rgba(79, 70, 229, 1)',
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    } catch (err) {
      console.error('Error initializing resolution time chart:', err);
    }
  };
  
  const initializeTrendChart = (data) => {
    if (!trendCanvasRef.current) {
      console.error('Trend chart canvas element not found');
      return;
    }
    
    if (trendChartRef.current) {
      trendChartRef.current.destroy();
    }
    
    try {
      const ctx = trendCanvasRef.current.getContext('2d');
      
      if (!ctx) {
        console.error('Could not get trend chart context');
        return;
      }
      
      // Group data by day
      const groupedByDay = {};
      data.forEach(complaint => {
        const date = new Date(complaint.created_at).toISOString().split('T')[0];
        if (!groupedByDay[date]) {
          groupedByDay[date] = { date, total: 0, open: 0, in_progress: 0, resolved: 0 };
        }
        groupedByDay[date].total++;
        
        switch (complaint.status) {
          case 'open':
            groupedByDay[date].open++;
            break;
          case 'in_progress':
            groupedByDay[date].in_progress++;
            break;
          case 'resolved':
            groupedByDay[date].resolved++;
            break;
        }
      });
      
      // Convert to array and sort by date
      const trendData = Object.values(groupedByDay).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      trendChartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Total Complaints',
              data: trendData.map(day => ({ x: day.date, y: day.total })),
              borderColor: 'rgba(79, 70, 229, 1)',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'Open',
              data: trendData.map(day => ({ x: day.date, y: day.open })),
              borderColor: 'rgba(239, 68, 68, 1)',
              backgroundColor: 'transparent',
              tension: 0.3
            },
            {
              label: 'In Progress',
              data: trendData.map(day => ({ x: day.date, y: day.in_progress })),
              borderColor: 'rgba(245, 158, 11, 1)',
              backgroundColor: 'transparent',
              tension: 0.3
            },
            {
              label: 'Resolved',
              data: trendData.map(day => ({ x: day.date, y: day.resolved })),
              borderColor: 'rgba(34, 197, 94, 1)',
              backgroundColor: 'transparent',
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'day',
                tooltipFormat: 'MMM d, yyyy'
              },
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Complaints'
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Error initializing trend chart:', err);
    }
  };
  
  const initializeMap = (locations) => {
    if (mapInstance.current) {
      mapInstance.current.remove();
    }
    
    // Find center point based on all locations
    const center = locations.reduce(
      (acc, loc) => {
        return {
          lat: acc.lat + loc.latitude / locations.length,
          lng: acc.lng + loc.longitude / locations.length
        };
      },
      { lat: 0, lng: 0 }
    );
    
    // Create Leaflet map
    const map = L.map(mapContainerRef.current).setView([center.lat, center.lng], 10);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Create heatmap data
    const heatmapData = locations.map(loc => [loc.latitude, loc.longitude, 1]);
    
    // Add heatmap layer
    const heatLayer = L.heatLayer(heatmapData, {
      radius: 20,
      blur: 15,
      maxZoom: 15,
      gradient: {
        0.0: 'rgba(33,102,172,0)',
        0.2: 'rgb(103,169,207)',
        0.4: 'rgb(209,229,240)', 
        0.6: 'rgb(253,219,199)',
        0.8: 'rgb(239,138,98)',
        1.0: 'rgb(178,24,43)'
      }
    }).addTo(map);
    
    mapInstance.current = map;
  };
  
  // Data fetching functions
  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
        
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError(`Failed to load departments: ${error.message || 'Unknown error'}`);
    }
  };
  
const fetchLocationData = async (dateFilter) => {
  try {
    let query = supabase.from('complaints')
      .select('location')
      .not('location', 'is', null);
    
    // Apply time filter if any
    if (dateFilter.created_at) {
      query = query.gte('created_at', dateFilter.created_at);
    }
    
    
    // Apply department filter if selected
    if (filterDepartment) {
      // Get categories for this department
      const { data: deptCategories } = await supabase
        .from('department_categories')
        .select('category_id')
        .eq('department_id', filterDepartment);
        
      if (deptCategories?.length > 0) {
        const categoryIds = deptCategories.map(dc => dc.category_id);
        query = query.in('category_id', categoryIds);
      }
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Process location data properly
    const locationData = data
      .filter(c => c.location && typeof c.location === 'object')
      .map(c => {
        // Check if location is stored as {latitude, longitude} or {lat, lng}
        if (c.location.latitude !== undefined && c.location.longitude !== undefined) {
          return {
            latitude: c.location.latitude,
            longitude: c.location.longitude
          };
        } else if (c.location.lat !== undefined && c.location.lng !== undefined) {
          return {
            latitude: c.location.lat,
            longitude: c.location.lng
          };
        }
        return null;
      })
      .filter(loc => loc !== null);
    
    setAnalyticsData(prev => ({
      ...prev,
      locationHeatmapData: locationData
    }));
    
    // Initialize the map after getting the location data
    if (mapContainerRef.current && locationData.length > 0) {
      setTimeout(() => {
        initializeMap(locationData);
      }, 100);
    }
  } catch (error) {
    console.error('Error fetching location data:', error);
    setAnalyticsData(prev => ({
      ...prev,
      locationHeatmapData: []
    }));
  }
};
  
  const fetchComplaintCounts = async (dateFilter) => {
    try {
      // Base query
      let query = supabase.from('complaints').select('*', { count: 'exact' });
      
      // Apply time filter if any
      if (dateFilter.created_at) {
        query = query.filter('created_at', dateFilter.created_at);
      }
      
      // Apply department filter if selected
      if (filterDepartment) {
        // First get categories for this department
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', filterDepartment);
          
        if (deptCategories?.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }
      
      // Total complaints
      const { count: totalCount, error: totalError } = await query;
      
      if (totalError) throw totalError;
      
      // Open complaints
      query = query.eq('status', 'open');
      const { count: openCount, error: openError } = await query;
      
      if (openError) throw openError;
      
      // In-progress complaints
      query = supabase.from('complaints')
        .select('*', { count: 'exact' })
        .eq('status', 'in_progress');
        
      // Apply same filters
      if (dateFilter.created_at) {
        query = query.filter('created_at', dateFilter.created_at);
      }
      
      if (filterDepartment) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', filterDepartment);
          
        if (deptCategories?.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }
      
      const { count: inProgressCount, error: inProgressError } = await query;
      
      if (inProgressError) throw inProgressError;
      
      // Resolved complaints
      query = supabase.from('complaints')
        .select('*', { count: 'exact' })
        .eq('status', 'resolved');
        
      // Apply same filters
      if (dateFilter.created_at) {
        query = query.filter('created_at', dateFilter.created_at);
      }
      
      if (filterDepartment) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', filterDepartment);
          
        if (deptCategories?.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }
      
      const { count: resolvedCount, error: resolvedError } = await query;
      
      if (resolvedError) throw resolvedError;
      
      // Calculate average resolution time
      query = supabase.from('complaints')
        .select('created_at, resolved_at')
        .eq('status', 'resolved')
        .not('resolved_at', 'is', null);
        
      // Apply same filters
      if (dateFilter.created_at) {
        query = query.filter('created_at', dateFilter.created_at);
      }
      
      if (filterDepartment) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', filterDepartment);
          
        if (deptCategories?.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }
      
      const { data: resolvedComplaints, error: avgTimeError } = await query;
      
      if (avgTimeError) throw avgTimeError;
      
      let avgResolutionTime = 0;
      if (resolvedComplaints && resolvedComplaints.length > 0) {
        const totalHours = resolvedComplaints.reduce((acc, complaint) => {
          const created = new Date(complaint.created_at);
          const resolved = new Date(complaint.resolved_at);
          return acc + (resolved - created) / (1000 * 60 * 60); // Convert to hours
        }, 0);
        
        avgResolutionTime = (totalHours / resolvedComplaints.length).toFixed(1);
      }
      
      // Update state with counts
      setAnalyticsData(prev => ({
        ...prev,
        totalComplaints: totalCount || 0,
        openComplaints: openCount || 0,
        inProgressComplaints: inProgressCount || 0,
        resolvedComplaints: resolvedCount || 0,
        avgResolutionTime
      }));
      
    } catch (error) {
      console.error('Error fetching complaint counts:', error);
      setAnalyticsData(prev => ({
        ...prev,
        totalComplaints: 0,
        openComplaints: 0,
        inProgressComplaints: 0,
        resolvedComplaints: 0,
        avgResolutionTime: 0
      }));
    }
  };
  
const fetchComplaintsByCategory = async (dateFilter) => {
  try {
    // Get complaints grouped by category with counts
    let query = supabase.rpc('get_complaints_by_category');
    
    // We need to handle filters in the frontend since this uses RPC
    const { data, error } = await query;
    
    if (error) throw error;
    
    setAnalyticsData(prev => ({
      ...prev,
      complaintsByCategory: data || []
    }));
    
    // Initialize category chart after getting data and ensuring component is mounted
    if (categoryCanvasRef.current) {
      initializeCategoryChart(data || []);
    }
  } catch (error) {
    console.error('Error fetching complaints by category:', error);
    setAnalyticsData(prev => ({
      ...prev,
      complaintsByCategory: []
    }));
  }
};

// Update fetchComplaintsByStatus
const fetchComplaintsByStatus = async (dateFilter) => {
  try {
    // Get data for status chart
    const statusData = [
      { status: 'Open', count: analyticsData.openComplaints },
      { status: 'In Progress', count: analyticsData.inProgressComplaints },
      { status: 'Resolved', count: analyticsData.resolvedComplaints }
    ];
    
    setAnalyticsData(prev => ({
      ...prev,
      complaintsByStatus: statusData
    }));
    
    // Initialize status chart if element is available
    if (statusCanvasRef.current) {
      initializeStatusChart(statusData);
    }
  } catch (error) {
    console.error('Error preparing status chart data:', error);
    setAnalyticsData(prev => ({
      ...prev,
      complaintsByStatus: []
    }));
  }
};

  
  const fetchComplaintsByDepartment = async (dateFilter) => {
    try {
      // For each department, get counts of complaints in each status
      const deptData = [];
      
      for (const dept of departments) {
        // Get categories for this department
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', dept.id);
          
        if (!deptCategories || deptCategories.length === 0) continue;
        
        const categoryIds = deptCategories.map(dc => dc.category_id);
        
        // Base query for this department's complaints
        let baseQuery = supabase.from('complaints')
          .select('*', { count: 'exact' })
          .in('category_id', categoryIds);
        
        // Apply date filter if any
        if (dateFilter.created_at) {
          baseQuery = baseQuery.filter('created_at', dateFilter.created_at);
        }
        
        // Get total count
        const { count: totalCount, error: totalError } = await baseQuery;
        
        if (totalError) throw totalError;
        
        // Get open count
        const { count: openCount, error: openError } = await baseQuery
          .eq('status', 'open');
        
        if (openError) throw openError;
        
        // Get in-progress count
        const { count: inProgressCount, error: inProgressError } = await baseQuery
          .eq('status', 'in_progress');
        
        if (inProgressError) throw inProgressError;
        
        // Get resolved count
        const { count: resolvedCount, error: resolvedError } = await baseQuery
          .eq('status', 'resolved');
        
        if (resolvedError) throw resolvedError;
        
        deptData.push({
          id: dept.id,
          name: dept.name,
          openCount: openCount || 0,
          inProgressCount: inProgressCount || 0,
          resolvedCount: resolvedCount || 0,
          totalCount: totalCount || 0
        });
      }
      
    setAnalyticsData(prev => ({
      ...prev,
      complaintsByDepartment: deptData
    }));
    
    // Initialize department chart if element is available
    if (departmentCanvasRef.current) {
      initializeDepartmentChart(deptData);
    }
  } catch (error) {
      console.error('Error fetching department data:', error);
      setAnalyticsData(prev => ({
        ...prev,
        complaintsByDepartment: []
      }));
    }
  };
  
  const fetchComplaintsTrend = async (dateFilter) => {
    try {
      // Get daily counts for trend analysis
      const now = new Date();
      let startDate = new Date();
      
      // Determine time range for trend
      switch (timeRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(now.getDate() - 30);
          break;
        case 'year':
          startDate.setMonth(now.getMonth() - 12);
          break;
        default:
          startDate.setFullYear(now.getFullYear() - 1);
      }
      
      // Get all complaints in the period
      let query = supabase.from('complaints')
        .select('created_at, status, category_id')
        .gte('created_at', startDate.toISOString());
        
      // Apply department filter if set
      if (filterDepartment) {
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', filterDepartment);
          
        if (deptCategories?.length > 0) {
          const categoryIds = deptCategories.map(dc => dc.category_id);
          query = query.in('category_id', categoryIds);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setAnalyticsData(prev => ({
        ...prev,
        complaintsTrend: data || []
      }));
      
      // Initialize trend chart
      setTimeout(() => {
        initializeTrendChart(data);
      }, 100);
    } catch (error) {
      console.error('Error fetching trend data:', error);
      setAnalyticsData(prev => ({
        ...prev,
        complaintsTrend: []
      }));
    }
  };
  
  const fetchResolutionTimes = async (dateFilter) => {
    try {
      // For each department, calculate average resolution time
      const resolutionData = [];
      
      for (const dept of departments) {
        // Get categories for this department
        const { data: deptCategories } = await supabase
          .from('department_categories')
          .select('category_id')
          .eq('department_id', dept.id);
          
        if (!deptCategories || deptCategories.length === 0) continue;
        
        const categoryIds = deptCategories.map(dc => dc.category_id);
        
        // Get resolved complaints with resolution times
        let query = supabase.from('complaints')
          .select('created_at, resolved_at')
          .in('category_id', categoryIds)
          .eq('status', 'resolved')
          .not('resolved_at', 'is', null);
          
        // Apply date filter if any
        if (dateFilter.created_at) {
          query = query.filter('created_at', dateFilter.created_at);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Calculate average resolution time
        let avgResolutionHours = 0;
        if (data && data.length > 0) {
          const totalHours = data.reduce((acc, complaint) => {
            const created = new Date(complaint.created_at);
            const resolved = new Date(complaint.resolved_at);
            return acc + (resolved - created) / (1000 * 60 * 60); // Convert to hours
          }, 0);
          
          avgResolutionHours = parseFloat((totalHours / data.length).toFixed(1));
        }
        
        resolutionData.push({
          id: dept.id,
          name: dept.name,
          avgResolutionHours,
          totalResolved: data?.length || 0
        });
      }
      
      setAnalyticsData(prev => ({
        ...prev,
        resolutionTimeByDepartment: resolutionData
      }));
      
      // Initialize resolution time chart
      setTimeout(() => {
        initializeResolutionTimeChart(resolutionData);
      }, 100);
    } catch (error) {
      console.error('Error fetching resolution times:', error);
      setAnalyticsData(prev => ({
        ...prev,
        resolutionTimeByDepartment: []
      }));
    }
  };
  // Add a more efficient data fetching approach
// Update the fetchAllComplaintsData function to use the correct location field names
const fetchAllComplaintsData = async (dateFilter) => {
  try {
    setLoading(true);
    
    // Create a base query for all complaints with necessary columns
    // Adjust the location fields to match your database schema
    let query = supabase.from('complaints')
      .select(`
        id, 
        title,
        description,
        status,
        created_at,
        resolved_at,
        category_id,
        categories(name),
        location
      `);
    
    // Apply time filter if any
    if (dateFilter.created_at) {
      query = query.gte('created_at', dateFilter.created_at);
    }
    
    // Apply department filter if selected
    if (filterDepartment) {
      // Get categories for this department
      const { data: deptCategories } = await supabase
        .from('department_categories')
        .select('category_id')
        .eq('department_id', filterDepartment);
        
      if (deptCategories?.length > 0) {
        const categoryIds = deptCategories.map(dc => dc.category_id);
        query = query.in('category_id', categoryIds);
      }
    }
    
    // Execute the query to get all complaints data
    const { data: complaints, error } = await query;
    
    if (error) throw error;
    
    // Process the data for analytics
    if (complaints && complaints.length > 0) {
      // Count by status
      const openComplaints = complaints.filter(c => c.status === 'open').length;
      const inProgressComplaints = complaints.filter(c => c.status === 'in_progress').length;
      const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
      
      // Calculate average resolution time
      const resolvedWithTime = complaints.filter(c => c.status === 'resolved' && c.resolved_at);
      let avgResolutionTime = 0;
      
      if (resolvedWithTime.length > 0) {
        const totalHours = resolvedWithTime.reduce((acc, complaint) => {
          const created = new Date(complaint.created_at);
          const resolved = new Date(complaint.resolved_at);
          return acc + (resolved - created) / (1000 * 60 * 60); // Convert to hours
        }, 0);
        
        avgResolutionTime = parseFloat((totalHours / resolvedWithTime.length).toFixed(1));
      }
      
      // Group by category
      const categoryCounts = {};
      complaints.forEach(complaint => {
        const categoryName = complaint.categories?.name || 'Uncategorized';
        if (!categoryCounts[categoryName]) {
          categoryCounts[categoryName] = 0;
        }
        categoryCounts[categoryName]++;
      });
      
      const complaintsByCategory = Object.entries(categoryCounts).map(([name, count]) => ({
        name,
        count
      }));
      
      // Prepare status data for chart
      const statusData = [
        { status: 'Open', count: openComplaints },
        { status: 'In Progress', count: inProgressComplaints },
        { status: 'Resolved', count: resolvedComplaints }
      ];
      
      // Extract location data properly based on the actual schema
      const locationData = complaints
        .filter(c => c.location && typeof c.location === 'object')
        .map(c => {
          // Check if location is stored as {latitude, longitude} or {lat, lng}
          if (c.location.latitude !== undefined && c.location.longitude !== undefined) {
            return {
              latitude: c.location.latitude,
              longitude: c.location.longitude
            };
          } else if (c.location.lat !== undefined && c.location.lng !== undefined) {
            return {
              latitude: c.location.lat,
              longitude: c.location.lng
            };
          }
          return null;
        })
        .filter(loc => loc !== null);
      
      // Set the processed analytics data
      setAnalyticsData(prev => ({
        ...prev,
        totalComplaints: complaints.length,
        openComplaints,
        inProgressComplaints,
        resolvedComplaints,
        avgResolutionTime,
        complaintsByCategory,
        complaintsByStatus: statusData,
        complaintsTrend: complaints, // Store all complaints for trend analysis
        locationHeatmapData: locationData
      }));
      
      // Now fetch department data which needs separate processing
      await processDepartmentData(complaints, dateFilter);
      
      // Initialize charts after data is ready
      setTimeout(() => {
        if (statusCanvasRef.current) initializeStatusChart(statusData);
        if (categoryCanvasRef.current) initializeCategoryChart(complaintsByCategory);
        if (trendCanvasRef.current) initializeTrendChart(complaints);
        
        // Initialize map if we have location data
        if (mapContainerRef.current && locationData.length > 0) {
          initializeMap(locationData);
        }
      }, 100);
      
      setLoading(false);
    } else {
      // No complaints found
      setAnalyticsData(prev => ({
        ...prev,
        totalComplaints: 0,
        openComplaints: 0,
        inProgressComplaints: 0,
        resolvedComplaints: 0,
        avgResolutionTime: 0,
        complaintsByCategory: [],
        complaintsByStatus: [
          { status: 'Open', count: 0 },
          { status: 'In Progress', count: 0 },
          { status: 'Resolved', count: 0 }
        ],
        complaintsTrend: [],
        locationHeatmapData: []
      }));
      
      setLoading(false);
    }
  } catch (error) {
    console.error('Error fetching complaints data:', error);
    setError(`Failed to load complaints data: ${error.message || 'Unknown error'}`);
    setLoading(false);
  }
};

// Process department data separately since it requires joining data
const processDepartmentData = async (complaints, dateFilter) => {
  try {
    // Get all department categories mapping
    const { data: deptCategoriesMap } = await supabase
      .from('department_categories')
      .select(`
        department_id,
        category_id,
        departments(id, name)
      `);
    
    if (!deptCategoriesMap) return;
    
    // Create a lookup to map categories to departments
    const categoryToDept = {};
    deptCategoriesMap.forEach(mapping => {
      if (mapping.departments) {
        categoryToDept[mapping.category_id] = {
          id: mapping.departments.id,
          name: mapping.departments.name
        };
      }
    });
    
    // Group complaints by department
    const departmentComplaints = {};
    
    complaints.forEach(complaint => {
      const dept = categoryToDept[complaint.category_id];
      if (!dept) return; // Skip if no matching department
      
      if (!departmentComplaints[dept.id]) {
        departmentComplaints[dept.id] = {
          id: dept.id,
          name: dept.name,
          complaints: [],
          openCount: 0,
          inProgressCount: 0,
          resolvedCount: 0,
          totalCount: 0
        };
      }
      
      departmentComplaints[dept.id].complaints.push(complaint);
      departmentComplaints[dept.id].totalCount++;
      
      switch (complaint.status) {
        case 'open':
          departmentComplaints[dept.id].openCount++;
          break;
        case 'in_progress':
          departmentComplaints[dept.id].inProgressCount++;
          break;
        case 'resolved':
          departmentComplaints[dept.id].resolvedCount++;
          break;
      }
    });
    
    // Calculate resolution times by department
    const resolutionTimeData = Object.values(departmentComplaints).map(dept => {
      const resolvedWithTime = dept.complaints.filter(c => 
        c.status === 'resolved' && c.resolved_at
      );
      
      let avgResolutionHours = 0;
      if (resolvedWithTime.length > 0) {
        const totalHours = resolvedWithTime.reduce((acc, complaint) => {
          const created = new Date(complaint.created_at);
          const resolved = new Date(complaint.resolved_at);
          return acc + (resolved - created) / (1000 * 60 * 60); // Convert to hours
        }, 0);
        
        avgResolutionHours = parseFloat((totalHours / resolvedWithTime.length).toFixed(1));
      }
      
      return {
        id: dept.id,
        name: dept.name,
        avgResolutionHours,
        totalResolved: resolvedWithTime.length
      };
    });
    
    // Convert to array for the charts
    const deptData = Object.values(departmentComplaints);
    
    // Update state with department data
    setAnalyticsData(prev => ({
      ...prev,
      complaintsByDepartment: deptData,
      resolutionTimeByDepartment: resolutionTimeData
    }));
    
    // Initialize department charts
    setTimeout(() => {
      if (departmentCanvasRef.current) {
        initializeDepartmentChart(deptData);
      }
      
      if (resolutionTimeCanvasRef.current) {
        initializeResolutionTimeChart(resolutionTimeData);
      }
    }, 100);
    
  } catch (error) {
    console.error('Error processing department data:', error);
  }
};

// Replace fetchAnalyticsData with this properly fixed version
const fetchAnalyticsData = async () => {
  try {
    setLoading(true);
    setError(null); // Clear any previous errors
    
    // Define the time constraints based on selected time range
    const now = new Date();
    let startDate = null;
    
    switch (timeRange) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        // 'all' case - no start date filter
        break;
    }
    
    // Properly format date filter for Supabase using the ISO string format
    const dateFilter = startDate ? {
      created_at: startDate.toISOString()
    } : {};
    
    // Fetch all data in a single approach
    await fetchAllComplaintsData(dateFilter);
    
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    setError(`Failed to load analytics data: ${error.message || 'Please try again'}`);
    setLoading(false);
  }
};

useEffect(() => {
  // Load data directly without permission checks
  const initializeAnalytics = async () => {
    setLoading(true);
    
    try {
      // Just fetch the user info for display purposes but don't restrict access
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Get role info but don't use it for restrictions
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (profileData?.role) {
          setUserRole(profileData.role);
        }
      }
      
      // Proceed with loading data regardless of permissions
      await fetchDepartments();
      await fetchAnalyticsData();
    } catch (err) {
      console.error('Error initializing analytics:', err);
      setError("There was a problem loading the analytics dashboard. Please try again.");
    }
  };
  
  initializeAnalytics();
  
  // Cleanup function for charts
  return () => {
    const charts = [
      statusChartRef.current,
      categoryChartRef.current,
      trendChartRef.current,
      deptPerformanceChartRef.current,
      resolutionTimeChartRef.current
    ];
    
    charts.forEach(chart => {
      if (chart) chart.destroy();
    });
    
    if (mapInstance.current) {
      mapInstance.current.remove();
    }
  };
}, [timeRange, filterDepartment]);
  const handleRefresh = () => {
    fetchAnalyticsData();
  };
  
  const exportAnalyticsData = () => {
    // Create CSV data
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Add general stats
    csvContent += "Analytics Data Export\r\n";
    csvContent += `Generated: ${new Date().toISOString()}\r\n`;
    csvContent += `Time Range: ${timeRange}\r\n`;
    csvContent += `Department Filter: ${filterDepartment ? departments.find(d => d.id === parseInt(filterDepartment))?.name || filterDepartment : 'All'}\r\n`;
    csvContent += "\r\n";
    
    // Add summary stats
    csvContent += "Summary Statistics\r\n";
    csvContent += "Metric,Value\r\n";
    csvContent += `Total Complaints,${analyticsData.totalComplaints}\r\n`;
    csvContent += `Open Complaints,${analyticsData.openComplaints}\r\n`;
    csvContent += `In Progress Complaints,${analyticsData.inProgressComplaints}\r\n`;
    csvContent += `Resolved Complaints,${analyticsData.resolvedComplaints}\r\n`;
    csvContent += `Average Resolution Time (hours),${analyticsData.avgResolutionTime}\r\n`;
    csvContent += "\r\n";
    
    // Add category data
    csvContent += "Complaints by Category\r\n";
    csvContent += "Category,Count\r\n";
    analyticsData.complaintsByCategory.forEach(cat => {
      csvContent += `${cat.name},${cat.count}\r\n`;
    });
    csvContent += "\r\n";
    
    // Add department data
    csvContent += "Complaints by Department\r\n";
    csvContent += "Department,Open,In Progress,Resolved,Total\r\n";
    analyticsData.complaintsByDepartment.forEach(dept => {
      csvContent += `${dept.name},${dept.openCount},${dept.inProgressCount},${dept.resolvedCount},${dept.totalCount}\r\n`;
    });
    csvContent += "\r\n";
    
    // Add resolution time data
    csvContent += "Resolution Time by Department\r\n";
    csvContent += "Department,Average Resolution Time (hours),Total Resolved\r\n";
    analyticsData.resolutionTimeByDepartment.forEach(dept => {
      csvContent += `${dept.name},${dept.avgResolutionHours},${dept.totalResolved}\r\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <BarChart2 className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        </div>
        
        {!loading && !error && (
          <div className="flex items-center space-x-4">
            {/* Time range selector */}
            <div className="inline-flex items-center">
              <Calendar className="text-gray-500 mr-2 h-5 w-5" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
            
            {/* Department filter */}
            <div className="inline-flex items-center">
              <Filter className="text-gray-500 mr-2 h-5 w-5" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            
            {/* Export button */}
            <button
              onClick={exportAnalyticsData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </button>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-indigo-600" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            <div className="ml-3">
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-500 text-sm mt-1">
                {error.includes("permission") ? 
                  "Please contact your administrator if you believe this is an error." :
                  "Try refreshing the page or coming back later."}
              </p>
            </div>
          </div>
          {error.includes("logged in") && (
            <div className="mt-4 ml-9">
              <button 
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key metrics */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 truncate">Total Complaints</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.totalComplaints}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 truncate">Open</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.openComplaints}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 truncate">In Progress</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.inProgressComplaints}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 truncate">Resolved</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{analyticsData.resolvedComplaints}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500 truncate">Avg. Resolution Time</p>
                    <p className="mt-1 text-3xl font-semibold text-gray-900">
                      {analyticsData.avgResolutionTime > 0 ? (
                        `${analyticsData.avgResolutionTime} hrs`
                      ) : (
                        'N/A'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Status distribution chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Complaints by Status</h3>
        <div className="h-64">
          <canvas ref={statusCanvasRef} id="statusChart"></canvas>
        </div>
      </div>
      
      {/* Category distribution chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Top Categories</h3>
        <div className="h-64">
          <canvas ref={categoryCanvasRef} id="categoryChart"></canvas>
        </div>
      </div>
    </div>
    
    {/* Trend analysis */}
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Complaint Trends Over Time</h3>
      <div className="h-96">
        <canvas ref={trendCanvasRef} id="trendChart"></canvas>
      </div>
    </div>
    
    {/* Department performance */}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Complaints by Department</h3>
        <div className="h-80">
          <canvas ref={departmentCanvasRef} id="departmentChart"></canvas>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Department Resolution Time</h3>
        <div className="h-80">
          <canvas ref={resolutionTimeCanvasRef} id="resolutionTimeChart"></canvas>
        </div>
      </div>
    </div>
          
          {/* Heatmap */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Complaint Distribution Heatmap</h3>
            <div className="h-96 bg-gray-100 rounded-lg" ref={mapContainerRef}></div>
            <div className="mt-4 flex items-center justify-center">
              <div className="w-full max-w-lg h-2 bg-gradient-to-r from-blue-500 via-lime-400 to-red-500 rounded-full"></div>
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-500">
              <span>Low Density</span>
              <span>High Density</span>
            </div>
          </div>
          
          {/* Table view of raw data */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Department Performance Summary</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Progress</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolved</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolution Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analyticsData.complaintsByDepartment.map((dept) => {
                    // Find resolution time data for this department
                    const resolutionData = analyticsData.resolutionTimeByDepartment.find(d => d.id === dept.id);
                    const resolutionHours = resolutionData ? resolutionData.avgResolutionHours : 0;
                    
                    // Calculate performance score (60% based on resolution rate, 40% on time)
                    const resolutionRate = dept.totalCount > 0 ? (dept.resolvedCount / dept.totalCount) : 0;
                    const timeScore = resolutionHours > 0 ? 
                      (resolutionHours < 24 ? 1 : 
                       resolutionHours < 48 ? 0.8 : 
                       resolutionHours < 72 ? 0.6 : 
                       resolutionHours < 96 ? 0.4 : 
                       0.2) : 0;
                    
                    const performanceScore = (resolutionRate * 0.6) + (timeScore * 0.4);
                    
                    return (
                      <tr key={dept.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.openCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.inProgressCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.resolvedCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.totalCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {resolutionHours > 0 ? `${resolutionHours} hrs` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                performanceScore >= 0.8 ? 'bg-green-500' :
                                performanceScore >= 0.6 ? 'bg-lime-500' :
                                performanceScore >= 0.4 ? 'bg-yellow-500' :
                                performanceScore >= 0.2 ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${performanceScore * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 mt-1 block">
                            {(performanceScore * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;