import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  RefreshCw, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  Edit3,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ComplaintsTable = ({ 
  complaints, 
  complaintFilters, 
  setComplaintFilters, 
  isFilterApplied, 
  setIsFilterApplied, 
  showFilters, 
  setShowFilters, 
  handleFilterChange, 
  applyFilters, 
  clearFilters, 
  fetchComplaints, 
  complaintsSorting, 
  handleSortChange, 
  complaintsPage, 
  complaintsPagination, 
  handlePageChange, 
  selectedComplaints, 
  setSelectedComplaints, 
  handleBulkStatusChange, 
  categories, 
  handleExportComplaints, 
  isExporting,
  formatDate,
  handleIndividualStatusChange
}) => {
  const navigate = useNavigate();

  // Handle select all complaints
  const handleSelectAllComplaints = (e) => {
    if (e.target.checked) {
      setSelectedComplaints(complaints.map(c => c.id));
    } else {
      setSelectedComplaints([]);
    }
  };
  
  // Handle individual complaint selection
  const handleSelectComplaint = (id, isChecked) => {
    if (isChecked) {
      setSelectedComplaints(prev => [...prev, id]);
    } else {
      setSelectedComplaints(prev => prev.filter(itemId => itemId !== id));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'open':
        return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
      case 'in_progress':
        return `${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`;
      case 'resolved':
        return `${baseClasses} bg-green-100 text-green-800 border border-green-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
    }
  };

  const getPriorityBadge = (priority) => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded text-xs font-medium";
    switch (priority) {
      case 'high':
        return `${baseClasses} bg-red-50 text-red-700 border border-red-200`;
      case 'medium':
        return `${baseClasses} bg-yellow-50 text-yellow-700 border border-yellow-200`;
      case 'low':
        return `${baseClasses} bg-green-50 text-green-700 border border-green-200`;
      default:
        return `${baseClasses} bg-gray-50 text-gray-700 border border-gray-200`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Complaints Management</h2>
            <p className="text-blue-100 text-sm mt-1">Manage and track all system complaints</p>
          </div>
          <div className="text-white text-sm bg-white/20 rounded-lg px-3 py-1">
            Total: <span className="font-semibold">{complaintsPagination.total}</span> complaints
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Enhanced Search and Filter Bar */}
        <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="search"
                value={complaintFilters.search}
                onChange={handleFilterChange}
                placeholder="Search by ID, title or description..."
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-80 shadow-sm transition-all duration-200"
              />
            </div>
            <button 
              className={`inline-flex items-center px-4 py-2.5 border ${
                isFilterApplied 
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              } rounded-lg text-sm font-medium transition-all duration-200`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters {isFilterApplied && <span className="ml-1 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">Active</span>}
            </button>
            {isFilterApplied && (
              <button 
                className="inline-flex items-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
                onClick={clearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              className="inline-flex items-center px-4 py-2.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm"
              onClick={() => fetchComplaints(complaintsPage, complaintFilters, complaintsSorting)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button 
              className="inline-flex items-center px-4 py-2.5 border border-blue-600 text-sm font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all duration-200 shadow-sm"
              onClick={handleExportComplaints}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
        
        {/* Enhanced Filter Panel */}
        {showFilters && (
          <div className="bg-gray-50 shadow-sm rounded-lg p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  id="status"
                  name="status"
                  value={complaintFilters.status}
                  onChange={handleFilterChange}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg transition-all duration-200"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  id="category"
                  name="category"
                  value={complaintFilters.category}
                  onChange={handleFilterChange}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg transition-all duration-200"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={complaintFilters.startDate}
                  onChange={handleFilterChange}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg transition-all duration-200"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={complaintFilters.endDate}
                  onChange={handleFilterChange}
                  className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg transition-all duration-200"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowFilters(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={applyFilters}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
        
        {/* Enhanced Bulk Actions */}
        {selectedComplaints.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm text-blue-800 font-medium">
                  Selected <span className="font-bold">{selectedComplaints.length}</span> complaint{selectedComplaints.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkStatusChange('in_progress')}
                  className="inline-flex items-center px-3 py-1.5 border border-yellow-300 text-xs font-medium rounded-lg text-yellow-800 bg-yellow-100 hover:bg-yellow-200 transition-all duration-200"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Mark as In Progress
                </button>
                <button
                  onClick={() => handleBulkStatusChange('resolved')}
                  className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded-lg text-green-800 bg-green-100 hover:bg-green-200 transition-all duration-200"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Mark as Resolved
                </button>
                <button
                  onClick={() => setSelectedComplaints([])}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Table */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" width="40" className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      onChange={handleSelectAllComplaints}
                      checked={selectedComplaints.length > 0 && selectedComplaints.length === complaints.length}
                    />
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                    onClick={() => handleSortChange('id')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>ID</span>
                      {complaintsSorting.column === 'id' && (
                        <span className="text-blue-600">{complaintsSorting.direction === 'ascending' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                    onClick={() => handleSortChange('title')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Title</span>
                      {complaintsSorting.column === 'title' && (
                        <span className="text-blue-600">{complaintsSorting.direction === 'ascending' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reported By
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                    onClick={() => handleSortChange('status')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {complaintsSorting.column === 'status' && (
                        <span className="text-blue-600">{complaintsSorting.direction === 'ascending' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                    onClick={() => handleSortChange('created_at')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date</span>
                      {complaintsSorting.column === 'created_at' && (
                        <span className="text-blue-600">{complaintsSorting.direction === 'ascending' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {complaints.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-lg font-medium">No complaints found</p>
                        <p className="text-gray-400 text-sm">Try adjusting your filters or search terms</p>
                      </div>
                    </td>
                  </tr>
                )}
                {complaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        checked={selectedComplaints.includes(complaint.id)}
                        onChange={(e) => handleSelectComplaint(complaint.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                        #{complaint.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">{complaint.title}</div>
                        <div className="text-sm text-gray-500 truncate mt-1">{complaint.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {complaint.categories?.icon && (
                          <span className="mr-2">{complaint.categories.icon}</span>
                        )}
                        <span className="text-sm text-gray-900">
                          {complaint.categories?.name || 'Uncategorized'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {complaint.anonymous ? 'Anonymous' : `${complaint.users?.first_name} ${complaint.users?.last_name}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {complaint.departments?.name || 
                         <span className="text-gray-400 italic">Not assigned</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {complaint.assigned_to_user ? (
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {complaint.assigned_to_user.first_name} {complaint.assigned_to_user.last_name}
                            </div>
                            {complaint.assigned_to_user.official_position && (
                              <div className="text-xs text-gray-500">
                                {complaint.assigned_to_user.official_position}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(complaint.status)}>
                        {getStatusIcon(complaint.status)}
                        {complaint.status === 'in_progress' ? 'In Progress' : 
                          complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(complaint.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button 
                          className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200"
                          onClick={() => {
                            console.log('Navigating to complaint:', complaint.id);
                            navigate(`/complaint/${complaint.id}`);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </button>
                        {complaint.status === 'open' && (
                          <button 
                            className="inline-flex items-center px-3 py-1.5 border border-yellow-300 text-xs font-medium rounded-lg text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-all duration-200"
                            onClick={() => {
                              console.log('Changing status to in_progress for complaint:', complaint.id);
                              handleIndividualStatusChange && handleIndividualStatusChange(complaint.id, 'in_progress');
                            }}
                            title="Mark as In Progress"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Progress
                          </button>
                        )}
                        {(complaint.status === 'open' || complaint.status === 'in_progress') && (
                          <button 
                            className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-all duration-200"
                            onClick={() => {
                              console.log('Changing status to resolved for complaint:', complaint.id);
                              handleIndividualStatusChange && handleIndividualStatusChange(complaint.id, 'resolved');
                            }}
                            title="Mark as Resolved"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Enhanced Pagination */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(complaintsPagination.currentPage - 1)}
                  disabled={complaintsPagination.currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg ${
                    complaintsPagination.currentPage === 1 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-all duration-200`}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(complaintsPagination.currentPage + 1)}
                  disabled={complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize)}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg ${
                    complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize) 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-all duration-200`}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{complaints.length > 0 ? ((complaintsPagination.currentPage - 1) * complaintsPagination.pageSize) + 1 : 0}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(complaintsPagination.currentPage * complaintsPagination.pageSize, complaintsPagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{complaintsPagination.total}</span> complaints
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(complaintsPagination.currentPage - 1)}
                      disabled={complaintsPagination.currentPage === 1}
                      className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-300 text-sm font-medium ${
                        complaintsPagination.currentPage === 1 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      } transition-all duration-200`}
                    >
                      <span className="sr-only">Previous</span>
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      Page {complaintsPagination.currentPage} of {Math.ceil(complaintsPagination.total / complaintsPagination.pageSize) || 1}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(complaintsPagination.currentPage + 1)}
                      disabled={complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize)}
                      className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-300 text-sm font-medium ${
                        complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize) 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      } transition-all duration-200`}
                    >
                      <span className="sr-only">Next</span>
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintsTable;
