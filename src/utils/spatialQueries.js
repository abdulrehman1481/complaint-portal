import { supabase } from '../supabaseClient';
import * as turf from '@turf/turf';

/**
 * Find complaints within a certain radius of a point
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {number} radiusMeters - Radius in meters
 * @returns {Promise<Array>} - Complaints within radius
 */
export const findComplaintsWithinDistance = async (lng, lat, radiusMeters) => {
  try {
    // Try server-side spatial query first
    const { data, error } = await supabase.rpc('find_complaints_within_distance', {
      center_lng: lng,
      center_lat: lat,
      radius_meters: radiusMeters
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Server-side spatial query failed:', error);
    throw error; // Let the caller handle the fallback
  }
};

/**
 * Fallback: client-side implementation to find complaints within distance
 * @param {Array} complaints - Array of complaint objects with parsedLocation
 * @param {number} lng - Longitude of center point
 * @param {number} lat - Latitude of center point
 * @param {number} radiusMeters - Radius in meters
 * @returns {Array} - Filtered complaints within radius
 */
export const findComplaintsWithinDistanceClientSide = (complaints, lng, lat, radiusMeters) => {
  if (!complaints || !Array.isArray(complaints)) return [];
  
  const radiusKm = radiusMeters / 1000; // Convert to km for turf.js
  const center = turf.point([lng, lat]);
  
  return complaints.filter(complaint => {
    if (!complaint.parsedLocation) return false;
    
    const point = turf.point([
      complaint.parsedLocation.longitude,
      complaint.parsedLocation.latitude
    ]);
    
    const distance = turf.distance(center, point, { units: 'kilometers' });
    return distance <= radiusKm;
  });
};

/**
 * Create a buffer and analyze complaints within it
 * @param {number} lng - Longitude of center
 * @param {number} lat - Latitude of center
 * @param {number} radiusMeters - Buffer radius in meters
 * @returns {Promise<Object>} - Analysis results
 */
export const createBufferAnalysis = async (lng, lat, radiusMeters) => {
  try {
    // Try server-side spatial query first
    const { data, error } = await supabase.rpc('create_buffer_analysis', {
      point_lng: lng,
      point_lat: lat,
      buffer_distance: radiusMeters
    });
    
    if (error) throw error;
    return data || { total_count: 0 };
  } catch (error) {
    console.error('Server-side buffer analysis failed:', error);
    throw error; // Let the caller handle the fallback
  }
};

/**
 * Count complaints by category within a polygon
 * @param {Object} polygon - GeoJSON polygon
 * @returns {Promise<Array>} - Category counts
 */
export const countComplaintsByCategoryInArea = async (polygon) => {
  try {
    // Convert polygon to GeoJSON string for the server
    const polygonJson = JSON.stringify(polygon);
    
    // Try server-side spatial query
    const { data, error } = await supabase.rpc('count_complaints_by_category_in_area', {
      area_geojson: polygonJson
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Server-side category count failed:', error);
    throw error; // Let the caller handle the fallback
  }
};

export default {
  findComplaintsWithinDistance,
  findComplaintsWithinDistanceClientSide,
  createBufferAnalysis,
  countComplaintsByCategoryInArea
};
