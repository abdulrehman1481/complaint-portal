import * as turf from '@turf/turf';

/**
 * Finds all points that fall within a polygon feature
 * @param {Object} feature - A GeoJSON polygon feature
 * @param {Array} points - Array of GeoJSON point features to test
 * @returns {Array} - Array of points that fall within the polygon
 */
export const pointsInPolygon = (feature, points) => {
  if (!feature || !Array.isArray(points)) {
    console.error('Invalid inputs for pointsInPolygon');
    return [];
  }

  // Ensure we have a valid polygon
  if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
    console.error('Invalid polygon geometry for analysis:', feature);
    return [];
  }

  // Find points that are within the polygon
  return points.filter(point => {
    try {
      // Handle invalid geometries
      if (!point.geometry || !point.geometry.coordinates) return false;
      
      // Check if point is inside polygon
      return turf.booleanPointInPolygon(
        point.geometry.coordinates, 
        feature.geometry
      );
    } catch (err) {
      console.error("Error in point-in-polygon test:", err);
      return false;
    }
  });
};

/**
 * Creates a buffer around a feature
 * @param {Object} feature - A GeoJSON feature
 * @param {Number} distance - Buffer distance in meters
 * @returns {Object} - A GeoJSON polygon feature representing the buffer
 */
export const createBufferAround = (feature, distance) => {
  if (!feature) {
    console.error('No feature provided for buffer creation');
    return null;
  }

  try {
    // Convert distance from meters to kilometers for turf
    const distanceKm = distance / 1000;
    
    // Create buffer
    const buffer = turf.buffer(feature, distanceKm, { units: 'kilometers' });
    
    // Add metadata
    buffer.properties = buffer.properties || {};
    buffer.properties.analysisType = 'buffer';
    buffer.properties.bufferDistance = distance;
    
    return buffer;
  } catch (error) {
    console.error('Error creating buffer:', error);
    return null;
  }
};

/**
 * Calculate geographic center (centroid) of points
 * @param {Array} points - Array of GeoJSON point features
 * @returns {Object} - GeoJSON point feature representing the centroid
 */
export const calculateCentroid = (points) => {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  
  try {
    const featureCollection = turf.featureCollection(points);
    return turf.centroid(featureCollection);
  } catch (error) {
    console.error('Error calculating centroid:', error);
    return null;
  }
};

/**
 * Generate a convex hull around a set of points
 * @param {Array} points - Array of GeoJSON point features 
 * @returns {Object} - GeoJSON polygon feature representing the convex hull
 */
export const generateConvexHull = (points) => {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }
  
  try {
    const featureCollection = turf.featureCollection(points);
    return turf.convex(featureCollection);
  } catch (error) {
    console.error('Error generating convex hull:', error);
    return null;
  }
};

/**
 * Calculates the distance between two points
 * @param {Array} point1 - [lng, lat] coordinates of first point
 * @param {Array} point2 - [lng, lat] coordinates of second point
 * @returns {Number} - Distance in kilometers
 */
export const distanceBetweenPoints = (point1, point2) => {
  try {
    return turf.distance(point1, point2, { units: 'kilometers' });
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 0;
  }
};

/**
 * Calculates statistics from an array of points
 * @param {Array} points - Array of GeoJSON point features
 * @param {Object} properties - Properties to analyze
 * @returns {Object} - Statistics about the points
 */
export const calculatePointStatistics = (points) => {
  if (!Array.isArray(points) || points.length === 0) {
    return { count: 0 };
  }
  
  try {
    // Count by status
    const statusCounts = points.reduce((acc, point) => {
      const status = point.properties?.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    // Count by category
    const categoryCounts = points.reduce((acc, point) => {
      const category = point.properties?.category_name || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    // Count by priority
    const priorityCounts = points.reduce((acc, point) => {
      const priority = point.properties?.priority || 1;
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});
    
    return {
      count: points.length,
      statusCounts,
      categoryCounts,
      priorityCounts
    };
  } catch (error) {
    console.error('Error calculating point statistics:', error);
    return { count: 0 };
  }
};

/**
 * Calculates a density grid for heatmap visualization
 * @param {Array} points - Array of GeoJSON point features
 * @param {Array} bbox - Bounding box [minX, minY, maxX, maxY]
 * @param {Number} cellSize - Size of each cell in kilometers
 * @returns {Object} - GeoJSON FeatureCollection of points with density values
 */
export const calculateDensityGrid = (points, bbox, cellSize = 0.5) => {
  if (!Array.isArray(points) || points.length === 0 || !bbox) {
    return { features: [] };
  }
  
  try {
    // Create a grid of points
    const grid = turf.pointGrid(bbox, cellSize, { units: 'kilometers' });
    
    // For each grid point, count nearby points
    grid.features.forEach(cell => {
      const searchRadius = cellSize * 1.5;
      const point = cell.geometry.coordinates;
      
      const countInRadius = points.filter(feature => {
        const coords = feature.geometry.coordinates;
        return turf.distance(point, coords, { units: 'kilometers' }) <= searchRadius;
      }).length;
      
      cell.properties.density = countInRadius;
    });
    
    // Filter out cells with zero density
    return {
      type: 'FeatureCollection',
      features: grid.features.filter(cell => cell.properties.density > 0)
    };
  } catch (error) {
    console.error('Error calculating density grid:', error);
    return { features: [] };
  }
};

/**
 * Find hotspots in a set of points
 * @param {Object} densityGrid - Density grid from calculateDensityGrid
 * @param {Number} threshold - Percentage threshold (0-1) of max density to qualify as hotspot
 * @returns {Object} - GeoJSON FeatureCollection of hotspots
 */
export const findHotspots = (densityGrid, threshold = 0.7) => {
  if (!densityGrid || !densityGrid.features || densityGrid.features.length === 0) {
    return { features: [] };
  }
  
  try {
    // Find maximum density
    const maxDensity = Math.max(...densityGrid.features.map(f => f.properties.density));
    
    // Filter for hotspots
    const hotspotFeatures = densityGrid.features
      .filter(f => f.properties.density >= maxDensity * threshold)
      .sort((a, b) => b.properties.density - a.properties.density);
    
    return {
      type: 'FeatureCollection',
      features: hotspotFeatures
    };
  } catch (error) {
    console.error('Error finding hotspots:', error);
    return { features: [] };
  }
};
