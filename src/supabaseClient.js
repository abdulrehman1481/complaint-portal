import { createClient } from '@supabase/supabase-js'

// Get these from your new project in the Supabase dashboard
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const ensureUserExists = async (userId, userData = {}) => {
    if (!userId) return null;
    
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (existingUser) {
        // User exists
        return existingUser;
      }
      
      // Get default public user role
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'Public User')
        .single();
        
      // User doesn't exist, create a new record
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          role_id: roleData?.id || 4, // Default to Public User role
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          phone_number: userData.phone_number || '',
          address: userData.address || '',
          last_active: new Date().toISOString()
        })
        .select();
      
      if (error) throw error;
      return user[0];
    } catch (error) {
      console.error('Error ensuring user exists:', error);
      return null;
    }
  };