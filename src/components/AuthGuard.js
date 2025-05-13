import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';

/**
 * AuthGuard component for handling role-based access control
 * 
 * @param {Object} props 
 * @param {React.ReactNode} props.children - Child components to render if authorized
 * @param {Array<string>} [props.allowedRoles] - List of allowed roles for this route
 * @param {boolean} [props.requireAuth=true] - Whether authentication is required for this route
 * @returns {JSX.Element}
 */
const AuthGuard = ({ children, allowedRoles = [], requireAuth = true }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [redirectTo, setRedirectTo] = useState('');
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session and auth is required, redirect to login
        if (!session && requireAuth) {
          setRedirectTo('/');
          setAuthorized(false);
          return;
        }
        
        // If no session but auth is not required, grant access
        if (!session && !requireAuth) {
          setAuthorized(true);
          return;
        }

        // If there are no specific roles required, grant access
        if (allowedRoles.length === 0) {
          setAuthorized(true);
          return;
        }

        // Fetch user details with role information
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select(`
              *,
              roles:role_id(id, name)
            `)
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.warn('Error fetching user data:', error);
            
            // Create a new user record if one doesn't exist yet
            if (error.code === 'PGRST116') { // No rows returned
              // First, get the Public User role ID
              const { data: roleData } = await supabase
                .from('roles')
                .select('id')
                .eq('name', 'Public User')
                .single();
              
              const roleId = roleData?.id || 4; // Default to role ID 4 if not found
              
              // Create the user profile
              const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert([{
                  id: session.user.id,
                  first_name: session.user.user_metadata?.first_name || 'New',
                  last_name: session.user.user_metadata?.last_name || 'User',
                  email: session.user.email,
                  role_id: roleId
                }])
                .select(`*, roles:role_id(id, name)`)
                .single();
              
              if (createError) {
                throw createError;
              }
              
              // Check if the new user role is authorized for this route
              const userRole = newUser.roles?.name || 'Public User';
              const isAuthorized = allowedRoles.includes(userRole);
              
              if (!isAuthorized) {
                setRedirectTo('/dashboard'); // Default to user dashboard
              }
              
              setAuthorized(isAuthorized);
              return;
            } else {
              throw error;
            }
          }

          // Check if user's role is allowed
          const userRole = userData.roles?.name;
          const isAuthorized = allowedRoles.includes(userRole);
          
          if (!isAuthorized) {
            // Redirect based on user role
            if (userRole === 'Super Admin' || userRole === 'Department Admin') {
              setRedirectTo('/admin');
            } else {
              setRedirectTo('/dashboard');
            }
          }
          
          setAuthorized(isAuthorized);
        } catch (error) {
          console.error('Error processing user data:', error);
          setAuthorized(false);
          setRedirectTo('/dashboard');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthorized(false);
        setRedirectTo('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [requireAuth, allowedRoles, location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!authorized && redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default AuthGuard;
