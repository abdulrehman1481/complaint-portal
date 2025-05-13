import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, ArrowLeft, Mail, User, Lock, Eye, EyeOff } from 'lucide-react';
import { validateInvitationCode } from '../utils/adminUtils';

const AdminCreationPage = () => {
  const [isValidInvitation, setIsValidInvitation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: ''
  });

  // Departments state
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const checkInviteCode = async () => {
      setIsLoading(true);
      
      // Check if we have an invitation code in localStorage
      const storedCode = localStorage.getItem('adminInviteCode');
      
      if (storedCode) {
        setInvitationCode(storedCode);
        const isValid = await validateInvitationCode(supabase, storedCode);
        setIsValidInvitation(isValid);
        
        // If invalid, clear it from storage
        if (!isValid) {
          localStorage.removeItem('adminInviteCode');
        } else {
          // Fetch departments for the dropdown
          fetchDepartments();
        }
      }
      
      setIsLoading(false);
    };
    
    checkInviteCode();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const validateForm = () => {
    // Reset error
    setError(null);
    
    // Check required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('All fields are required');
      return false;
    }
    
    // Check password match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    // Check password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setFormSubmitting(true);
    setError(null);
    
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        }
      });
      
      if (authError) throw authError;
      
      if (authData.user) {
        // Get the admin role ID
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'Department Admin')
          .single();
          
        const roleId = roleData?.id || 2; // Default to role ID 2 (Department Admin) if not found
        
        // Create user profile with admin role
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              role_id: roleId,
              department_id: formData.department ? parseInt(formData.department) : null
            }
          ]);
          
        if (profileError) throw profileError;
        
        // Clear invitation code from storage
        localStorage.removeItem('adminInviteCode');
        
        // Show success and redirect
        alert('Admin account created successfully! Please check your email for verification.');
        navigate('/');
      }
    } catch (error) {
      console.error('Error creating admin account:', error);
      setError(error.message || 'Failed to create admin account');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    
    if (!invitationCode) {
      setError('Please enter an invitation code');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const isValid = await validateInvitationCode(supabase, invitationCode);
      setIsValidInvitation(isValid);
      
      if (isValid) {
        // Store valid code and fetch departments
        localStorage.setItem('adminInviteCode', invitationCode);
        fetchDepartments();
      } else {
        setError('Invalid invitation code');
      }
    } catch (error) {
      console.error('Error validating invitation code:', error);
      setError('Failed to validate invitation code');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">Admin Account Creation</h2>
            <p className="mt-2 text-sm text-gray-600">
              Set up your administrator account for CivicMapTrack
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isValidInvitation ? (
            // Invitation code form
            <form onSubmit={handleCodeSubmit} className="mt-6">
              <div className="mb-4">
                <label htmlFor="invitationCode" className="block text-sm font-medium text-gray-700">
                  Admin Invitation Code
                </label>
                <input
                  id="invitationCode"
                  name="invitationCode"
                  type="text"
                  required
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your invitation code"
                />
              </div>
              
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex items-center text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Home
                </button>
                
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Validate Code
                </button>
              </div>
            </form>
          ) : (
            // Admin account creation form
            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department (Optional)
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters long</p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    id="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                  I agree to the{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-500">
                    Terms and Conditions
                  </a>
                </label>
              </div>
              
              <div>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {formSubmitting ? 'Creating Account...' : 'Create Admin Account'}
                </button>
              </div>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Return to login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCreationPage;
