import { supabase } from '../supabaseClient';

/**
 * Create a user profile if it doesn't exist
 * @param {Object} userData - User data from auth
 * @returns {Promise<Object>} - Created or existing user data
 */
export const ensureUserProfile = async (userData) => {
  if (!userData || !userData.id) {
    throw new Error('No user data provided');
  }

  try {
    // Check if user profile exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userData.id)
      .single();
    
    if (!fetchError && existingUser) {
      return existingUser;
    }

    // If user doesn't exist in the database, create a profile
    // Get the default Public User role ID
    const { data: roleData } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Public User')
      .single();
    
    const roleId = roleData ? roleData.id : 4; // Default to 4 if not found
    
    // Extract name from email if available
    let firstName = 'User';
    let lastName = '';
    if (userData.email) {
      const emailName = userData.email.split('@')[0];
      const nameParts = emailName.split('.');
      if (nameParts.length > 1) {
        firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
        lastName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);
      } else {
        firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      }
    }
    
    // Create user profile
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        { 
          id: userData.id,
          first_name: firstName,
          last_name: lastName,
          email: userData.email,
          role_id: roleId
        }
      ])
      .select()
      .single();
    
    if (createError) {
      throw createError;
    }
    
    return newUser;
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    throw error;
  }
};

/**
 * Get user with role information
 * @returns {Promise<Object>} User data with role
 */
export const getUserWithRole = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }
    
    // Try to get user profile with role
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select(`
          *,
          roles:role_id(id, name, permissions)
        `)
        .eq('id', user.id)
        .single();
      
      if (error) {
        // If error, try to create the profile
        const createdProfile = await ensureUserProfile(user);
        return { ...user, ...createdProfile, role: 'Public User' };
      }
      
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { ...user, role: 'Public User' }; // Default role
    }
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
};
