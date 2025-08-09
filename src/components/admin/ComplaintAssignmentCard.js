import React, { useState } from 'react';
import { User, Users, AlertTriangle, Clock, CheckCircle, MapPin } from 'lucide-react';

const ComplaintAssignmentCard = ({ 
  complaint, 
  fieldAgents, 
  onAssign, 
  onStatusUpdate, 
  onViewDetails 
}) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(complaint.assigned_to || '');

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setIsAssigning(true);
    try {
      await onAssign(complaint.id, selectedAgent || null);
    } finally {
      setIsAssigning(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'text-green-600';
      case 2: return 'text-yellow-600';
      case 3: return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg mb-2">
            {complaint.title}
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {complaint.categories?.name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDate(complaint.created_at)}
            </span>
            {complaint.priority && (
              <span className={`flex items-center gap-1 ${getPriorityColor(complaint.priority)}`}>
                Priority {complaint.priority}
              </span>
            )}
          </div>
          {complaint.description && (
            <p className="text-gray-700 text-sm mb-3 line-clamp-2">
              {complaint.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(complaint.status)}`}>
            {complaint.status.replace('_', ' ').toUpperCase()}
          </span>
          <button
            onClick={() => onViewDetails(complaint.id)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Details
          </button>
        </div>
      </div>

      {/* Reporter and Current Assignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reporter</label>
          <p className="text-sm text-gray-900 mt-1">
            {complaint.users && complaint.users[0] 
              ? `${complaint.users[0].first_name} ${complaint.users[0].last_name}`
              : 'Anonymous'
            }
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Currently Assigned</label>
          <p className="text-sm text-gray-900 mt-1">
            {complaint.users && complaint.users[1]
              ? `${complaint.users[1].first_name} ${complaint.users[1].last_name}`
              : 'Unassigned'
            }
          </p>
        </div>
      </div>

      {/* Assignment Section */}
      <div className="border-t pt-4">
        <form onSubmit={handleAssignSubmit} className="flex items-center gap-3">
          <div className="flex-1">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isAssigning}
            >
              <option value="">Select Field Agent</option>
              {fieldAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.first_name} {agent.last_name} 
                  {agent.official_position && ` (${agent.official_position})`}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isAssigning || selectedAgent === complaint.assigned_to}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isAssigning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <User className="w-4 h-4" />
                {selectedAgent === complaint.assigned_to ? 'Already Assigned' : 'Assign'}
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Status Update */}
      {complaint.status !== 'resolved' && (
        <div className="border-t mt-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Quick Status:</span>
            <div className="flex gap-2">
              {complaint.status !== 'in_progress' && (
                <button
                  onClick={() => onStatusUpdate(complaint.id, 'in_progress')}
                  className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full hover:bg-yellow-200 transition-colors"
                >
                  Mark In Progress
                </button>
              )}
              <button
                onClick={() => onStatusUpdate(complaint.id, 'resolved')}
                className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintAssignmentCard;
