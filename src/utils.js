// Utility functions for document operations
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

export const generateThumbnail = (file) => {
  // In a real implementation, this would generate a thumbnail from the PDF
  // For now, we'll return a placeholder SVG as a data URL
  const svg = `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="5" fill="#f40f02"/>
      <rect width="100" height="30" rx="5" fill="#d40d04"/>
      <text x="50" y="70" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="20">PDF</text>
    </svg>
  `;
  // Properly encode the SVG string for use in a data URL
  const svgString = encodeURIComponent(svg.trim());
  return `data:image/svg+xml;charset=UTF-8,${svgString}`;
};