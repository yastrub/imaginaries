/**
 * Application configuration utilities
 */

/**
 * Get the admin email address from environment variables
 * @returns {string} The admin email address
 */
export function getAdminEmail() {
  return process.env.ADMIN_EMAIL || process.env.SMTP_USER;
}

/**
 * Get the application URL based on environment
 * @returns {string} The application URL
 */
export function getAppUrl() {
  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : process.env.APP_URL || 'https://imaginaries.app';
}

/**
 * Check for application updates
 * This is a placeholder function that could be implemented to check for updates
 * @returns {Promise<boolean>} Whether updates are available
 */
export async function checkForUpdates() {
  // This would be implemented to check for updates from a central server
  return false;
}
