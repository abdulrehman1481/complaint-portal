import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import {
  AlertTriangle, Clock, CheckCircle, Users, TrendingUp, TrendingDown,
  Activity, FileText, UserCheck, Zap
} from 'lucide-react';

const DepartmentStats = ({ stats, analyticsData, departmentName }) => {
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  const StatCard = ({ title, value, icon: Icon, color, trend, trendValue }) => (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-4 h-4 mr-1" />
              ) : null}
              {trendValue}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const calculatePercentage = (value, total) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  };

  const resolutionRate = stats.totalComplaints > 0 
    ? ((stats.resolvedComplaints / stats.totalComplaints) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">{departmentName} Dashboard</h2>
        <p className="text-blue-100">
          Comprehensive overview of complaints and performance metrics
        </p>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Complaints"
          value={stats.totalComplaints}
          icon={FileText}
          color="bg-blue-500"
          trend={stats.totalComplaints > 0 ? "up" : "neutral"}
          trendValue="All time"
        />
        <StatCard
          title="Open Complaints"
          value={stats.openComplaints}
          icon={AlertTriangle}
          color="bg-red-500"
          trend={stats.openComplaints > 0 ? "neutral" : "down"}
          trendValue={`${calculatePercentage(stats.openComplaints, stats.totalComplaints)}% of total`}
        />
        <StatCard
          title="In Progress"
          value={stats.inProgressComplaints}
          icon={Clock}
          color="bg-yellow-500"
          trend="neutral"
          trendValue={`${calculatePercentage(stats.inProgressComplaints, stats.totalComplaints)}% of total`}
        />
        <StatCard
          title="Resolved"
          value={stats.resolvedComplaints}
          icon={CheckCircle}
          color="bg-green-500"
          trend={stats.resolvedComplaints > 0 ? "up" : "neutral"}
          trendValue={`${resolutionRate}% resolution rate`}
        />
      </div>

      {/* Secondary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Field Agents"
          value={stats.departmentUsers}
          icon={Users}
          color="bg-purple-500"
          trend="neutral"
          trendValue="Active agents"
        />
        <StatCard
          title="Avg Resolution Time"
          value={stats.avgResolutionTime ? `${stats.avgResolutionTime} days` : 'N/A'}
          icon={Zap}
          color="bg-indigo-500"
          trend={stats.avgResolutionTime && stats.avgResolutionTime < 7 ? "up" : "neutral"}
          trendValue={stats.avgResolutionTime ? "Per complaint" : "No data"}
        />
        <StatCard
          title="Response Rate"
          value={`${analyticsData.performanceMetrics?.resolutionRate?.toFixed(1) || '0.0'}%`}
          icon={Activity}
          color="bg-teal-500"
          trend={analyticsData.performanceMetrics?.resolutionRate > 80 ? "up" : "neutral"}
          trendValue="Success rate"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complaint Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.complaintsByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analyticsData.complaintsByStatus?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complaints by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.complaintsByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {analyticsData.performanceMetrics?.responseTime?.toFixed(1) || '0.0'}h
            </div>
            <div className="text-sm text-gray-600 mt-1">Average Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {analyticsData.performanceMetrics?.resolutionRate?.toFixed(1) || '0.0'}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Resolution Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {analyticsData.performanceMetrics?.reopenRate?.toFixed(1) || '0.0'}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Reopen Rate</div>
          </div>
        </div>
      </div>

      {/* Trend Analysis */}
      {analyticsData.trendData && analyticsData.trendData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complaint Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="complaints" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.3} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DepartmentStats;
