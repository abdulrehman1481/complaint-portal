import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { redirectToDashboard } from '../utils/roleBasedRouting';

const DashboardRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    redirectToDashboard(navigate);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );
};

export default DashboardRedirect;
