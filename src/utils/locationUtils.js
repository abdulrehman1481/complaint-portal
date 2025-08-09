// Import statements

/**
 * Get the nearest place/address for a set of coordinates
 * Uses OpenStreetMap Nominatim Reverse Geocoding API (free alternative to Mapbox)
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
    
    // Call OpenStreetMap Nominatim Reverse Geocoding API
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ComplaintManagementSystem/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.display_name) {
      // Extract useful parts of the address
      const address = data.address;
      if (address) {
        const parts = [];
        
        // Add house number and road
        if (address.house_number && address.road) {
          parts.push(`${address.house_number} ${address.road}`);
        } else if (address.road) {
          parts.push(address.road);
        }
        
        // Add suburb/neighbourhood
        if (address.suburb || address.neighbourhood) {
          parts.push(address.suburb || address.neighbourhood);
        }
        
        // Add city/town
        if (address.city || address.town || address.village) {
          parts.push(address.city || address.town || address.village);
        }
        
        return parts.length > 0 ? parts.join(', ') : data.display_name;
      }
      
      return data.display_name;
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