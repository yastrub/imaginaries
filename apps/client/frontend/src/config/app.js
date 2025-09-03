export const APP_VERSION = '0.2';
export const APP_STATUS = 'beta';

// Format the version string with status
export const getVersionString = () => `v${APP_VERSION} (${APP_STATUS})`;

// Check for app updates
export const checkForUpdates = () => {
  const storedVersion = localStorage.getItem('app_version');
  
  // If no version is stored, this is a first-time visit
  if (!storedVersion) {
    localStorage.setItem('app_version', APP_VERSION);
    return null;
  }

  // If versions don't match, we have an update
  if (storedVersion !== APP_VERSION) {
    localStorage.setItem('app_version', APP_VERSION);
    return {
      from: storedVersion,
      to: APP_VERSION
    };
  }

  return null;
};