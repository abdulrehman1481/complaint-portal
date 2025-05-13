import * as turf from '@turf/turf';

/**
 * Enhanced point-in-polygon counting with detailed statistics
 * @param {Object} polygon - GeoJSON polygon feature
 * @param {Array} points - Array of GeoJSON point features
 * @returns {Object} - Statistics about points within the polygon
 */
export const countPointsInPolygon = (polygon, points) => {
  try {
    if (!polygon || !points || !points.length) {
      return { totalPoints: 0, error: 'Invalid input data' };
    }

    // Ensure we have a valid polygon
    if (!polygon.geometry || (polygon.geometry.type !== 'Polygon' && polygon.geometry.type !== 'MultiPolygon')) {
      return { totalPoints: 0, error: 'Invalid polygon geometry' };
    }

    // Find points within the polygon
    const pointsWithin = points.filter(point => {
      try {
        if (!point.geometry || !point.geometry.coordinates) return false;
        return turf.booleanPointInPolygon(point.geometry.coordinates, polygon.geometry);
      } catch (err) {
        console.error('Error in point-in-polygon test:', err);
        return false;
      }
    });

    // Calculate area in square kilometers
    const area = turf.area(polygon) / 1000000; // convert from m² to km²

    // Calculate statistics
    const totalComplaints = points.length;
    
    // Status counts
    const pointsByStatus = pointsWithin.reduce((acc, point) => {
      const status = point.properties.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Category counts
    const pointsByCategory = pointsWithin.reduce((acc, point) => {
      const category = point.properties.category_name || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Priority counts
    const pointsByPriority = pointsWithin.reduce((acc, point) => {
      const priority = point.properties.priority || 1;
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    // Time-based analysis
    const pointsByTime = {
      last24h: 0,
      last7d: 0,
      last30d: 0,
      older: 0
    };

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    pointsWithin.forEach(point => {
      try {
        const createdAt = new Date(point.properties.created_at_raw || point.properties.created_at);
        const ageMs = now - createdAt;
        
        if (ageMs <= day) {
          pointsByTime.last24h++;
        } else if (ageMs <= 7 * day) {
          pointsByTime.last7d++;
        } else if (ageMs <= 30 * day) {
          pointsByTime.last30d++;
        } else {
          pointsByTime.older++;
        }
      } catch (err) {
        pointsByTime.older++;
      }
    });

    // Calculate density (complaints per sq km)
    const density = area > 0 ? (pointsWithin.length / area) : 0;

    return {
      totalPoints: pointsWithin.length,
      pointsByStatus,
      pointsByCategory,
      pointsByPriority,
      pointsByTime,
      area: Number(area.toFixed(4)),
      density: Number(density.toFixed(2)),
      percentOfTotal: totalComplaints > 0 
        ? Number(((pointsWithin.length / totalComplaints) * 100).toFixed(1))
        : 0
    };
  } catch (error) {
    console.error('Error in countPointsInPolygon:', error);
    return { totalPoints: 0, error: error.message };
  }
};

/**
 * Create buffer around features with various options
 * @param {Object} feature - GeoJSON feature
 * @param {number} distance - Buffer distance in meters
 * @param {string} bufferType - Type of buffer (standard, variable)
 * @returns {Object} - Buffer as GeoJSON feature
 */
export const createBuffer = (feature, distance, bufferType = 'standard') => {
  try {
    if (!feature) {
      throw new Error('No feature provided for buffer creation');
    }

    // Convert distance from meters to kilometers for turf
    const distanceKm = distance / 1000;
    
    let buffer;
    
    if (bufferType === 'variable') {
      // Variable buffer - different distances based on properties
      // For example, higher priority complaints get larger buffers
      const priority = feature.properties?.priority || 1;
      const multiplier = [1, 1, 1.5, 2][priority] || 1;
      buffer = turf.buffer(feature, distanceKm * multiplier, { units: 'kilometers' });
    } else {
      // Standard buffer - same distance in all directions
      buffer = turf.buffer(feature, distanceKm, { units: 'kilometers' });
    }
    
    // Add metadata
    buffer.properties = buffer.properties || {};
    buffer.properties.analysisType = 'buffer';
    buffer.properties.bufferDistance = distance;
    buffer.properties.bufferType = bufferType;
    buffer.properties.originalFeatureId = feature.properties?.id;
    
    return buffer;
  } catch (error) {
    console.error('Error creating buffer:', error);
    throw error;
  }
};

/**
 * Calculate points in buffer zone with enhanced statistics
 * @param {Object} buffer - GeoJSON polygon feature (buffer)
 * @param {Array} points - Array of GeoJSON point features
 * @returns {Object} - Statistics about points within buffer
 */
export const countPointsInBuffer = (buffer, points) => {
  try {
    if (!buffer || !points || !points.length) {
      return { totalPoints: 0, error: 'Invalid input data' };
    }

    // Ensure we have valid geometry
    const testGeometry = buffer.geometry || buffer;
    
    if (!testGeometry || (testGeometry.type !== 'Polygon' && testGeometry.type !== 'MultiPolygon')) {
      return { totalPoints: 0, error: 'Invalid buffer geometry' };
    }

    // Find points within the buffer
    const pointsWithin = points.filter(point => {
      try {
        if (!point.geometry || !point.geometry.coordinates) return false;
        return turf.booleanPointInPolygon(point.geometry.coordinates, testGeometry);
      } catch (err) {
        console.error('Error in point-in-buffer test:', err);
        return false;
      }
    });

    // Calculate statistics
    const pointsByCategory = {};
    const pointsByStatus = {};
    const pointsByPriority = {1: 0, 2: 0, 3: 0};
    const pointsByTime = {last24h: 0, last7d: 0, last30d: 0, older: 0};
    
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    pointsWithin.forEach(point => {
      // Category stats
      const category = point.properties.category_name || 'Other';
      pointsByCategory[category] = (pointsByCategory[category] || 0) + 1;
      
      // Status stats
      const status = point.properties.status || 'unknown';
      pointsByStatus[status] = (pointsByStatus[status] || 0) + 1;
      
      // Priority stats
      const priority = point.properties.priority || 1;
      pointsByPriority[priority] = (pointsByPriority[priority] || 0) + 1;
      
      // Time-based stats
      try {
        const createdAt = new Date(point.properties.created_at_raw || point.properties.created_at);
        const ageMs = now - createdAt;
        
        if (ageMs <= day) {
          pointsByTime.last24h++;
        } else if (ageMs <= 7 * day) {
          pointsByTime.last7d++;
        } else if (ageMs <= 30 * day) {
          pointsByTime.last30d++;
        } else {
          pointsByTime.older++;
        }
      } catch (err) {
        pointsByTime.older++;
      }
    });

    // Calculate area safely
    let area = 0;
    try {
      area = turf.area(buffer) / 1000000; // convert to km²
    } catch (err) {
      console.error('Error calculating buffer area:', err);
      // Try with a different approach
      if (buffer.geometry) {
        area = turf.area(buffer.geometry) / 1000000;
      }
    }
    
    const density = area > 0 ? (pointsWithin.length / area) : 0;
    
    return {
      totalPoints: pointsWithin.length,
      pointsByCategory,
      pointsByStatus,
      pointsByPriority,
      pointsByTime,
      area: Number(area.toFixed(4)),
      density: Number(density.toFixed(2))
    };
  } catch (error) {
    console.error('Error in countPointsInBuffer:', error);
    return { totalPoints: 0, error: error.message };
  }
};

/**
 * Generate report data from spatial analysis results
 * @param {Object} analysisResult - Results from spatial analysis
 * @param {string} analysisType - Type of analysis performed
 * @returns {Object} - Formatted report data
 */
export const generateAnalysisReport = (analysisResult, analysisType) => {
  try {
    if (!analysisResult) return { title: 'No Data Available' };
    
    const result = {
      title: '',
      summary: [],
      details: [],
      stats: {},
      timestamp: new Date().toISOString()
    };
    
    switch (analysisType) {
      case 'pointCount':
        result.title = 'Point Count Analysis';
        result.summary = [
          `Found ${analysisResult.totalPoints} complaints in selected area`,
          `Area: ${analysisResult.area.toFixed(2)} km²`,
          `Density: ${analysisResult.density} complaints/km²`,
          `${analysisResult.percentOfTotal}% of total complaints`
        ];
        result.details = [
          { 
            title: 'Status breakdown',
            data: Object.entries(analysisResult.pointsByStatus || {})
              .map(([key, value]) => ({
                label: key === 'in_progress' ? 'In Progress' : key.charAt(0).toUpperCase() + key.slice(1),
                value
              }))
          },
          {
            title: 'Category breakdown',
            data: Object.entries(analysisResult.pointsByCategory || {})
              .sort(([, a], [, b]) => b - a)
              .map(([key, value]) => ({
                label: key,
                value
              }))
          },
          {
            title: 'Time breakdown',
            data: [
              { label: 'Last 24 hours', value: analysisResult.pointsByTime?.last24h || 0 },
              { label: 'Last 7 days', value: analysisResult.pointsByTime?.last7d || 0 },
              { label: 'Last 30 days', value: analysisResult.pointsByTime?.last30d || 0 },
              { label: 'Older', value: analysisResult.pointsByTime?.older || 0 }
            ]
          }
        ];
        result.stats = analysisResult;
        break;
      
      case 'buffer':
        result.title = `Buffer Analysis (${analysisResult.bufferDistance}m)`;
        result.summary = [
          `Found ${analysisResult.totalPoints} complaints within buffer`,
          `Buffer Area: ${analysisResult.area.toFixed(2)} km²`,
          `Density: ${analysisResult.density} complaints/km²`
        ];
        result.details = [
          { 
            title: 'Status breakdown',
            data: Object.entries(analysisResult.pointsByStatus || {})
              .map(([key, value]) => ({
                label: key === 'in_progress' ? 'In Progress' : key.charAt(0).toUpperCase() + key.slice(1),
                value
              }))
          },
          {
            title: 'Category breakdown',
            data: Object.entries(analysisResult.pointsByCategory || {})
              .sort(([, a], [, b]) => b - a)
              .map(([key, value]) => ({
                label: key,
                value
              }))
          },
          {
            title: 'Time breakdown',
            data: [
              { label: 'Last 24 hours', value: analysisResult.pointsByTime?.last24h || 0 },
              { label: 'Last 7 days', value: analysisResult.pointsByTime?.last7d || 0 },
              { label: 'Last 30 days', value: analysisResult.pointsByTime?.last30d || 0 },
              { label: 'Older', value: analysisResult.pointsByTime?.older || 0 }
            ]
          }
        ];
        result.stats = analysisResult;
        break;
        
      default:
        result.title = 'Analysis Results';
        result.summary = ['Analysis complete'];
    }
    
    return result;
  } catch (error) {
    console.error('Error generating analysis report:', error);
    return { 
      title: 'Error in Analysis',
      summary: ['An error occurred while generating the analysis report.'],
      error: error.message
    };
  }
};

/**
 * Export analysis results to CSV
 * @param {Object} analysisResult - Results from spatial analysis
 * @param {string} analysisType - Type of analysis performed
 * @returns {string} - CSV content
 */
export const exportAnalysisToCSV = (analysisResult, analysisType) => {
  try {
    if (!analysisResult) return '';
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    switch (analysisType) {
      case 'pointCount':
      case 'buffer':
        // Basic info
        csvContent += "Analysis Type,Total Points,Area (km²),Density (points/km²)\n";
        csvContent += `${analysisType},${analysisResult.totalPoints},${analysisResult.area.toFixed(2)},${analysisResult.density}\n\n`;
        
        // Status breakdown
        csvContent += "Status Breakdown\nStatus,Count\n";
        Object.entries(analysisResult.pointsByStatus || {}).forEach(([status, count]) => {
          csvContent += `${status},${count}\n`;
        });
        csvContent += "\n";
        
        // Category breakdown
        csvContent += "Category Breakdown\nCategory,Count\n";
        Object.entries(analysisResult.pointsByCategory || {})
          .sort(([, a], [, b]) => b - a)
          .forEach(([category, count]) => {
            csvContent += `${category},${count}\n`;
          });
        csvContent += "\n";
        
        // Time breakdown
        csvContent += "Time Breakdown\nPeriod,Count\n";
        if (analysisResult.pointsByTime) {
          csvContent += `Last 24 hours,${analysisResult.pointsByTime.last24h || 0}\n`;
          csvContent += `Last 7 days,${analysisResult.pointsByTime.last7d || 0}\n`;
          csvContent += `Last 30 days,${analysisResult.pointsByTime.last30d || 0}\n`;
          csvContent += `Older,${analysisResult.pointsByTime.older || 0}\n`;
        }
        break;
        
      default:
        csvContent += "No data available for export";
    }
    
    return encodeURI(csvContent);
  } catch (error) {
    console.error('Error exporting analysis to CSV:', error);
    return encodeURI("data:text/csv;charset=utf-8,Error generating CSV");
  }
};

export default {
  countPointsInPolygon,
  createBuffer,
  countPointsInBuffer,
  generateAnalysisReport,
  exportAnalysisToCSV
};
