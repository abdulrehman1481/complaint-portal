import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Menu, Map, AlertTriangle, User, Mail, Lock, Eye, EyeOff, ChevronRight, MapPin, BarChart2, Filter, Calendar, Clock, Image, Route, Facebook, Twitter, Instagram, Github, Linkedin } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { redirectToDashboard } from '../utils/roleBasedRouting';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Fix for default markers in Leaflet in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Main App Component
export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();
  const heroMapRef = useRef(null);
  const heroMapInstance = useRef(null);

  // Form state for login
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  // Form state for signup
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Redirect to appropriate dashboard based on role
        await redirectToDashboard(navigate);
      }
    };
    checkUser();
  }, [navigate]);

  // Initialize simple Leaflet map on hero
  useEffect(() => {
    if (!heroMapRef.current) return;
    if (heroMapInstance.current) return;
    try {
      const map = L.map(heroMapRef.current, { zoomControl: false }).setView([33.6844, 73.0479], 11); // Islamabad
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      // Add a couple of example markers for Pakistani cities
      const cities = [
        { name: 'Islamabad', lat: 33.6844, lng: 73.0479 },
        { name: 'Rawalpindi', lat: 33.5651, lng: 73.0169 },
        { name: 'Lahore', lat: 31.5204, lng: 74.3587 },
      ];
      cities.forEach(c => L.marker([c.lat, c.lng]).addTo(map).bindPopup(`<strong>${c.name}</strong>`));
      heroMapInstance.current = map;
    } catch (e) {
      console.warn('Map init failed:', e);
    }
    return () => {
      if (heroMapInstance.current) {
        heroMapInstance.current.remove();
        heroMapInstance.current = null;
      }
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleLogin = () => {
    setIsLoginOpen(!isLoginOpen);
    setIsSignupOpen(false);
    setAuthError(null);
  };

  const toggleSignup = () => {
    setIsSignupOpen(!isSignupOpen);
    setIsLoginOpen(false);
    setAuthError(null);
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  // Handle login form input changes
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle signup form input changes
  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle login form submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) throw error;
      
      // Redirect to appropriate dashboard based on role
      await redirectToDashboard(navigate);
    } catch (error) {
      console.error('Error logging in:', error);
      setAuthError(error.message || 'Failed to log in. Please check your credentials.');
    }
  };

  // Handle signup form submission
  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError(null);

    // Validate passwords match
    if (signupForm.password !== signupForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    try {
      // Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
      });

      if (authError) throw authError;

      // Create user profile in users table
      if (authData.user) {
        // Get the default Public User role ID (typically 4 based on your schema)
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'Public User')
          .single();
        
        const roleId = roleData ? roleData.id : 4; // Default to 4 if not found
        
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            { 
              id: authData.user.id,
              first_name: signupForm.firstName,
              last_name: signupForm.lastName,
              email: signupForm.email,
              phone_number: signupForm.phone || null,
              role_id: roleId, // Public User role
            }
          ]);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          // Continue anyway since the auth user was created
        }
      }

      // Show success message or redirect
      alert('Registration successful! Please check your email for verification.');
      toggleSignup();
    } catch (error) {
      console.error('Error signing up:', error);
      setAuthError(error.message || 'Failed to create an account. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navigation Bar */}
  <nav className="bg-green-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Map className="h-8 w-8 mr-2" />
              <span className="font-bold text-xl">CivicMapTrack</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <a href="#features" className="px-3 py-2 rounded-md hover:bg-green-600 transition-colors">Features</a>
              <a href="#how-it-works" className="px-3 py-2 rounded-md hover:bg-green-600 transition-colors">How It Works</a>
              <a href="#about" className="px-3 py-2 rounded-md hover:bg-green-600 transition-colors">About</a>
              <button 
                onClick={toggleLogin}
                className="px-4 py-2 rounded-md bg-white text-green-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Login
              </button>
              <button 
                onClick={toggleSignup}
                className="px-4 py-2 rounded-md bg-green-500 text-white font-medium hover:bg-green-600 transition-colors"
              >
                Sign Up
              </button>
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button 
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md hover:bg-green-600 focus:outline-none"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a href="#features" className="block px-3 py-2 rounded-md hover:bg-green-600 transition-colors">Features</a>
              <a href="#how-it-works" className="block px-3 py-2 rounded-md hover:bg-green-600 transition-colors">How It Works</a>
              <a href="#about" className="block px-3 py-2 rounded-md hover:bg-green-600 transition-colors">About</a>
              <button 
                onClick={toggleLogin}
                className="w-full text-left px-3 py-2 rounded-md bg-white text-green-700 font-medium hover:bg-gray-100 transition-colors mt-2"
              >
                Login
              </button>
              <button 
                onClick={toggleSignup}
                className="w-full text-left px-3 py-2 rounded-md bg-green-500 text-white font-medium hover:bg-green-600 transition-colors mt-2"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Modal for Login */}
      {isLoginOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button 
              onClick={toggleLogin}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Welcome Back</h2>
              <p className="text-gray-600 mt-1">Log in to your CivicMapTrack account</p>
            </div>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  {authError}
                </p>
              </div>
            )}
            
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                
                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    Forgot your password?
                  </a>
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Sign in
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={() => {
                    toggleLogin();
                    toggleSignup();
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Sign Up */}
      {isSignupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button 
              onClick={toggleSignup}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Create Account</h2>
              <p className="text-gray-600 mt-1">Join CivicMapTrack to report and track community issues</p>
            </div>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  {authError}
                </p>
              </div>
            )}
            
            <form className="space-y-4" onSubmit={handleSignup}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    id="first-name"
                    name="firstName"
                    type="text"
                    value={signupForm.firstName}
                    onChange={handleSignupChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    id="last-name"
                    name="lastName"
                    type="text"
                    value={signupForm.lastName}
                    onChange={handleSignupChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Doe"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="phone-number" className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                <input
                  id="phone-number"
                  name="phone"
                  type="tel"
                  value={signupForm.phone}
                  onChange={handleSignupChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="signup-password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    value={signupForm.password}
                    onChange={handleSignupChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
              </div>
              
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={passwordVisible ? "text" : "password"}
                    value={signupForm.confirmPassword}
                    onChange={handleSignupChange}
                    required
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
                  I agree to the{' '}
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    Terms of Service
                  </a>
                  {' '}and{' '}
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    Privacy Policy
                  </a>
                </label>
              </div>
              
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Create Account
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button 
                  onClick={() => {
                    toggleSignup();
                    toggleLogin();
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Log in
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-green-700 text-white pt-16 pb-24 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-2">
                Pakistan CivicMapTrack
              </h1>
              <p className="text-sm uppercase tracking-wide text-green-200 mb-1 font-medium">By Abdul Rehman</p>
              <p className="text-xs text-green-300 mb-4 italic">آپ کی شکایت، ہماری ذمہ داری</p>
              <p className="text-lg md:text-xl mb-3 text-green-100 max-w-lg leading-relaxed">
                A GIS-powered civic platform that connects citizens with local authorities — making it effortless to report potholes, sewage leaks, power outages, and more.
              </p>
              <p className="text-base mb-8 text-green-200 max-w-lg">
                آپ کی آواز کو طاقت دیں — نقشے پر مسئلہ رپورٹ کریں، حل تک ٹریک کریں۔
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={toggleSignup}
                  className="px-6 py-3 bg-white text-green-700 font-medium rounded-md shadow-lg hover:bg-gray-100 transition-colors"
                >
                  Get Started
                </button>
                <a 
                  href="#how-it-works"
                  className="px-6 py-3 border border-white text-white font-medium rounded-md hover:bg-green-600 transition-colors text-center"
                >
                  Learn More
                </a>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative">
                <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                  <div className="h-64">
                    <div ref={heroMapRef} className="w-full h-full" />
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 bg-green-600 rounded-lg shadow-lg p-4 max-w-xs">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-white">Report Issues Easily</h3>
                      <p className="text-sm text-green-100">Click on the map, fill a simple form, and your complaint is submitted.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Powerful GIS Features</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines modern mapping technology with easy-to-use tools for effective community problem tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Map Visualization</h3>
              <p className="text-gray-600">
                Interactive map with complaint markers using type-specific icons for easy identification.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Filter className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Advanced Filtering</h3>
              <p className="text-gray-600">
                Filter by complaint type, status, and date range to focus on issues that matter to you.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <BarChart2 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Analytics Dashboard</h3>
              <p className="text-gray-600">
                Visualize complaint statistics with dynamic counters and spatial clustering analysis.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Image className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Image Upload</h3>
              <p className="text-gray-600">
                Add photos to your complaints for visual evidence and better issue documentation.
              </p>
            </div>
            
            {/* Feature 5 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Route className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Routing</h3>
              <p className="text-gray-600">
                Get directions to complaint locations with integrated routing functionality.
              </p>
            </div>
            
            {/* Feature 6 */}
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Temporal Analysis</h3>
              <p className="text-gray-600">
                View complaints over time with date filtering and trend analysis features.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Making community improvement simple and effective in just a few steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow h-full">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  1
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Report an Issue</h3>
                  <p className="text-gray-600">
                    Click on the map where the problem is located, select the issue type, and fill out a simple form. Add photos if needed.
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2">
                <ChevronRight className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="relative">
              <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow h-full">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  2
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Track Progress</h3>
                  <p className="text-gray-600">
                    Monitor the status of your reported issues and receive updates as they are addressed by local authorities.
                  </p>
                </div>
              </div>
              <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2">
                <ChevronRight className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            {/* Step 3 */}
            <div>
              <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 hover:shadow-lg transition-shadow h-full">
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                  3
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Problem Resolved</h3>
                  <p className="text-gray-600">
                    Once the issue is fixed, the complaint status is updated, and community data is improved for future planning.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
  <div className="bg-green-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-green-800 rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-12 md:p-12 text-center md:text-left md:flex items-center">
              <div className="md:w-2/3 mb-8 md:mb-0">
                <h2 className="text-3xl font-bold text-white mb-4">Ready to improve your community?</h2>
        <p className="text-xl text-green-100">
                  Join thousands of citizens who are making a difference every day.
                </p>
              </div>
              <div className="md:w-1/3 md:text-right">
                <button
                  onClick={toggleSignup}
                  className="px-8 py-4 bg-white text-green-700 font-medium rounded-md shadow-lg hover:bg-gray-100 transition-colors text-lg"
                >
                  Sign Up Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">About CivicMapTrack</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Empowering communities through geospatial technology and civic engagement.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0 md:pr-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-1">Our Mission</h3>
              <p className="text-sm text-green-600 font-medium mb-4 italic">ہمارا مقصد — عوام کی خدمت</p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                CivicMapTrack was born out of a simple idea: every citizen deserves to be heard. Whether it's a broken street light in your neighbourhood, a flooded road after rain, or an overflowing drain — your complaint matters and deserves a real response.
              </p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Built by <strong className="text-gray-800">Abdul Rehman</strong>, this platform harnesses the power of Geographic Information Systems (GIS) to put civic issues on the map — literally. Real-time data visualisation helps authorities prioritise and resolve problems faster than ever.
              </p>
              <p className="text-gray-600 mb-5 leading-relaxed">
                ہم یقین رکھتے ہیں کہ ٹیکنالوجی سے شہریوں اور حکومت کے درمیان فاصلہ کم ہو سکتا ہے۔ یہ پلیٹ فارم اسی سوچ کا نتیجہ ہے۔
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:abdulrehman10abd@gmail.com"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-medium hover:bg-green-100 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  abdulrehman10abd@gmail.com
                </a>
                <a
                  href="https://www.linkedin.com/in/abdul-rehman1481"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn Profile
                </a>
                <a
                  href="tel:+923059601481"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  📞 0305-9601481
                </a>
              </div>
            </div>
            <div className="md:w-1/2">
              <img src="/api/placeholder/600/400" alt="Team working on maps" className="rounded-lg shadow-md w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
  <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Map className="h-6 w-6 mr-2" />
        <span className="font-bold text-lg">CivicMapTrack Pakistan</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
        Behtari ke liye aap ki awaz — geospatial complaint tracking aur transparent issue resolution ke sath.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="https://www.linkedin.com/in/abdul-rehman1481" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Home</a></li>
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#about" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-lg mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">FAQs</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Community Forum</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            
      <div>
              <h3 className="font-semibold text-lg mb-4">Contact Us — ہم سے رابطہ کریں</h3>
              <address className="not-italic text-gray-400 space-y-2">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <a href="mailto:abdulrehman10abd@gmail.com" className="hover:text-white transition-colors">abdulrehman10abd@gmail.com</a>
                </p>
                <p className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <a href="tel:+923059601481" className="hover:text-white transition-colors">0305-9601481</a>
                </p>
                <p className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <a href="https://www.linkedin.com/in/abdul-rehman1481" target="_blank" rel="noopener noreferrer" className="hover:text-blue-300 transition-colors">linkedin.com/in/abdul-rehman1481</a>
                </p>
              </address>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; {new Date().getFullYear()} CivicMapTrack Pakistan. All rights reserved.</p>
            <p className="mt-2">
              Designed & Developed with ❤️ by{' '}
              <a
                href="https://www.linkedin.com/in/abdul-rehman1481"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 font-medium transition-colors"
              >
                Abdul Rehman
              </a>
              {' '}— شہریوں کی آواز، بہتری کا راستہ
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}