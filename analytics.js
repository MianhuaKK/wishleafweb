(() => {
  'use strict';
  // One owner for this event, even if the script is accidentally included twice.
  if (window.WishLeafAnalytics) return;

  const config = window.WishLeafAnalyticsConfig || {};
  const measurementId = config.measurementId || '';
  const configured = /^G-[A-Z0-9]+$/.test(measurementId);
  const consentKey = 'wishleaf.analytics-consent.v1';
  const debugKey = 'wishleaf.analytics-debug';
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;
  const adConsent = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  const locations = new Set(['navigation', 'hero', 'inline', 'footer']);
  const pagePath = window.location.pathname.replace(/\/index\.html$/, '/');
  const contentGroup = Object.hasOwn(config.pages || {}, pagePath) ? config.pages[pagePath] : null;
  let consent = readConsent();
  let started = false;
  let expiryTimer = null;
  let previousFocus = null;
  let debug = false;
  try { debug = window.sessionStorage.getItem(debugKey) === 'true'; } catch { /* Optional. */ }

  function privacySignal() {
    return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  }

  function readConsent() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(consentKey));
      if (saved && ['granted', 'denied'].includes(saved.value) &&
          Number.isFinite(saved.updatedAt) && Date.now() >= saved.updatedAt &&
          Date.now() - saved.updatedAt < consentLifetime) return saved;
    } catch { /* Unavailable storage means no persistent consent. */ }
    return null;
  }

  function mayCollect() {
    return configured && !!contentGroup && consent?.value === 'granted' &&
      Date.now() - consent.updatedAt < consentLifetime && !privacySignal();
  }

  function safeReferrer() {
    // Keep the referrer origin for search/referral attribution, never its search terms.
    try {
      const url = new URL(document.referrer);
      return ['https:', 'http:'].includes(url.protocol) ? url.origin + '/' : '';
    } catch { return ''; }
  }

  function pageParameters() {
    return {
      page_path: pagePath,
      page_location: window.location.origin + pagePath,
      page_referrer: safeReferrer(),
      page_title: document.title,
      content_group: contentGroup,
      ...(debug ? { debug_mode: true } : {})
    };
  }

  function clearAnalyticsCookies() {
    const hostParts = window.location.hostname.split('.');
    const domains = ['', ...hostParts.map((_, index) => hostParts.slice(index).join('.'))];
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (name !== '_ga' && !name.startsWith('_ga_')) return;
      domains.forEach(domain => {
        document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ''}`;
      });
    });
  }

  function syncCollection() {
    if (!configured) return;
    window.clearTimeout(expiryTimer);
    if (consent?.value === 'granted') {
      const remaining = consentLifetime - (Date.now() - consent.updatedAt);
      if (remaining > 0) {
        expiryTimer = window.setTimeout(() => {
          syncCollection();
          if (!mayCollect() && !privacySignal()) showPanel();
        }, Math.min(remaining, 2147483647));
      } else consent = null;
    }
    const allowed = mayCollect();
    window[`ga-disable-${measurementId}`] = !allowed;
    if (!allowed) {
      if (started) window.gtag('consent', 'update', { ...adConsent, analytics_storage: 'denied' });
      clearAnalyticsCookies();
      return;
    }
    if (started) {
      window.gtag('consent', 'update', { ...adConsent, analytics_storage: 'granted' });
      return;
    }
    // Do not take over another tag installation. Resolve ownership before enabling.
    if (window.gtag || window.google_tag_manager || document.querySelector('script[src*="googletagmanager.com/"]')) {
      window[`ga-disable-${measurementId}`] = true;
      console.warn('WishLeaf analytics: another Google tag exists; remove the duplicate installation before enabling.');
      return;
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ...adConsent, analytics_storage: 'denied' });
    window.gtag('consent', 'update', { ...adConsent, analytics_storage: 'granted' });
    window.gtag('set', {
      ...pageParameters(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      ...pageParameters(),
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: consentLifetime / 1000,
      cookie_update: false,
      cookie_path: '/'
    });
    started = true;
    window.gtag('event', 'page_view', { ...pageParameters(), send_to: measurementId });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(script);
  }

  function appStoreUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'apps.apple.com' && !url.port &&
          !url.username && !url.password && /\/id6762046509\/?$/.test(url.pathname)) return url.href;
    } catch { /* Invalid configuration falls back to the working download link. */ }
    return null;
  }

  function isAppStoreLink(link) { return link && appStoreUrl(link.href); }

  function ctaLocation(link) {
    const explicit = link.dataset.ctaLocation;
    if (locations.has(explicit)) return explicit;
    if (link.closest('footer, .closing')) return 'footer';
    if (link.closest('header')) return 'navigation';
    if (link.closest('.hero')) return 'hero';
    return 'inline';
  }

  function applyCampaignLink(link) {
    if (!isAppStoreLink(link)) return;
    const pageLinks = config.appStoreCampaigns?.[pagePath] || {};
    const destination = appStoreUrl(pageLinks[ctaLocation(link)]) ||
      appStoreUrl(pageLinks.default) || appStoreUrl(config.appStoreCampaignUrl);
    if (destination) link.href = destination;
  }

  function trackAppStoreClick(event) {
    // Keyboard activation produces click; middle mouse produces auxclick, not click.
    if (event.defaultPrevented || (event.type === 'click' && event.button !== 0) ||
        (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest?.('a[href]');
    if (!isAppStoreLink(link)) return;
    applyCampaignLink(link);
    if (!mayCollect() || !started || window[`ga-disable-${measurementId}`]) return;
    try {
      window.gtag('event', 'app_store_click', {
        ...pageParameters(),
        cta_location: ctaLocation(link),
        destination: 'App Store',
        send_to: measurementId,
        transport_type: 'beacon'
      });
    } catch { /* Navigation must work even when analytics fails. */ }
    // Native anchor navigation: no preventDefault, callbacks, promises, or timers.
  }

  window.WishLeafAnalytics = Object.freeze({
    setDebug(enabled) {
      debug = enabled === true;
      try {
        if (debug) window.sessionStorage.setItem(debugKey, 'true');
        else window.sessionStorage.removeItem(debugKey);
      } catch { /* This tab can still debug without storage. */ }
    }
  });

  document.querySelectorAll('a[href]').forEach(applyCampaignLink);
  document.addEventListener('click', trackAppStoreClick);
  document.addEventListener('auxclick', trackAppStoreClick);

  const panel = document.createElement('section');
  panel.className = 'wl-consent';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'wl-consent-title');
  panel.innerHTML = `
    <h2 id="wl-consent-title">Website analytics</h2>
    <p data-consent-description></p>
    <p><a href="/privacy/#website-analytics">Privacy policy</a></p>
    <div class="wl-consent-actions">
      <button type="button" data-consent="denied">Reject analytics</button>
      <button type="button" data-consent="granted">Allow analytics</button>
      <button type="button" data-consent-close>Close</button>
    </div>`;
  document.body.append(panel);
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'wl-privacy-settings';
  settings.textContent = 'Privacy settings';
  settings.setAttribute('aria-expanded', 'false');
  settings.setAttribute('aria-controls', 'wl-consent-panel');
  panel.id = 'wl-consent-panel';
  (document.querySelector('footer nav') || document.querySelector('footer') || document.body).append(settings);

  function showPanel(moveFocus = false) {
    const signal = privacySignal();
    panel.querySelector('[data-consent-description]').textContent = !configured
      ? 'Website analytics is currently disabled. No Google Analytics requests or analytics cookies are used.'
      : signal
        ? 'Your browser privacy preference is enabled. Website analytics stays off. You can still download WishLeaf.'
        : 'With your permission, Google Analytics uses cookies to measure public page visits and App Store button clicks. We do not send names, email addresses, or task content. Rejecting analytics does not affect downloads. You can change your choice here at any time.';
    panel.querySelector('[data-consent="granted"]').hidden = !configured || signal;
    panel.querySelector('[data-consent="denied"]').hidden = !configured || signal;
    panel.querySelector('[data-consent-close]').hidden = configured && !signal && !consent;
    panel.hidden = false;
    settings.setAttribute('aria-expanded', 'true');
    if (moveFocus) {
      previousFocus = document.activeElement;
      panel.querySelector('button:not([hidden])').focus();
    }
  }

  function hidePanel() {
    panel.hidden = true;
    settings.setAttribute('aria-expanded', 'false');
    if (panel.contains(document.activeElement)) (previousFocus || settings).focus();
    previousFocus = null;
  }

  settings.addEventListener('click', () => showPanel(true));
  panel.querySelector('[data-consent-close]').addEventListener('click', hidePanel);
  panel.querySelectorAll('[data-consent]').forEach(button => button.addEventListener('click', () => {
    consent = { value: button.dataset.consent, updatedAt: Date.now() };
    try { window.localStorage.setItem(consentKey, JSON.stringify(consent)); } catch { /* Session only. */ }
    syncCollection();
    hidePanel();
  }));
  window.addEventListener('storage', event => {
    if (event.key !== consentKey && event.key !== null) return;
    consent = readConsent();
    syncCollection();
    if (!consent && configured && !privacySignal()) showPanel();
    else hidePanel();
  });
  // Recheck expiry and browser preferences when a long-lived tab becomes active.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (consent && Date.now() - consent.updatedAt >= consentLifetime) consent = null;
    syncCollection();
    if (!consent && configured && !privacySignal()) showPanel();
  });

  syncCollection();
  if (configured && !consent && !privacySignal()) showPanel();
})();
