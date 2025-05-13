import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardStats = ({ stats, complaints, formatDate, handleTabChange }) => {
  const navigate = useNavigate();
  
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                <AlertTriangle className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500 truncate">Total Complaints</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalComplaints}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500 truncate">Open Complaints</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.openComplaints}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500 truncate">In Progress</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.inProgressComplaints}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500 truncate">Resolved</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.resolvedComplaints}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500 truncate">Avg. Resolution Time</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {stats.avgResolutionTime ? `${stats.avgResolutionTime}h` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Complaints</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {complaints.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                          No complaints found.
                        </td>
                      </tr>
                    ) : (
                      complaints.slice(0, 5).map((complaint) => (
                        <tr key={complaint.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/complaint/${complaint.id}`)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{complaint.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{complaint.title}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {complaint.categories?.icon} {complaint.categories?.name}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">User Statistics</h3>
              <div className="mt-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-900">Total Users</div>
                  <div className="text-sm text-gray-500">{stats.totalUsers}</div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-900">New Users (This Month)</div>
                  <div className="text-sm text-gray-500">-</div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-900">Active Users (Last 7 Days)</div>
                  <div className="text-sm text-gray-500">-</div>
                </div>
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => handleTabChange('users')}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  View All Users
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
