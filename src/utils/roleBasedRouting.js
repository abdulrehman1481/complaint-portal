import { supabase } from '../supabaseClient';

/**
 * Redirects user to appropriate dashboard based on their role
 * @param {object} navigate - React Router navigate function
 * @returns {Promise<void>}
 */
export const redirectToDashboard = async (navigate) => {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      navigate('/');
      return;
    }

    const { data: userData, error } = await supabase
      .from('users')
      .select(`
        *,
        roles (id, name, permissions),
        departments (id, name)
      `)
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
      navigate('/dashboard'); // Fallback to default dashboard
      return;
    }

    const roleName = userData.roles?.name;

    // Redirect based on role
    switch (roleName) {
      case 'Super Admin':
        navigate('/admin');
        break;
      case 'Department Admin':
        navigate('/department-admin');
        break;
      case 'Field Agent':
        navigate('/field-agent');
        break;
      case 'Public User':
      default:
        navigate('/dashboard');
        break;
    }
  } catch (error) {
    console.error('Error in role-based redirect:', error);
    navigate('/dashboard'); // Fallback to default dashboard
  }
};

/**
 * Gets the appropriate dashboard path for a user role
 * @param {string} roleName - The role name
 * @returns {string} - The dashboard path
 */
export const getDashboardPath = (roleName) => {
  switch (roleName) {
    case 'Super Admin':
      return '/admin';
    case 'Department Admin':
      return '/department-admin';
    case 'Field Agent':
      return '/field-agent';
    case 'Public User':
    default:
      return '/dashboard';
  }
};

/**
 * Checks if user has permission for a specific action
 * @param {object} user - User object with roles
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (user, permission) => {
  if (!user || !user.roles || !user.roles.permissions) {
    return false;
  }
  
  return user.roles.permissions.includes(permission);
};

/**
 * Gets user role permissions based on role name
 * @param {string} roleName - The role name
 * @returns {string[]} - Array of permissions
 */
export const getRolePermissions = (roleName) => {
  switch (roleName) {
    case 'Super Admin':
      return ['manage_system', 'manage_roles', 'manage_users', 'manage_content'];
    case 'Department Admin':
      return ['manage_department', 'manage_complaints', 'generate_reports'];
    case 'Field Agent':
      return ['update_complaints', 'upload_evidence'];
    case 'Public User':
    default:
      return ['report_issues', 'view_map'];
  }
};
