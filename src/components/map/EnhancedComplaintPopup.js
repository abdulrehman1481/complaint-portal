import React from 'react';
import { Calendar, MapPin, User2, AlertCircle, CheckCircle2, Clock, FileText, Tag, Building } from 'lucide-react';

const EnhancedComplaintPopup = ({ complaint }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'closed': return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 border-red-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="min-w-[300px] max-w-[400px] p-4 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900 line-clamp-2">
            {complaint.title || 'Untitled Complaint'}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(complaint.status)}`}>
              {getStatusIcon(complaint.status)}
              {complaint.status?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN'}
            </span>
            {complaint.priority && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(complaint.priority)}`}>
                {complaint.priority?.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 ml-2">
          #{complaint.id}
        </div>
      </div>

      {/* Details Grid */}
      <div className="space-y-3">
        {/* Category */}
        {complaint.categories?.name && (
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">Category:</span>
            <span className="text-sm font-medium text-gray-900">
              {complaint.categories.name}
            </span>
          </div>
        )}

        {/* Department */}
        {complaint.department_name && (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">Department:</span>
            <span className="text-sm font-medium text-gray-900">
              {complaint.department_name}
            </span>
          </div>
        )}

        {/* Location */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-sm text-gray-600">Location:</span>
            <div className="text-sm font-medium text-gray-900">
              {complaint.locationName || 'Loading location...'}
            </div>
            {complaint.coordinates && (
              <div className="text-xs text-gray-500 mt-1">
                {complaint.coordinates[1]?.toFixed(6)}, {complaint.coordinates[0]?.toFixed(6)}
              </div>
            )}
          </div>
        </div>

        {/* Reporter */}
        <div className="flex items-center gap-2">
          <User2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">Reported by:</span>
          <span className="text-sm font-medium text-gray-900">
            {complaint.anonymous ? 'Anonymous User' : (complaint.reported_by_name || `User #${complaint.reported_by}`)}
          </span>
        </div>

        {/* Created Date */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">Created:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatDate(complaint.created_at)}
          </span>
        </div>

        {/* Updated Date */}
        {complaint.updated_at && complaint.updated_at !== complaint.created_at && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">Updated:</span>
            <span className="text-sm font-medium text-gray-900">
              {formatDate(complaint.updated_at)}
            </span>
          </div>
        )}

        {/* Description */}
        {complaint.description && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-gray-600">Description:</span>
              <div className="text-sm text-gray-900 mt-1 max-h-20 overflow-y-auto">
                {complaint.description}
              </div>
            </div>
          </div>
        )}

        {/* Urgency Level */}
        {complaint.urgency_level && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">Urgency:</span>
            <span className={`text-sm font-medium px-2 py-1 rounded ${getPriorityColor(complaint.urgency_level)}`}>
              {complaint.urgency_level?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Response Required */}
        {complaint.response_required !== undefined && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-600">Response Required:</span>
            <span className={`text-sm font-medium ${complaint.response_required ? 'text-red-600' : 'text-green-600'}`}>
              {complaint.response_required ? 'Yes' : 'No'}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('viewComplaintDetails', {
              detail: { id: complaint.id }
            }));
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors duration-200"
        >
          View Full Details
        </button>
      </div>
    </div>
  );
};

export default EnhancedComplaintPopup;
