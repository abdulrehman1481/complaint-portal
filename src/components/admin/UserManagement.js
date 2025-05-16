import React, { useState } from 'react';
import { Search, PlusCircle, Edit, Trash2, User, X, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const UserManagement = ({ 
  users, 
  setUsers,
  formatDate, 
  handlePromoteUser,
  departments,
  roles
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionResult, setActionResult] = useState({ type: '', message: '' });
  
  // Form states for add/edit user
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role_id: '',
    department_id: '',
    official_position: ''
  });

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.roles?.name?.toLowerCase().includes(searchLower) ||
      user.departments?.name?.toLowerCase().includes(searchLower)
    );
  });

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setFormData({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone_number: '',
      role_id: roles.find(r => r.name === 'Public User')?.id || '',
      department_id: '',
      official_position: ''
    });
    setShowAddModal(true);
    setActionResult({ type: '', message: '' });
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      role_id: user.role_id || '',
      department_id: user.department_id || '',
      official_position: user.official_position || ''
    });
    setShowEditModal(true);
    setActionResult({ type: '', message: '' });
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  // Handle adding a new user
  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // 1) Capture current admin session
    const { data: { session: adminSession } } = await supabase.auth.getSession();

    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name || !formData.role_id) {
      setActionResult({ 
        type: 'error', 
        message: 'Please fill in all required fields (email, password, first name, last name, and role).' 
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      // Use standard signup flow - no admin API needed
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name
          }
        }
      });
      
      if (signupError) throw signupError;
      
      if (!signupData.user) {
        throw new Error('Failed to create user account');
      }
      
      // 2. Create user profile in users table
      const { error: profileError } = await supabase.from('users').insert({
        id: signupData.user.id,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number || null,
        role_id: formData.role_id,
        department_id: formData.department_id || null,
        official_position: formData.official_position || null
      });
      
      if (profileError) {
        // If we failed to create the profile, clean up by deleting the auth user
        console.error('Failed to create user profile, attempting to clean up auth user');
        // Note: We can't easily delete the auth user from client-side, so we'll just log the error
        throw profileError;
      }
      
      // 3. Fetch the user with related data to add to the state
      const { data: newUser, error: fetchError } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name),
          departments (id, name)
        `)
        .eq('id', signupData.user.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // 4. Update local state
      setUsers(prev => [...prev, newUser]);

      // 5) Restore admin session so we're not switched to the new user
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
      
      setActionResult({ 
        type: 'success', 
        message: `Successfully created user account for ${formData.first_name} ${formData.last_name}.` 
      });
      
      // Reset form after successful addition
      setTimeout(() => {
        setShowAddModal(false);
        // Explicitly reset form data
        setFormData({
          email: '',
          password: '',
          first_name: '',
          last_name: '',
          phone_number: '',
          role_id: roles.find(r => r.name === 'Public User')?.id || '',
          department_id: '',
          official_position: ''
        });
        setActionResult({ type: '', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Error creating user:', error);
      
      // Improved error handling
      let errorMessage = 'Failed to create user. Please try again.';
      
      if (error.message?.includes('already registered')) {
        errorMessage = 'A user with this email already exists.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setActionResult({ 
        type: 'error', 
        message: errorMessage
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle editing an existing user
  const handleEditUser = async (e) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name || !formData.role_id) {
      setActionResult({ 
        type: 'error', 
        message: 'Please fill in all required fields (first name, last name, and role).' 
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      const updates = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        role_id: formData.role_id,
        department_id: formData.department_id || null,
        official_position: formData.official_position || null
      };
      
      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', selectedUser.id);
      
      if (updateError) throw updateError;
      
      // Fetch updated user data with relationships
      const { data: updatedUser, error: fetchError } = await supabase
        .from('users')
        .select(`
          *,
          roles (id, name),
          departments (id, name)
        `)
        .eq('id', selectedUser.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
      
      setActionResult({ 
        type: 'success', 
        message: `Successfully updated user ${updatedUser.first_name} ${updatedUser.last_name}.` 
      });
      
      // Close modal after successful update
      setTimeout(() => {
        setShowEditModal(false);
        setActionResult({ type: '', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Error updating user:', error);
      setActionResult({ 
        type: 'error', 
        message: error.message || 'Failed to update user. Please try again.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle deleting a user
  const handleDeleteUser = async () => {
    try {
      setIsProcessing(true);
      
      // First, disable the auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(
        selectedUser.id,
      );
      
      // Even if there's an auth error, try to delete the user record
      
      // Delete the user record from the users table
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedUser.id);
      
      if (deleteError) throw deleteError;
      
      // Update local state
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      
      setActionResult({ 
        type: 'success', 
        message: 'User successfully deleted.' 
      });
      
      // Close modal after successful deletion
      setTimeout(() => {
        setShowDeleteModal(false);
        setActionResult({ type: '', message: '' });
        setSelectedUser(null);
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting user:', error);
      setActionResult({ 
        type: 'error', 
        message: error.message || 'Failed to delete user. Please try again.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button 
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Add User
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        {user.profile_image ? (
                          <img src={user.profile_image} alt="" className="h-10 w-10 rounded-full" />
                        ) : (
                          <User className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${user.roles?.name === 'Super Admin' ? 'bg-purple-100 text-purple-800' : 
                        user.roles?.name === 'Department Admin' ? 'bg-blue-100 text-blue-800' :
                        user.roles?.name === 'Field Agent' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {user.roles?.name || 'No Role'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.departments?.name || 'None'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handlePromoteUser(user)} 
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Change Role
                    </button>
                    <button 
                      onClick={() => openEditModal(user)}
                      className="text-gray-600 hover:text-gray-900 mr-4"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={() => openDeleteModal(user)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Add New User
                    </h3>
                    
                    <form className="mt-4" onSubmit={handleAddUser}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email *</label>
                          <input
                            type="email"
                            name="email"
                            id="email"
                            value={formData.email}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div className="col-span-2">
                          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password *</label>
                          <input
                            type="password"
                            name="password"
                            id="password"
                            value={formData.password}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name *</label>
                          <input
                            type="text"
                            name="first_name"
                            id="first_name"
                            value={formData.first_name}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name *</label>
                          <input
                            type="text"
                            name="last_name"
                            id="last_name"
                            value={formData.last_name}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">Phone Number</label>
                          <input
                            type="text"
                            name="phone_number"
                            id="phone_number"
                            value={formData.phone_number}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label htmlFor="role_id" className="block text-sm font-medium text-gray-700">Role *</label>
                          <select
                            name="role_id"
                            id="role_id"
                            value={formData.role_id}
                            onChange={handleFormChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            required
                          >
                            <option value="">Select a role</option>
                            {roles.map(role => (
                              <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label htmlFor="department_id" className="block text-sm font-medium text-gray-700">Department</label>
                          <select
                            name="department_id"
                            id="department_id"
                            value={formData.department_id}
                            onChange={handleFormChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="">No department</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label htmlFor="official_position" className="block text-sm font-medium text-gray-700">Official Position</label>
                          <input
                            type="text"
                            name="official_position"
                            id="official_position"
                            value={formData.official_position}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      {actionResult.message && (
                        <div className={`mt-4 p-3 rounded-md ${
                          actionResult.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                          {actionResult.type === 'success' ? 
                            <CheckCircle className="inline-block h-5 w-5 mr-2" /> :
                            <AlertTriangle className="inline-block h-5 w-5 mr-2" />
                          }
                          {actionResult.message}
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <>
                              <Loader className="animate-spin h-4 w-4 mr-2" />
                              Processing...
                            </>
                          ) : 'Add User'}
                        </button>
                        <button
                          type="button"
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                          onClick={() => setShowAddModal(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Edit User: {selectedUser.first_name} {selectedUser.last_name}
                    </h3>
                    
                    <form className="mt-4" onSubmit={handleEditUser}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                          <input
                            type="email"
                            id="email"
                            value={formData.email}
                            disabled
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm"
                          />
                          <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                        </div>

                        <div>
                          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name *</label>
                          <input
                            type="text"
                            name="first_name"
                            id="first_name"
                            value={formData.first_name}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name *</label>
                          <input
                            type="text"
                            name="last_name"
                            id="last_name"
                            value={formData.last_name}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">Phone Number</label>
                          <input
                            type="text"
                            name="phone_number"
                            id="phone_number"
                            value={formData.phone_number}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label htmlFor="role_id" className="block text-sm font-medium text-gray-700">Role *</label>
                          <select
                            name="role_id"
                            id="role_id"
                            value={formData.role_id}
                            onChange={handleFormChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            required
                          >
                            <option value="">Select a role</option>
                            {roles.map(role => (
                              <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label htmlFor="department_id" className="block text-sm font-medium text-gray-700">Department</label>
                          <select
                            name="department_id"
                            id="department_id"
                            value={formData.department_id}
                            onChange={handleFormChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="">No department</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label htmlFor="official_position" className="block text-sm font-medium text-gray-700">Official Position</label>
                          <input
                            type="text"
                            name="official_position"
                            id="official_position"
                            value={formData.official_position}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      {actionResult.message && (
                        <div className={`mt-4 p-3 rounded-md ${
                          actionResult.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                          {actionResult.type === 'success' ? 
                            <CheckCircle className="inline-block h-5 w-5 mr-2" /> :
                            <AlertTriangle className="inline-block h-5 w-5 mr-2" />
                          }
                          {actionResult.message}
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <>
                              <Loader className="animate-spin h-4 w-4 mr-2" />
                              Updating...
                            </>
                          ) : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                          onClick={() => setShowEditModal(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete User
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete {selectedUser.first_name} {selectedUser.last_name}? This action cannot be undone.
                      </p>
                    </div>
                    
                    {actionResult.message && (
                      <div className={`mt-4 p-3 rounded-md ${
                        actionResult.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}>
                        {actionResult.type === 'success' ? 
                          <CheckCircle className="inline-block h-5 w-5 mr-2" /> :
                          <AlertTriangle className="inline-block h-5 w-5 mr-2" />
                        }
                        {actionResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={handleDeleteUser}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                      Deleting...
                    </>
                  ) : 'Delete'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
