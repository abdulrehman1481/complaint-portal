/**
 * Utility functions for checking user permissions
 */

/**
 * Check if user can access analysis tools
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user has access to analysis tools
 */
export const canAccessAnalysisTools = (user) => {
  if (!user || !user.roles) return false;
  
  const adminRoles = ['Super Admin', 'Department Admin'];
  return adminRoles.includes(user.roles.name);
};

/**
 * Check if user is admin level (Super Admin or Department Admin)
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is admin
 */
export const isAdmin = (user) => {
  return canAccessAnalysisTools(user);
};

/**
 * Check if user is department admin
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is department admin
 */
export const isDepartmentAdmin = (user) => {
  if (!user || !user.roles) return false;
  return user.roles.name === 'Department Admin';
};

/**
 * Check if user is super admin
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is super admin
 */
export const isSuperAdmin = (user) => {
  if (!user || !user.roles) return false;
  return user.roles.name === 'Super Admin';
};

/**
 * Check if user is a regular user (not admin)
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is regular user
 */
export const isRegularUser = (user) => {
  if (!user || !user.roles) return false;
  return user.roles.name === 'Public User';
};

/**
 * Get department ID for department admin
 * @param {Object} user - User object
 * @returns {number|null} - Department ID or null
 */
export const getDepartmentId = (user) => {
  if (!user) return null;
  return user.department_id || null;
};

const userPermissions = {
  canAccessAnalysisTools,
  isAdmin,
  isDepartmentAdmin,
  isSuperAdmin,
  isRegularUser,
  getDepartmentId,
  canViewDashboard: (user) => isAdmin(user) ,
  canManageUsers: (user) => isAdmin(user),
};

export default userPermissions;
