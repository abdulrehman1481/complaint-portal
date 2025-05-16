// Import statements
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJyZWhtYW4xMTIyIiwiYSI6ImNtNHlrY3Q2cTBuYmsyaXIweDZrZG9yZnoifQ.FkDynV0HksdN7ICBxt2uPg';

/**
 * Get the nearest place/address for a set of coordinates
 * Uses Mapbox Reverse Geocoding API
 * 
 * @param {number} longitude - The longitude coordinate
 * @param {number} latitude - The latitude coordinate
 * @returns {Promise<string>} - A promise that resolves to a location name
 */
export const getNearestLocation = async (longitude, latitude) => {
  try {
    // Validate coordinates
    if (!longitude || !latitude || isNaN(longitude) || isNaN(latitude)) {
      return 'Unknown location';
    }
    
    // Call Mapbox Reverse Geocoding API
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=address,neighborhood,locality,place&limit=1`
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the place name and address
    if (data.features && data.features.length > 0) {
      // Return the place name or formatted address
      return data.features[0].place_name;
    }
    
    return 'Location name unavailable';
  } catch (error) {
    console.error('Error getting location name:', error);
    return 'Error retrieving location';
  }
};

/**
 * Cache for storing location names to avoid repeated API calls
 */
const locationCache = new Map();

/**
 * Get the nearest place/address with caching for efficiency
 * 
 * @param {number} longitude - The longitude coordinate
 * @param {number} latitude - The latitude coordinate
 * @returns {Promise<string>} - A promise that resolves to a location name
 */
export const validateCoordinates = (coordinates) => {
  // Basic structural validation
  if (!coordinates || !Array.isArray(coordinates)) {
    return false;
  }
  
  // For GeoJSON point format [longitude, latitude]
  if (coordinates.length === 2) {
    const [longitude, latitude] = coordinates;
    
    // Check if values are valid numbers
    if (isNaN(longitude) || isNaN(latitude)) {
      return false;
    }
    
    // Check if values are in valid ranges
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return false;
    }
    
    return true;
  }
  
  return false;
};

// Enhance the existing getCachedLocationName function with validation
export const getCachedLocationName = async (longitudeOrCoords, latitude) => {
  // Handle both formats: getCachedLocationName([lng, lat]) or getCachedLocationName(lng, lat)
  let longitude;
  
  // Check if first parameter is an array (coordinates format)
  if (Array.isArray(longitudeOrCoords) && longitudeOrCoords.length === 2) {
    [longitude, latitude] = longitudeOrCoords;
  } else {
    // If separate parameters were provided
    longitude = longitudeOrCoords;
  }
  
  // Validate coordinates
  if (isNaN(longitude) || isNaN(latitude) || 
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    console.warn('Invalid coordinates provided to getCachedLocationName:', longitude, latitude);
    return 'Invalid location';
  }
  
  // Round coordinates to reduce unnecessary API calls for nearby points
  const roundedLng = Math.round(longitude * 10000) / 10000;
  const roundedLat = Math.round(latitude * 10000) / 10000;
  
  const cacheKey = `${roundedLng},${roundedLat}`;
  
  // Check if we already have this location in cache
  if (locationCache.has(cacheKey)) {
    return locationCache.get(cacheKey);
  }
  
  // If not in cache, fetch from API
  const locationName = await getNearestLocation(longitude, latitude);
  
  // Store in cache for future use
  locationCache.set(cacheKey, locationName);
  
  return locationName;
};