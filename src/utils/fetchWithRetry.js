/**
 * Utility to fetch data from Supabase with automatic retry
 * 
 * @param {Function} queryFn - Function that returns a Supabase query
 * @param {Object} options - Options for retry
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.delayMs - Delay between retries in milliseconds
 * @returns {Promise} - Promise that resolves to the query result
 */
export const fetchWithRetry = async (queryFn, options = {}) => {
  const maxRetries = options.maxRetries || 3;
  const delayMs = options.delayMs || 1000;
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the query function
      const result = await queryFn();
      
      // If there's an error in the result, throw it
      if (result.error) {
        throw result.error;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Fetch attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
      
      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff: delay increases with each retry
        const waitTime = delayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
};
