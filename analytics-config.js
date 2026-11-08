// Public website configuration. No API secret belongs in this file.
window.WishLeafAnalyticsConfig = Object.freeze({
  // Paste the GA4 web stream Measurement ID (G-...) here. Empty = no Google requests.
  measurementId: '',

  // Paste a COMPLETE Campaign Link generated in App Store Connect, or leave empty.
  // Never invent pt/ct/mt tokens. Empty/invalid values keep the original App Store URL.
  appStoreCampaignUrl: '',
  // Optional overrides, keyed by canonical page path, then CTA location or "default".
  // '/features/action-start/': { hero: '', footer: '', default: '' }
  appStoreCampaigns: {},

  // Public editorial routes only. Add new content here before enabling its analytics.
  // This allowlist prevents arbitrary URL paths, queries, and fragments entering GA4.
  pages: {
    '/': 'home',
    '/features/action-start/': 'task_start',
    '/features/goal-progress/': 'progress_tracking',
    '/behind-wishleaf/': 'brand_story',
    '/privacy/': 'privacy',
    '/terms/': 'terms',
    '/support/': 'support'
  }
});
