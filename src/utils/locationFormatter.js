/**
 * Parse PostGIS WKB (Well-Known Binary) hex format
 * Format example: 0101000020E6100000770A5E99DC3E524009A128756ED14040
 * 
 * @param {string} wkbHex - WKB in hexadecimal string format
 * @returns {Object|null} - Parsed latitude and longitude or null if invalid
 */
export const parsePostGisWkb = (wkbHex) => {
  try {
    if (!wkbHex || typeof wkbHex !== 'string') {
      return null;
    }

    // Check if it's likely a PostGIS WKB hex string
    if (!wkbHex.match(/^0101000020E6100000/i)) {
      return null;
    }

    // In PostGIS WKB hex format for POINT, the X and Y coordinates are stored as 8-byte double values
    // after the header bytes. The format is typically:
    // 0101000020E6100000[X COORDINATE (8 bytes)][Y COORDINATE (8 bytes)]
    
    // Extract the X and Y coordinates (each is 16 hex chars representing 8 bytes)
    const coordsStart = 18; // Skip the 18-char header (0101000020E6100000)
    
    if (wkbHex.length < coordsStart + 32) { // 16 chars for X + 16 chars for Y
      console.warn('WKB hex string too short:', wkbHex);
      return null;
    }
    
    // Extract X and Y parts
    const xHex = wkbHex.substring(coordsStart, coordsStart + 16);
    const yHex = wkbHex.substring(coordsStart + 16, coordsStart + 32);
    
    // Convert each coordinate from hex
    // Break the hex string into byte pairs
    const xBytes = [];
    const yBytes = [];
    
    for (let i = 0; i < 16; i += 2) {
      xBytes.push(parseInt(xHex.substring(i, i+2), 16));
      yBytes.push(parseInt(yHex.substring(i, i+2), 16));
    }
    
    // Reverse the bytes for endianness
    xBytes.reverse();
    yBytes.reverse();
    
    // Convert byte arrays to hex strings
    const xHexReversed = xBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    const yHexReversed = yBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Parse as double
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    
    // Parse X coordinate (longitude)
    for (let i = 0; i < 8; i++) {
      view.setUint8(i, parseInt(xHexReversed.substring(i*2, i*2+2), 16));
    }
    const longitude = view.getFloat64(0);
    
    // Parse Y coordinate (latitude)
    for (let i = 0; i < 8; i++) {
      view.setUint8(i, parseInt(yHexReversed.substring(i*2, i*2+2), 16));
    }
    const latitude = view.getFloat64(0);
    
    if (isNaN(longitude) || isNaN(latitude) || 
        Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      console.warn('Invalid coordinates from WKB:', longitude, latitude);
      return null;
    }
    
    return { latitude, longitude };
  } catch (err) {
    console.error('Error parsing PostGIS WKB hex:', err);
    return null;
  }
};
export const parseLocation = (location) => {
  try {
    // Handle null or undefined case
    if (!location) {
      return null;
    }
    
    // If already an object with lat/lng, return it
    if (typeof location === 'object') {
      // Check for standard lat/lng properties
      if ((location.latitude !== undefined || location.lat !== undefined) && 
          (location.longitude !== undefined || location.lng !== undefined)) {
        const latitude = location.latitude !== undefined ? location.latitude : location.lat;
        const longitude = location.longitude !== undefined ? location.longitude : location.lng;
        
        if (isValidLatLng(longitude, latitude)) {
          return { latitude, longitude };
        }
      }
      
      // Check for GeoJSON format
      if (location.type === 'Point' && 
          Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        const [longitude, latitude] = location.coordinates;
        
        if (isValidLatLng(longitude, latitude)) {
          return { latitude, longitude };
        }
      }
    }
    
    // Handle WKB hex format from PostGIS
    if (typeof location === 'string' && location.startsWith('0101000020E6100000')) {
      const parsedWkb = parsePostGisWkb(location);
      if (parsedWkb) {
        return parsedWkb;
      }
    }
    
    // Handle WKT format: POINT(longitude latitude) or SRID=4326;POINT(lng lat)
    if (typeof location === 'string') {
      // Try to extract coordinates from POINT format
      const pointMatch = location.match(/POINT\s*\(\s*([-+]?\d+\.\d+)\s+([-+]?\d+\.\d+)\s*\)/i);
      if (pointMatch && pointMatch.length >= 3) {
        const longitude = parseFloat(pointMatch[1]);
        const latitude = parseFloat(pointMatch[2]);
        
        if (isValidLatLng(longitude, latitude)) {
          return { latitude, longitude };
        }
      }
      
      // Check for raw "longitude,latitude" format
      const commaMatch = location.match(/^\s*([-+]?\d+\.\d+)\s*,\s*([-+]?\d+\.\d+)\s*$/);
      if (commaMatch && commaMatch.length >= 3) {
        const longitude = parseFloat(commaMatch[1]);
        const latitude = parseFloat(commaMatch[2]);
        
        if (isValidLatLng(longitude, latitude)) {
          return { latitude, longitude };
        }
      }
      
      // Check for JSON string that might contain location data
      try {
        const parsedJson = JSON.parse(location);
        if (parsedJson) {
          // Recursively try to parse this JSON object
          return parseLocation(parsedJson);
        }
      } catch (e) {
        // Not valid JSON, continue with other checks
      }
      
      // Look for any numbers in the string as a last resort
      const coords = location.match(/[-+]?\d+\.\d+/g);
      if (coords && coords.length >= 2) {
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        
        if (isValidLatLng(lng, lat)) {
          return { latitude: lat, longitude: lng };
        }
      }
    }
    
    // Handle raw coordinates array [lng, lat]
    if (Array.isArray(location) && location.length >= 2) {
      const [longitude, latitude] = location;
      if (!isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (isValidLatLng(lng, lat)) {
          return { latitude: lat, longitude: lng };
        }
      }
    }
    
    console.warn('Could not parse location format:', location);
    return null;
  } catch (error) {
    console.error('Error parsing location:', error, location);
    return null;
  }
};

/**
 * Helper function to validate if latitude and longitude values are reasonable
 */
function isValidLatLng(lng, lat) {
  return isFinite(lng) && isFinite(lat) && 
         Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
}