/**
 * Utility functions for checking user permissions
 */

// Normalize role name from diverse user shapes (Supabase/JWT/custom)
const getRoleName = (user) => {
  if (!user) return null;

  // Common direct fields
  const candidates = [
    user.role,
    user.role_name,
    user?.role?.name,
    user?.roles?.name,
    user?.user_metadata?.role,
    user?.user_metadata?.role_name,
    user?.app_metadata?.role,
    user?.app_metadata?.role_name,
    user?.metadata?.role,
    user?.custom_claims?.role,
  ];

  // Prefer explicit string role
  const firstString = candidates.find(r => typeof r === 'string');
  if (firstString) return String(firstString).trim();

  // If roles provided as an array of strings or objects with name
  const rolesArrays = [
    user?.roles,
    user?.rolesArray,
    user?.roles_list,
    user?.user_metadata?.roles,
    user?.app_metadata?.roles,
  ].filter(Array.isArray);

  for (const arr of rolesArrays) {
    for (const r of arr) {
      if (typeof r === 'string') return String(r).trim();
      if (r && typeof r === 'object' && 'name' in r) return String(r.name).trim();
    }
  }

  // Object candidate with name
  const objectWithName = candidates.find(r => r && typeof r === 'object' && 'name' in r);
  if (objectWithName) return String(objectWithName.name).trim();

  // Boolean fallbacks → infer admin
  if (user.is_super_admin || user.isSuperAdmin) return 'Super Admin';
  if (user.is_admin || user.isAdmin) return 'Admin';

  return null;
};

// Normalize strings like "SuperAdmin", "super_admin", "SUPER-ADMIN" to a canonical token
const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ') // underscores/hyphens → space
  .trim();

// Map common synonyms to canonical role names
const canonicalize = (roleStr) => {
  const r = norm(roleStr);
  if (!r) return null;
  if (r === 'super admin' || r === 'superadministrator' || r === 'superadmin' || r === 'owner') return 'Super Admin';
  if (r === 'department admin' || r === 'dept admin' || r === 'deptadmin' || r === 'departmentadministrator') return 'Department Admin';
  if (r === 'admin' || r === 'administrator' || r === 'site admin') return 'Admin';
  if (r === 'public user' || r === 'public' || r === 'user' || r === 'citizen') return 'Public User';
  // Fallback to capitalized words
  return r.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Role helpers (for canonical comparisons)
const isOneOfRoles = (user, allowed = []) => {
  const allowedCanon = allowed.map(canonicalize);

  // Quick boolean overrides
  if (user?.is_super_admin || user?.isSuperAdmin) {
    return allowedCanon.includes(canonicalize('Super Admin')) || allowedCanon.includes(canonicalize('Admin'));
  }
  if (user?.is_admin || user?.isAdmin) {
    return allowedCanon.includes(canonicalize('Admin')) || allowedCanon.includes(canonicalize('Department Admin'));
  }

  // Primary role
  const role = getRoleName(user);
  const canon = canonicalize(role);
  if (canon && allowedCanon.includes(canon)) return true;

  // Check arrays of roles on common fields
  const rolesArrays = [
    user?.roles,
    user?.rolesArray,
    user?.roles_list,
    user?.user_metadata?.roles,
    user?.app_metadata?.roles,
  ].filter(Array.isArray);

  for (const arr of rolesArrays) {
    for (const r of arr) {
      const name = typeof r === 'string' ? r : r?.name;
      if (!name) continue;
      if (allowedCanon.includes(canonicalize(name))) return true;
    }
  }

  return false;
};

const ADMIN_ROLES = ['Super Admin', 'Department Admin', 'Admin'];

/**
 * Check if user can access analysis tools
 * Requirement: remove restrictions for everyone except Public User
 */
export const canAccessAnalysisTools = (user) => {
  // Block only explicit Public User; allow all other roles (including Admin, Dept Admin, staff)
  return !isOneOfRoles(user, ['Public User']);
};

/**
 * Check if user can access drawing tools
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user has access to drawing tools
 */
export const canAccessDrawingTools = (user) => !isOneOfRoles(user, ['Public User']);

/**
 * Check if user can access spatial analysis
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user has access to spatial analysis
 */
export const canAccessSpatialAnalysis = (user) => !isOneOfRoles(user, ['Public User']);

/**
 * Check if user is admin level (Super Admin or Department Admin)
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is admin
 */
export const isAdmin = (user) => canAccessAnalysisTools(user);

/**
 * Check if user is department admin
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is department admin
 */
export const isDepartmentAdmin = (user) => isOneOfRoles(user, ['Department Admin']);

/**
 * Check if user is super admin
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is super admin
 */
export const isSuperAdmin = (user) => isOneOfRoles(user, ['Super Admin']);

/**
 * Check if user is a regular user (not admin)
 * @param {Object} user - User object with roles
 * @returns {boolean} - Whether user is regular user
 */
export const isRegularUser = (user) => isOneOfRoles(user, ['Public User', 'User']);

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
