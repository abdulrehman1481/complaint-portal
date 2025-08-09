import * as turf from '@turf/turf';

/**
 * Geofencing utility for restricting operations to Rawalpindi (RWP) and Islamabad (ISB)
 */

// Define the boundaries for Rawalpindi and Islamabad
// These are approximate boundaries - you may need to refine these coordinates
export const RAWALPINDI_BOUNDS = {
  type: 'Feature',
  properties: {
    name: 'Rawalpindi',
    code: 'RWP',
    description: 'Rawalpindi District Boundary'
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [73.0000, 33.4000], // Southwest corner
      [73.2500, 33.4000], // Southeast corner
      [73.2500, 33.7500], // Northeast corner
      [73.0000, 33.7500], // Northwest corner
      [73.0000, 33.4000]  // Close the polygon
    ]]
  }
};

export const ISLAMABAD_BOUNDS = {
  type: 'Feature',
  properties: {
    name: 'Islamabad',
    code: 'ISB',
    description: 'Islamabad Capital Territory Boundary'
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [72.9500, 33.4500], // Southwest corner
      [73.2000, 33.4500], // Southeast corner
      [73.2000, 33.7800], // Northeast corner
      [72.9500, 33.7800], // Northwest corner
      [72.9500, 33.4500]  // Close the polygon
    ]]
  }
};

// Combined bounds for both cities
export const ALLOWED_AREA_BOUNDS = {
  type: 'FeatureCollection',
  features: [RAWALPINDI_BOUNDS, ISLAMABAD_BOUNDS]
};

/**
 * Check if a point is within the allowed geographical area (RWP or ISB)
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @returns {boolean} - True if the point is within allowed bounds
 */
export const isWithinAllowedArea = (longitude, latitude) => {
  try {
    // Validate coordinates
    if (isNaN(longitude) || isNaN(latitude) || 
        Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      return false;
    }

    const point = turf.point([longitude, latitude]);
    
    // Check if point is within Rawalpindi bounds
    if (turf.booleanPointInPolygon(point, RAWALPINDI_BOUNDS)) {
      return true;
    }
    
    // Check if point is within Islamabad bounds
    if (turf.booleanPointInPolygon(point, ISLAMABAD_BOUNDS)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking geofencing bounds:', error);
    return false;
  }
};

/**
 * Get the city name for a given coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @returns {string|null} - City name ('Rawalpindi', 'Islamabad') or null if outside bounds
 */
export const getCityFromCoordinates = (longitude, latitude) => {
  try {
    const point = turf.point([longitude, latitude]);
    
    if (turf.booleanPointInPolygon(point, RAWALPINDI_BOUNDS)) {
      return 'Rawalpindi';
    }
    
    if (turf.booleanPointInPolygon(point, ISLAMABAD_BOUNDS)) {
      return 'Islamabad';
    }
    
    return null;
  } catch (error) {
    console.error('Error determining city from coordinates:', error);
    return null;
  }
};

/**
 * Validate if a complaint location is within service area
 * @param {Object} location - Location object with latitude and longitude
 * @returns {Object} - Validation result with success flag and message
 */
export const validateComplaintLocation = (location) => {
  if (!location || !location.latitude || !location.longitude) {
    return {
      success: false,
      message: 'Invalid location coordinates provided.',
      code: 'INVALID_COORDINATES'
    };
  }

  const { latitude, longitude } = location;
  
  if (!isWithinAllowedArea(longitude, latitude)) {
    const city = getCityFromCoordinates(longitude, latitude);
    return {
      success: false,
      message: `Location is outside service area. This system only operates within Rawalpindi and Islamabad. ${city ? `Location appears to be in ${city}` : 'Location not recognized'}.`,
      code: 'OUTSIDE_SERVICE_AREA',
      suggestedAction: 'Please select a location within Rawalpindi or Islamabad boundaries.'
    };
  }

  const city = getCityFromCoordinates(longitude, latitude);
  return {
    success: true,
    message: `Location validated successfully in ${city}.`,
    city: city,
    code: 'LOCATION_VALID'
  };
};

/**
 * Get the center point of the allowed service area
 * @returns {Array} - [longitude, latitude] of the center point
 */
export const getServiceAreaCenter = () => {
  try {
    // Calculate center of combined bounds
    const bbox = turf.bbox(ALLOWED_AREA_BOUNDS);
    const centerPoint = turf.center(ALLOWED_AREA_BOUNDS);
    return centerPoint.geometry.coordinates;
  } catch (error) {
    console.error('Error calculating service area center:', error);
    // Fallback to approximate center between Islamabad and Rawalpindi
    return [73.1, 33.6];
  }
};

/**
 * Get bounds for the map view to show both cities
 * @returns {Array} - Bounding box [minLng, minLat, maxLng, maxLat]
 */
export const getServiceAreaBounds = () => {
  try {
    return turf.bbox(ALLOWED_AREA_BOUNDS);
  } catch (error) {
    console.error('Error calculating service area bounds:', error);
    // Fallback bounds covering both cities
    return [72.9, 33.4, 73.3, 33.8];
  }
};

/**
 * Check if a drawn shape/analysis area overlaps with the service area
 * @param {Object} feature - GeoJSON feature (polygon, circle, etc.)
 * @returns {boolean} - True if the feature overlaps with service area
 */
export const isAnalysisWithinServiceArea = (feature) => {
  try {
    if (!feature || !feature.geometry) {
      return false;
    }

    // Check if the feature intersects with either city boundary
    const intersectsRawalpindi = turf.booleanIntersects(feature, RAWALPINDI_BOUNDS);
    const intersectsIslamabad = turf.booleanIntersects(feature, ISLAMABAD_BOUNDS);
    
    return intersectsRawalpindi || intersectsIslamabad;
  } catch (error) {
    console.error('Error checking analysis area against service bounds:', error);
    return false;
  }
};

/**
 * Enforce geofencing on user location
 * @param {Object} userLocation - User location object
 * @returns {Object} - Validation result
 */
export const enforceLocationGeofencing = (userLocation) => {
  if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
    return {
      allowed: false,
      message: 'Location not available',
      redirectToCenter: true
    };
  }

  const validation = validateComplaintLocation(userLocation);
  
  if (!validation.success) {
    return {
      allowed: false,
      message: validation.message,
      code: validation.code,
      redirectToCenter: true,
      suggestedLocation: getServiceAreaCenter()
    };
  }

  return {
    allowed: true,
    message: `Welcome to ${validation.city}!`,
    city: validation.city
  };
};

export default {
  isWithinAllowedArea,
  getCityFromCoordinates,
  validateComplaintLocation,
  getServiceAreaCenter,
  getServiceAreaBounds,
  isAnalysisWithinServiceArea,
  enforceLocationGeofencing,
  RAWALPINDI_BOUNDS,
  ISLAMABAD_BOUNDS,
  ALLOWED_AREA_BOUNDS
};
