// Subscription plan IDs
export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  BUSINESS: 'business'
};

// Plan configurations
export const planConfigs = {
  [PLANS.FREE]: {
    name: 'Free',
    maxGenerationsPerDay: 5,
    requiresWatermark: true,
    allowPrivateImages: false,
    allowCamera: false,
    price: 0,
  },
  [PLANS.PRO]: {
    name: 'Pro',
    maxGenerationsPerDay: 100,
    requiresWatermark: true,
    allowPrivateImages: true,
    allowCamera: true,
    price: 9.99,
  },
  [PLANS.BUSINESS]: {
    name: 'Business',
    maxGenerationsPerDay: 200,
    requiresWatermark: false,
    allowPrivateImages: true,
    allowCamera: true,
    price: 29.99,
  }
};

// Helper functions
export function getPlanConfig(planId) {
  return planConfigs[planId] || planConfigs[PLANS.FREE];
}

export function getMaxGenerations(planId) {
  return getPlanConfig(planId).maxGenerationsPerDay;
}

export function requiresWatermark(planId) {
  return getPlanConfig(planId).requiresWatermark;
}

export function allowPrivateImages(planId) {
  return getPlanConfig(planId).allowPrivateImages;
}

export function allowCamera(planId) {
  return getPlanConfig(planId).allowCamera === true;
}