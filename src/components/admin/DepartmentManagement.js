import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  PlusCircle, 
  Edit, 
  Trash2, 
  X, 
  Building, 
  CheckCircle, 
  AlertTriangle, 
  Loader,
  Mail,
  MapPin,
  Tag
} from 'lucide-react';

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionResult, setActionResult] = useState({ type: '', message: '' });
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    managed_categories: []
  });

  useEffect(() => {
    fetchDepartments();
    fetchCategories();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // Get associated categories for each department
      const departmentsWithCategories = await Promise.all(
        data.map(async (dept) => {
          const { data: deptCategories, error: catError } = await supabase
            .from('department_categories')
            .select('category_id, categories(id, name, icon)')
            .eq('department_id', dept.id);
          
          if (catError) console.error(`Error fetching categories for department ${dept.id}:`, catError);
          
          return {
            ...dept,
            categories: deptCategories?.map(dc => dc.categories) || []
          };
        })
      );
      
      setDepartments(departmentsWithCategories);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCategoryToggle = (categoryId) => {
    setFormData(prev => {
      const current = [...prev.managed_categories];
      if (current.includes(categoryId)) {
        return { ...prev, managed_categories: current.filter(id => id !== categoryId) };
      } else {
        return { ...prev, managed_categories: [...current, categoryId] };
      }
    });
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      contact_email: '',
      managed_categories: []
    });
    setShowAddModal(true);
    setActionResult({ type: '', message: '' });
  };

  const openEditModal = async (department) => {
    setSelectedDepartment(department);
    
    // Get categories for this department
    const { data: deptCategories, error } = await supabase
      .from('department_categories')
      .select('category_id')
      .eq('department_id', department.id);
    
    if (error) {
      console.error('Error fetching department categories:', error);
    }
    
    const categoryIds = deptCategories ? deptCategories.map(c => c.category_id) : [];
    
    setFormData({
      name: department.name || '',
      contact_email: department.contact_email || '',
      managed_categories: categoryIds
    });
    
    setShowEditModal(true);
    setActionResult({ type: '', message: '' });
  };

  const openDeleteModal = (department) => {
    setSelectedDepartment(department);
    setShowDeleteModal(true);
    setActionResult({ type: '', message: '' });
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      setActionResult({ type: 'error', message: 'Department name is required' });
      return;
    }

    try {
      setIsProcessing(true);
      
      // Insert new department
      const { data: newDept, error } = await supabase
        .from('departments')
        .insert([{
          name: formData.name,
          contact_email: formData.contact_email || null
        }])
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Add category associations if any
      if (formData.managed_categories.length > 0) {
        const categoryAssociations = formData.managed_categories.map(categoryId => ({
          department_id: newDept.id,
          category_id: categoryId
        }));
        
        const { error: catError } = await supabase
          .from('department_categories')
          .insert(categoryAssociations);
        
        if (catError) throw catError;
      }
      
      // Update local state
      await fetchDepartments();
      
      setActionResult({ type: 'success', message: `Department "${formData.name}" created successfully.` });
      
      // Close modal after success
      setTimeout(() => {
        setShowAddModal(false);
        setActionResult({ type: '', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Error adding department:', error);
      setActionResult({ type: 'error', message: error.message || 'Failed to create department' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditDepartment = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      setActionResult({ type: 'error', message: 'Department name is required' });
      return;
    }

    try {
      setIsProcessing(true);
      
      // Update department
      const { error } = await supabase
        .from('departments')
        .update({
          name: formData.name,
          contact_email: formData.contact_email || null
        })
        .eq('id', selectedDepartment.id);
      
      if (error) throw error;
      
      // Update category associations
      // First, delete existing associations
      await supabase
        .from('department_categories')
        .delete()
        .eq('department_id', selectedDepartment.id);
      
      // Then, add new associations
      if (formData.managed_categories.length > 0) {
        const categoryAssociations = formData.managed_categories.map(categoryId => ({
          department_id: selectedDepartment.id,
          category_id: categoryId
        }));
        
        const { error: catError } = await supabase
          .from('department_categories')
          .insert(categoryAssociations);
        
        if (catError) throw catError;
      }
      
      // Update local state
      await fetchDepartments();
      
      setActionResult({ type: 'success', message: `Department "${formData.name}" updated successfully.` });
      
      // Close modal after success
      setTimeout(() => {
        setShowEditModal(false);
        setActionResult({ type: '', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Error updating department:', error);
      setActionResult({ type: 'error', message: error.message || 'Failed to update department' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDepartment = async () => {
    try {
      setIsProcessing(true);
      
      // First delete category associations
      const { error: assocError } = await supabase
        .from('department_categories')
        .delete()
        .eq('department_id', selectedDepartment.id);
      
      if (assocError) throw assocError;
      
      // Then delete the department
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', selectedDepartment.id);
      
      if (error) throw error;
      
      // Update local state
      setDepartments(prev => prev.filter(dept => dept.id !== selectedDepartment.id));
      
      setActionResult({ type: 'success', message: 'Department deleted successfully.' });
      
      // Close modal after success
      setTimeout(() => {
        setShowDeleteModal(false);
        setSelectedDepartment(null);
        setActionResult({ type: '', message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting department:', error);
      
      // Special handling for foreign key constraint violations (department has users assigned)
      if (error.code === '23503') { // Foreign key violation in PostgreSQL
        setActionResult({ 
          type: 'error', 
          message: 'Cannot delete department because it has users or complaints assigned to it. Reassign them first.'
        });
      } else {
        setActionResult({ type: 'error', message: error.message || 'Failed to delete department' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter departments by search term
  const filteredDepartments = departments.filter(dept => 
    dept.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          />
        </div>
        <button 
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Add Department
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <Loader className="h-10 w-10 text-indigo-500 animate-spin mx-auto" />
          <p className="mt-2 text-gray-500">Loading departments...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDepartments.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white rounded-lg shadow">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900">No departments found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm ? 'Try a different search term' : 'Create your first department to get started'}
              </p>
              {!searchTerm && (
                <button
                  onClick={openAddModal}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Add Department
                </button>
              )}
            </div>
          ) : (
            filteredDepartments.map(dept => (
              <div key={dept.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{dept.name}</h3>
                      {dept.contact_email && (
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <Mail className="h-4 w-4 mr-1" />
                          <a href={`mailto:${dept.contact_email}`} className="hover:text-indigo-600">
                            {dept.contact_email}
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(dept)}
                        className="p-1 rounded-full text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100"
                        title="Edit Department"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(dept)}
                        className="p-1 rounded-full text-red-600 hover:text-red-800 hover:bg-red-100"
                        title="Delete Department"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Tag className="h-4 w-4 mr-1" />
                    Managed Categories ({dept.categories?.length || 0})
                  </h4>
                  {dept.categories && dept.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dept.categories.map(category => (
                        <span key={category.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {category.icon || '📋'} {category.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No categories assigned</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Department Modal */}
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
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Building className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Add New Department
                    </h3>
                    
                    <form className="mt-4" onSubmit={handleAddDepartment}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Department Name *</label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">Contact Email</label>
                          <input
                            type="email"
                            name="contact_email"
                            id="contact_email"
                            value={formData.contact_email}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Categories</label>
                          <div className="border border-gray-300 rounded-md p-3 h-60 overflow-y-auto">
                            {categories.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No categories available</p>
                            ) : (
                              <div className="space-y-2">
                                {categories.map(category => (
                                  <div key={category.id} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      id={`category-${category.id}`}
                                      checked={formData.managed_categories.includes(category.id)}
                                      onChange={() => handleCategoryToggle(category.id)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor={`category-${category.id}`} className="ml-2 block text-sm text-gray-900">
                                      {category.icon || '📋'} {category.name}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Select categories that this department will manage
                          </p>
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
                          ) : 'Add Department'}
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

      {/* Edit Department Modal */}
      {showEditModal && selectedDepartment && (
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
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Building className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Edit Department
                    </h3>
                    
                    <form className="mt-4" onSubmit={handleEditDepartment}>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Department Name *</label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">Contact Email</label>
                          <input
                            type="email"
                            name="contact_email"
                            id="contact_email"
                            value={formData.contact_email}
                            onChange={handleFormChange}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Categories</label>
                          <div className="border border-gray-300 rounded-md p-3 h-60 overflow-y-auto">
                            {categories.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No categories available</p>
                            ) : (
                              <div className="space-y-2">
                                {categories.map(category => (
                                  <div key={category.id} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      id={`edit-category-${category.id}`}
                                      checked={formData.managed_categories.includes(category.id)}
                                      onChange={() => handleCategoryToggle(category.id)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor={`edit-category-${category.id}`} className="ml-2 block text-sm text-gray-900">
                                      {category.icon || '📋'} {category.name}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Select categories that this department will manage
                          </p>
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
                              Saving...
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedDepartment && (
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
                      Delete Department
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete the department "{selectedDepartment.name}"? This action cannot be undone.
                      </p>
                      <p className="mt-1 text-sm text-red-500">
                        Warning: Any users or complaints assigned to this department may be affected.
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
                  onClick={handleDeleteDepartment}
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

export default DepartmentManagement;
