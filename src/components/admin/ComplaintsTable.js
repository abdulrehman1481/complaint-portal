import React from 'react';
import { 
  Search, 
  Filter, 
  X, 
  RefreshCw, 
  Download, 
  ChevronLeft, 
  ChevronRight 
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
  formatDate 
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

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-4">
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
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button 
            className={`inline-flex items-center px-4 py-2 border ${isFilterApplied ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-700'} rounded-md shadow-sm text-sm font-medium hover:bg-gray-50`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters {isFilterApplied && '(Active)'}
          </button>
          {isFilterApplied && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              onClick={clearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </button>
          )}
        </div>
        <div className="flex space-x-2">
          <button 
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            onClick={() => fetchComplaints(complaintsPage, complaintFilters, complaintsSorting)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button 
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            onClick={handleExportComplaints}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
      
      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white shadow-md rounded-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                id="status"
                name="status"
                value={complaintFilters.status}
                onChange={handleFilterChange}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                id="category"
                name="category"
                value={complaintFilters.category}
                onChange={handleFilterChange}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={complaintFilters.startDate}
                onChange={handleFilterChange}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={complaintFilters.endDate}
                onChange={handleFilterChange}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setShowFilters(false)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={applyFilters}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Bulk actions */}
      {selectedComplaints.length > 0 && (
        <div className="bg-gray-50 rounded-md p-3 mb-4 flex justify-between items-center">
          <span className="text-sm text-gray-700">
            Selected <span className="font-medium">{selectedComplaints.length}</span> complaints
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleBulkStatusChange('in_progress')}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
            >
              Mark as In Progress
            </button>
            <button
              onClick={() => handleBulkStatusChange('resolved')}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
            >
              Mark as Resolved
            </button>
            <button
              onClick={() => setSelectedComplaints([])}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" width="40" className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={handleSelectAllComplaints}
                    checked={selectedComplaints.length > 0 && selectedComplaints.length === complaints.length}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('id')}
                >
                  ID
                  {complaintsSorting.column === 'id' && (
                    <span>{complaintsSorting.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('title')}
                >
                  Title
                  {complaintsSorting.column === 'title' && (
                    <span>{complaintsSorting.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reported By
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('status')}
                >
                  Status
                  {complaintsSorting.column === 'status' && (
                    <span>{complaintsSorting.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortChange('created_at')}
                >
                  Date
                  {complaintsSorting.column === 'created_at' && (
                    <span>{complaintsSorting.direction === 'ascending' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {complaints.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-10 text-center text-gray-500">
                    No complaints found. Try adjusting your filters.
                  </td>
                </tr>
              )}
              {complaints.map((complaint) => (
                <tr key={complaint.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedComplaints.includes(complaint.id)}
                      onChange={(e) => handleSelectComplaint(complaint.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{complaint.id}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{complaint.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{complaint.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {complaint.categories?.icon} {complaint.categories?.name || 'Uncategorized'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {complaint.anonymous ? 'Anonymous' : `${complaint.users?.first_name} ${complaint.users?.last_name}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {complaint.assigned_to_user ? 
                        `${complaint.assigned_to_user.first_name} ${complaint.assigned_to_user.last_name}` : 
                        <span className="text-gray-400">Unassigned</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${complaint.status === 'open' ? 'bg-red-100 text-red-800' : 
                        complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-green-100 text-green-800'}`}>
                      {complaint.status === 'in_progress' ? 'In Progress' : 
                        complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(complaint.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      className="text-indigo-600 hover:text-indigo-900"
                      onClick={() => navigate(`/complaint/${complaint.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(complaintsPagination.currentPage - 1)}
              disabled={complaintsPagination.currentPage === 1}
              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                complaintsPagination.currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(complaintsPagination.currentPage + 1)}
              disabled={complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize)}
              className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize) 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
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
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(complaintsPagination.currentPage - 1)}
                  disabled={complaintsPagination.currentPage === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                    complaintsPagination.currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
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
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                    complaintsPagination.currentPage >= Math.ceil(complaintsPagination.total / complaintsPagination.pageSize) 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
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
  );
};

export default ComplaintsTable;
