import * as XLSX from 'xlsx';

// Utility functions for exporting spatial analysis results
export const exportSpatialAnalysisToCSV = (analysisResults, fileName = 'spatial_analysis') => {
  try {
    if (!analysisResults || !analysisResults.complaints) {
      throw new Error('No analysis results to export');
    }

    // Prepare data for CSV export
    const csvData = analysisResults.complaints.map(complaint => ({
      'Complaint ID': complaint.id,
      'Title': complaint.title || '',
      'Status': complaint.status || '',
      'Category': complaint.categories?.name || '',
      'Department': complaint.department_name || '',
      'Priority': complaint.priority || '',
      'Urgency Level': complaint.urgency_level || '',
      'Description': complaint.description || '',
      'Location Name': complaint.locationName || '',
      'Latitude': complaint.coordinates?.[1]?.toFixed(6) || '',
      'Longitude': complaint.coordinates?.[0]?.toFixed(6) || '',
      'Reporter': complaint.anonymous ? 'Anonymous' : (complaint.reported_by_name || `User #${complaint.reported_by}`),
      'Created Date': complaint.created_at ? new Date(complaint.created_at).toISOString() : '',
      'Updated Date': complaint.updated_at ? new Date(complaint.updated_at).toISOString() : '',
      'Response Required': complaint.response_required ? 'Yes' : 'No',
      'Anonymous': complaint.anonymous ? 'Yes' : 'No'
    }));

    // Add analysis metadata
    if (analysisResults.metadata) {
      csvData.unshift({
        'Complaint ID': '--- ANALYSIS METADATA ---',
        'Title': `Analysis Type: ${analysisResults.metadata.type || 'Unknown'}`,
        'Status': `Total Count: ${analysisResults.metadata.totalCount || 0}`,
        'Category': `Analysis Date: ${new Date().toISOString()}`,
        'Department': analysisResults.metadata.center ? 
          `Center: ${analysisResults.metadata.center.lat?.toFixed(6)}, ${analysisResults.metadata.center.lng?.toFixed(6)}` : '',
        'Priority': analysisResults.metadata.radius ? `Radius: ${analysisResults.metadata.radius}m` : '',
        'Urgency Level': analysisResults.metadata.area ? `Area: ${analysisResults.metadata.area.toFixed(2)} sq meters` : '',
        'Description': '',
        'Location Name': '',
        'Latitude': '',
        'Longitude': '',
        'Reporter': '',
        'Created Date': '',
        'Updated Date': '',
        'Response Required': '',
        'Anonymous': ''
      });
      csvData.push({}); // Empty row separator
    }

    // Convert to CSV
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes in CSV
          return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw error;
  }
};

export const exportSpatialAnalysisToExcel = (analysisResults, fileName = 'spatial_analysis') => {
  try {
    if (!analysisResults || !analysisResults.complaints) {
      throw new Error('No analysis results to export');
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Prepare main data sheet
    const mainData = analysisResults.complaints.map(complaint => ({
      'Complaint ID': complaint.id,
      'Title': complaint.title || '',
      'Status': complaint.status || '',
      'Category': complaint.categories?.name || '',
      'Department': complaint.department_name || '',
      'Priority': complaint.priority || '',
      'Urgency Level': complaint.urgency_level || '',
      'Description': complaint.description || '',
      'Location Name': complaint.locationName || '',
      'Latitude': complaint.coordinates?.[1] || '',
      'Longitude': complaint.coordinates?.[0] || '',
      'Reporter': complaint.anonymous ? 'Anonymous' : (complaint.reported_by_name || `User #${complaint.reported_by}`),
      'Created Date': complaint.created_at || '',
      'Updated Date': complaint.updated_at || '',
      'Response Required': complaint.response_required ? 'Yes' : 'No',
      'Anonymous': complaint.anonymous ? 'Yes' : 'No'
    }));

    const mainSheet = XLSX.utils.json_to_sheet(mainData);

    // Add metadata sheet if available
    if (analysisResults.metadata) {
      const metadataData = [
        { Property: 'Analysis Type', Value: analysisResults.metadata.type || 'Unknown' },
        { Property: 'Total Complaints', Value: analysisResults.metadata.totalCount || 0 },
        { Property: 'Analysis Date', Value: new Date().toISOString() },
        { Property: 'Center Latitude', Value: analysisResults.metadata.center?.lat || '' },
        { Property: 'Center Longitude', Value: analysisResults.metadata.center?.lng || '' },
        { Property: 'Radius (meters)', Value: analysisResults.metadata.radius || '' },
        { Property: 'Area (sq meters)', Value: analysisResults.metadata.area || '' },
        { Property: 'Average Distance', Value: analysisResults.metadata.averageDistance || '' },
        { Property: 'Density (complaints/sq km)', Value: analysisResults.metadata.density || '' }
      ];

      const metadataSheet = XLSX.utils.json_to_sheet(metadataData);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Analysis Metadata');
    }

    // Add summary statistics sheet
    const statusCounts = {};
    const categoryCounts = {};
    const priorityCounts = {};
    
    analysisResults.complaints.forEach(complaint => {
      // Status counts
      const status = complaint.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Category counts
      const category = complaint.categories?.name || 'uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      
      // Priority counts
      const priority = complaint.priority || 'unspecified';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    const summaryData = [
      { 'Metric': 'STATUS DISTRIBUTION', 'Count': '', 'Percentage': '' },
      ...Object.entries(statusCounts).map(([status, count]) => ({
        'Metric': status.toUpperCase(),
        'Count': count,
        'Percentage': `${((count / analysisResults.complaints.length) * 100).toFixed(1)}%`
      })),
      { 'Metric': '', 'Count': '', 'Percentage': '' },
      { 'Metric': 'CATEGORY DISTRIBUTION', 'Count': '', 'Percentage': '' },
      ...Object.entries(categoryCounts).map(([category, count]) => ({
        'Metric': category.toUpperCase(),
        'Count': count,
        'Percentage': `${((count / analysisResults.complaints.length) * 100).toFixed(1)}%`
      })),
      { 'Metric': '', 'Count': '', 'Percentage': '' },
      { 'Metric': 'PRIORITY DISTRIBUTION', 'Count': '', 'Percentage': '' },
      ...Object.entries(priorityCounts).map(([priority, count]) => ({
        'Metric': priority.toUpperCase(),
        'Count': count,
        'Percentage': `${((count / analysisResults.complaints.length) * 100).toFixed(1)}%`
      }))
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary Statistics');

    // Add main data sheet last (will be the default view)
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'Complaints Data');

    // Export the workbook
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);

    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
};

export const exportComplaintsToCSV = (complaints, fileName = 'complaints_export') => {
  try {
    if (!complaints || complaints.length === 0) {
      throw new Error('No complaints to export');
    }

    return exportSpatialAnalysisToCSV({ complaints }, fileName);
  } catch (error) {
    console.error('Error exporting complaints to CSV:', error);
    throw error;
  }
};

export const exportComplaintsToExcel = (complaints, fileName = 'complaints_export') => {
  try {
    if (!complaints || complaints.length === 0) {
      throw new Error('No complaints to export');
    }

    return exportSpatialAnalysisToExcel({ 
      complaints,
      metadata: {
        type: 'Complaints Export',
        totalCount: complaints.length
      }
    }, fileName);
  } catch (error) {
    console.error('Error exporting complaints to Excel:', error);
    throw error;
  }
};
