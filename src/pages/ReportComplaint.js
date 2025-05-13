import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import $ from 'jquery'; // Import jQuery
import { toWKT } from '../utils/locationFormatter';
import { 
  Map, 
  AlertTriangle, 
  Camera, 
  MapPin, 
  ChevronLeft, 
  Send, 
  ChevronDown,
  X,
  Upload,
  CheckCircle,
  Loader
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJyZWhtYW4xMTIyIiwiYSI6ImNtNHlrY3Q2cTBuYmsyaXIweDZrZG9yZnoifQ.FkDynV0HksdN7ICBxt2uPg';

const ReportComplaint = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const fileInputRef = useRef(null);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    location: { latitude: null, longitude: null },
    address: '',
    anonymous: false,
    images: []
  });
  
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    const fetchUserAndCategories = async () => {
      setLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/');
          return;
        }
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (userError) throw userError;
        setUser(userData);
        
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name, icon, severity_level')
          .eq('is_active', true)
          .order('name');
          
        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);
        
        const storedLocation = localStorage.getItem('reportLocation');
        if (storedLocation) {
          try {
            const locationObj = JSON.parse(storedLocation);
            if (locationObj.lat && locationObj.lng) {
              setFormData(prev => ({
                ...prev,
                location: {
                  latitude: locationObj.lat,
                  longitude: locationObj.lng
                },
                address: `Lat: ${locationObj.lat.toFixed(6)}, Lng: ${locationObj.lng.toFixed(6)}`
              }));
            }
          } catch (e) {
            console.error('Error parsing stored location:', e);
          }
          localStorage.removeItem('reportLocation');
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load necessary data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserAndCategories();
    
    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [navigate]);

  useEffect(() => {
    if (!loading && !mapInitialized && mapContainer.current) {
      initializeMap();
      setMapInitialized(true);
    }
  }, [loading, mapInitialized]);

  const initializeMap = () => {
    if (map.current || !mapContainer.current) return;
    
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      const $container = $(mapContainer.current);
      if ($container.length === 0) {
        console.error('Map container not found in the DOM');
        return;
      }
      
      if ($container.width() === 0 || $container.height() === 0) {
        console.warn('Map container has zero width or height');
      }
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [formData.location.longitude || -74.0060, formData.location.latitude || 40.7128],
        zoom: formData.location.longitude ? 15 : 10
      });
      
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true
      });
      
      map.current.addControl(geolocateControl, 'top-right');
      
      if (formData.location.latitude && formData.location.longitude) {
        marker.current = new mapboxgl.Marker({ draggable: true })
          .setLngLat([formData.location.longitude, formData.location.latitude])
          .addTo(map.current);
        
        marker.current.on('dragend', () => {
          const lngLat = marker.current.getLngLat();
          updateLocation(lngLat.lat, lngLat.lng);
        });
      }
      
      map.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        
        if (!marker.current) {
          marker.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([lng, lat])
            .addTo(map.current);
          
          marker.current.on('dragend', () => {
            const lngLat = marker.current.getLngLat();
            updateLocation(lngLat.lat, lngLat.lng);
          });
        } else {
          marker.current.setLngLat([lng, lat]);
        }
        
        updateLocation(lat, lng);
      });
      
      map.current.on('load', () => {
        if (!formData.location.latitude || !formData.location.longitude) {
          setTimeout(() => {
            try {
              geolocateControl.trigger();
            } catch (e) {
              console.error('Error triggering geolocate:', e);
            }
          }, 1000);
        }
      });
      
      geolocateControl.on('geolocate', (e) => {
        try {
          const lat = e.coords.latitude;
          const lng = e.coords.longitude;
          
          if (!marker.current) {
            marker.current = new mapboxgl.Marker({ draggable: true })
              .setLngLat([lng, lat])
              .addTo(map.current);
            
            marker.current.on('dragend', () => {
              const lngLat = marker.current.getLngLat();
              updateLocation(lngLat.lat, lngLat.lng);
            });
          } else {
            marker.current.setLngLat([lng, lat]);
          }
          
          updateLocation(lat, lng);
        } catch (error) {
          console.error('Error handling geolocate event:', error);
        }
      });
      
      console.log("Map initialized successfully");
    } catch (error) {
      console.error("Error initializing map:", error);
      setError("Failed to initialize map. Please refresh the page and try again.");
    }
  };

  const updateLocation = (lat, lng) => {
    setFormData(prev => ({
      ...prev,
      location: {
        latitude: lat,
        longitude: lng
      },
      address: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`
    }));
    
    $('#address').addClass('bg-blue-50').delay(500).queue(function(next) {
      $(this).removeClass('bg-blue-50');
      next();
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 5) {
      setError('You can upload a maximum of 5 images');
      return;
    }
    
    const totalImages = formData.images.length + files.length;
    
    if (totalImages > 5) {
      setError(`You can upload a maximum of 5 images. You've already selected ${formData.images.length}.`);
      return;
    }
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, { file, preview: e.target.result }]);
      };
      reader.readAsDataURL(file);
    });
    
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...files]
    }));
    
    $('.upload-area').fadeOut(100).fadeIn(100);
  };

  const removeImage = (index) => {
    $(`#preview-${index}`).fadeOut(300, function() {
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    });
  };

  const uploadImageToStorage = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `complaints/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('complaint-images')
      .upload(filePath, file);
      
    if (uploadError) {
      throw uploadError;
    }
    
    return filePath;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Please provide a title for your complaint');
      $('#title').addClass('border-red-500').focus();
      setTimeout(() => $('#title').removeClass('border-red-500'), 3000);
      return;
    }
    
    if (!formData.category_id) {
      setError('Please select a category');
      $('#category_id').addClass('border-red-500').focus();
      setTimeout(() => $('#category_id').removeClass('border-red-500'), 3000);
      return;
    }
    
    if (!formData.location.latitude || !formData.location.longitude) {
      setError('Please select a location on the map');
      $('.map-container').addClass('border-red-500');
      setTimeout(() => $('.map-container').removeClass('border-red-500'), 3000);
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const imageUrls = [];
      
      if (formData.images.length > 0) {
        for (const file of formData.images) {
          const filePath = await uploadImageToStorage(file);
          imageUrls.push(filePath);
        }
      }
      
      // For PostGIS geography(Point, 4326), we need to use the text representation
      // PostGIS can parse WKT directly, so we create it using the correct format
      // Note: For geography type, it's important to use the format "SRID=4326;POINT(lon lat)"
      const wktLocation = `SRID=4326;POINT(${formData.location.longitude} ${formData.location.latitude})`;
      
      const complaintData = {
        title: formData.title,
        description: formData.description,
        category_id: parseInt(formData.category_id),
        location: wktLocation, // Send as WKT string with SRID
        reported_by: formData.anonymous ? null : user.id,
        anonymous: formData.anonymous,
        images: imageUrls,
        status: 'open'
      };
      
      console.log('Submitting complaint with data:', complaintData);
      
      const { data, error } = await supabase
        .from('complaints')
        .insert([complaintData])
        .select();
        
      if (error) throw error;
      
      setSuccess(true);
      
      $('.complaint-form').fadeOut(500);
      $('.success-message').hide().fadeIn(500);
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting complaint:', error);
      // Include more error details for debugging
      setError(`Failed to submit your complaint: ${error.message || 'Unknown error'}${error.hint ? ` - ${error.hint}` : ''}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCenterOnUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 15
            });
            
            if (!marker.current) {
              marker.current = new mapboxgl.Marker({ draggable: true })
                .setLngLat([longitude, latitude])
                .addTo(map.current);
              
              marker.current.on('dragend', () => {
                const lngLat = marker.current.getLngLat();
                updateLocation(lngLat.lat, lngLat.lng);
              });
            } else {
              marker.current.setLngLat([longitude, latitude]);
            }
            
            updateLocation(latitude, longitude);
            
            $('.location-button').addClass('animate-pulse');
            setTimeout(() => $('.location-button').removeClass('animate-pulse'), 1000);
          }
        },
        (err) => {
          console.warn('Error getting location:', err);
          setError('Unable to access your location. Please check your browser permissions.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center success-message">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Complaint Submitted!</h2>
          <p className="mt-2 text-gray-600">
            Thank you for reporting this issue. Your complaint has been recorded and will be reviewed by our team.
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden complaint-form">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <AlertTriangle className="h-6 w-6 mr-2 text-blue-500" />
              Report Community Issue
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Provide details about the issue you're reporting to help us address it efficiently.
            </p>
          </div>

          {error && (
            <div className="m-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-start error-message">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Complaint Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="E.g., Broken Street Light on Main St"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="category_id"
                    name="category_id"
                    required
                    value={formData.category_id}
                    onChange={handleChange}
                    className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none"
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name} {category.severity_level ? `(Priority ${category.severity_level})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <input
                    type="text"
                    id="address"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Select on map or enter address"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCenterOnUserLocation}
                    className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-700 rounded-r-md hover:bg-gray-100 location-button"
                    title="Use my current location"
                  >
                    <MapPin className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Provide detailed information about the issue..."
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Images (Optional, max 5)
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md upload-area">
                  <div className="space-y-1 text-center">
                    <Camera className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                      >
                        <span>Upload images</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          multiple
                          accept="image/*"
                          className="sr-only"
                          ref={fileInputRef}
                          onChange={handleImageUpload}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB each</p>
                  </div>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                    {imagePreviews.map((image, index) => (
                      <div key={index} className="relative" id={`preview-${index}`}>
                        <img 
                          src={image.preview} 
                          alt={`Preview ${index}`} 
                          className="h-24 w-full object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center">
                  <input
                    id="anonymous"
                    name="anonymous"
                    type="checkbox"
                    checked={formData.anonymous}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="anonymous" className="ml-2 text-sm text-gray-700">
                    Submit anonymously (your identity will not be visible to the public)
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="bg-gray-200 h-64 rounded-lg mb-4 relative map-container">
                <div ref={mapContainer} className="absolute inset-0 rounded-lg" style={{width: '100%', height: '100%'}} />
                <button
                  type="button"
                  onClick={handleCenterOnUserLocation}
                  className="absolute bottom-4 right-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 location-button"
                  title="Use my current location"
                >
                  <MapPin className="h-5 w-5 text-blue-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 italic">
                Click on the map to set the exact location of the issue or drag the marker to adjust
              </p>
            </div>

            <div className="mt-6 flex items-center">
              <div className="flex-1 flex items-center">
                <Upload className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-gray-500 text-sm">All information will be submitted to the relevant department</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Complaint
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportComplaint;
