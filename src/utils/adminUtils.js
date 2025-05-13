/**
 * Check for admin invitation code in URL parameters
 * and store it in localStorage if found
 */
export const checkForInvitationInURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const adminInviteCode = urlParams.get('admin_invite');
  
  if (adminInviteCode) {
    localStorage.setItem('adminInviteCode', adminInviteCode);
    // Remove the parameter from URL for cleaner appearance
    const newUrl = window.location.pathname + 
      window.location.search.replace(/([&?])admin_invite=[^&]+(&|$)/g, '$1').replace(/[?&]$/,'');
    window.history.replaceState({}, document.title, newUrl);
  }

  return !!adminInviteCode;
};

/**
 * Validate an admin invitation code against the database
 * @param {string} code - The invitation code to validate
 * @returns {Promise<boolean>} - Whether the code is valid
 */
export const validateInvitationCode = async (supabaseClient, code) => {
  try {
    // TEMPORARY BOOTSTRAP CODE: Always return true to allow creating the first admin
    // IMPORTANT: Remove this after creating the first admin!
    return true;
  } catch (error) {
    console.error('Error validating invitation code:', error);
  }
  return false;
};

/**
 * Utility functions for admin-related tasks
 */

/**
 * Checks if a user has the required permission
 * @param {Object} user - The user object containing role information
 * @param {String} permission - The permission to check for
 * @returns {Boolean} - Whether the user has the specified permission
 */
export const hasPermission = (user, permission) => {
  if (!user || !user.roles || !user.roles.permissions) {
    return false;
  }
  
  // Super Admin has all permissions
  if (user.roles.name === 'Super Admin') {
    return true;
  }
  
  // Check if the permission is in the user's permissions array
  const permissions = Array.isArray(user.roles.permissions) 
    ? user.roles.permissions 
    : user.roles.permissions?.split(',') || [];
  
  return permissions.includes(permission);
};

/**
 * Check if user is an admin (Super Admin or Department Admin)
 * @param {Object} user - The user object
 * @returns {Boolean} - Whether the user is an admin
 */
export const isAdmin = (user) => {
  if (!user || !user.roles) return false;
  
  return user.roles.name === 'Super Admin' || user.roles.name === 'Department Admin';
};

/**
 * Format a date string in a user-friendly format
 * @param {String} dateString - ISO date string
 * @returns {String} - Formatted date
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};
