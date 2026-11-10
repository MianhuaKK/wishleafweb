const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'analytics.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'analytics-config.js'), 'utf8');
const storeUrl = 'https://apps.apple.com/us/app/wishleaf/id6762046509';
const consentKey = 'wishleaf.analytics-consent.v1';
const lifetime = 180 * 86400000;

// Small browser boundary: verifies our DOM/event/gtag contract, not Google's SDK.
class Element {
  constructor(tag = 'div', attrs = {}, parent = null) {
    this.tagName = tag;
    this.attrs = attrs;
    this.dataset = attrs.dataset || {};
    this.parent = parent;
    this.children = [];
    this.handlers = {};
    this.hidden = false;
    this.href = attrs.href;
  }
  append(child) { child.parent = this; this.children.push(child); }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
  fire(name, event = {}) { for (const fn of this.handlers[name] || []) fn(event); }
  contains(el) { return el === this || this.children.some(child => child.contains(el)); }
  focus() { this.doc.activeElement = this; }
  closest(selector) {
    if (selector === 'a[href]' && this.tagName === 'a' && this.href) return this;
    if (selector.split(', ').some(item => item === this.tagName || item === this.attrs.section)) return this;
    return this.parent?.closest(selector) || null;
  }
  set innerHTML(_) {
    this.description = new Element('p');
    this.allow = new Element('button', { dataset: { consent: 'granted' } });
    this.deny = new Element('button', { dataset: { consent: 'denied' } });
    this.close = new Element('button');
    for (const child of [this.description, this.deny, this.allow, this.close]) {
      child.doc = this.doc;
      this.append(child);
    }
  }
  querySelector(selector) {
    return {
      '[data-consent-description]': this.description,
      '[data-consent="granted"]': this.allow,
      '[data-consent="denied"]': this.deny,
      '[data-consent-close]': this.close,
      'button:not([hidden])': [this.deny, this.allow, this.close].find(el => !el.hidden)
    }[selector] || null;
  }
  querySelectorAll(selector) { return selector === '[data-consent]' ? [this.deny, this.allow] : []; }
}

function boot(options = {}) {
  const document = new Element('document');
  document.title = 'WishLeaf';
  document.referrer = options.referrer || 'https://www.google.com/search?q=private-text';
  document.head = new Element('head');
  document.body = new Element('body');
  document.footer = new Element('footer');
  document.footer.doc = document;
  document.activeElement = document.body;
  document.hidden = false;
  const cookies = new Map([['_ga', 'test'], ['_ga_LOCALTEST', 'test'], ['essential', 'keep']]);
  Object.defineProperty(document, 'cookie', {
    get: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    set: value => { if (value.includes('Max-Age=0')) cookies.delete(value.split('=')[0]); }
  });
  const hero = new Element('section', { section: '.hero' });
  const anchor = new Element('a', { href: storeUrl, dataset: { ctaLocation: 'hero' } }, hero);
  const nested = new Element('span', {}, anchor);
  document.createElement = tag => { const el = new Element(tag); el.doc = document; return el; };
  document.querySelector = selector => selector.startsWith('script[') ? (options.foreignScript ? {} : null) : document.footer;
  document.querySelectorAll = selector => selector === 'a[href]' ? [anchor] : [];
  const storage = new Map();
  if (options.saved) storage.set(consentKey, JSON.stringify(options.saved));
  const session = new Map();
  const storageApi = map => ({
    getItem: key => { if (options.storageBlocked) throw Error('blocked'); return map.get(key) || null; },
    setItem: (key, value) => { if (options.storageBlocked) throw Error('blocked'); map.set(key, value); },
    removeItem: key => map.delete(key)
  });
  const timers = new Map();
  const warnings = [];
  let now = Date.now();
  const window = new Element('window');
  Object.assign(window, {
    location: new URL(options.url || 'https://wishleaf.app/features/action-start/?email=private@example.test#private-task'),
    localStorage: storageApi(storage), sessionStorage: storageApi(session),
    setTimeout: (fn, ms) => { const id = timers.size + 1; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  if (options.gtag) window.gtag = options.gtag;
  const context = vm.createContext({
    window, document, navigator: options.navigator || {}, URL,
    console: { warn: message => warnings.push(message) },
    Date: class extends Date { static now() { return now; } }
  });
  vm.runInContext(configSource, context);
  window.WishLeafAnalyticsConfig = { ...window.WishLeafAnalyticsConfig, measurementId: 'G-LOCALTEST', ...options.config };
  vm.runInContext(source, context);
  const panel = document.body.children[0];
  const click = (target = nested, overrides = {}) => {
    const event = { type: 'click', button: 0, target, defaultPrevented: false, ...overrides };
    document.fire(event.type, event);
    return event;
  };
  const queue = () => Array.from(window.dataLayer || [], args => Array.from(args));
  const events = name => queue().filter(args => args[0] === 'event' && args[1] === name);
  return {
    window, document, panel, anchor, nested, storage, cookies, timers, warnings, context, click, queue, events,
    allow: () => panel.allow.fire('click'), deny: () => panel.deny.fire('click'),
    advance: ms => { now += ms; }
  };
}

test('empty measurement ID makes no Google calls, yet downloads still work', () => {
  const b = boot({ config: { measurementId: '' } });
  assert.equal(b.panel.hidden, true);
  assert.equal(b.window.gtag, undefined);
  assert.equal(b.document.head.children.length, 0);
  assert.equal(b.click().defaultPrevented, false);
  assert.equal(b.anchor.href, storeUrl);
  b.document.footer.children[0].fire('click');
  assert.equal(b.panel.hidden, false);
  assert.equal(b.panel.allow.hidden, true);
});

test('consent gates initialization, never replays earlier clicks, and sends sanitized parameters', () => {
  const b = boot();
  b.click();
  assert.equal(b.queue().length, 0);
  b.allow();
  assert.equal(b.document.head.children.length, 1);
  assert.equal(b.events('page_view').length, 1);
  assert.equal(b.events('app_store_click').length, 0);
  assert.equal(b.panel.hidden, true);
  assert.equal(b.click().defaultPrevented, false);
  const payload = b.events('app_store_click')[0][2];
  assert.equal(payload.page_path, '/features/action-start/');
  assert.equal(payload.content_group, 'task_start');
  assert.equal(payload.cta_location, 'hero');
  assert.equal(payload.destination, 'App Store');
  assert.equal(payload.page_location, 'https://wishleaf.app/features/action-start/');
  assert.equal(payload.page_referrer, 'https://www.google.com/');
  assert.equal(payload.send_to, 'G-LOCALTEST');
  assert.equal(payload.transport_type, 'beacon');
  assert.doesNotMatch(JSON.stringify(b.queue()), /private|@|search\?q/);
  const defaults = b.queue().find(args => args[0] === 'consent' && args[1] === 'default')[2];
  assert.equal(defaults.analytics_storage, 'denied');
  assert.equal(defaults.ad_user_data, 'denied');
  assert.equal(b.queue().filter(args => args[0] === 'config').length, 1);
});

test('reject, revoke, and reallow do not duplicate initialization; removes only analytics cookies', () => {
  const b = boot();
  b.deny(); b.click();
  assert.equal(b.queue().length, 0);
  b.allow(); b.click(); b.deny(); b.click();
  assert.equal(b.events('app_store_click').length, 1);
  assert.equal(b.window['ga-disable-G-LOCALTEST'], true);
  assert.equal(b.cookies.has('_ga'), false);
  assert.equal(b.cookies.get('essential'), 'keep');
  b.allow(); b.click();
  assert.equal(b.events('app_store_click').length, 2);
  assert.equal(b.events('page_view').length, 1);
  assert.equal(b.document.head.children.length, 1);
});

test('saved consent, malformed/expired state, and unavailable storage are handled safely', () => {
  assert.equal(boot({ saved: { value: 'granted', updatedAt: Date.now() } }).events('page_view').length, 1);
  for (const saved of [
    { value: 'granted', updatedAt: Date.now() - lifetime - 1 },
    { value: 'granted', updatedAt: 'invalid' },
    { value: 'granted', updatedAt: Date.now() + lifetime },
    { value: 'yes', updatedAt: Date.now() }
  ]) assert.equal(boot({ saved }).queue().length, 0);
  const b = boot({ storageBlocked: true });
  b.allow(); b.click();
  assert.equal(b.events('app_store_click').length, 1);
});

test('GPC and Do Not Track override consent', () => {
  for (const navigator of [{ globalPrivacyControl: true }, { doNotTrack: '1' }]) {
    const b = boot({ navigator, saved: { value: 'granted', updatedAt: Date.now() } });
    b.click();
    assert.equal(b.queue().length, 0);
    assert.equal(b.window['ga-disable-G-LOCALTEST'], true);
    b.document.footer.children[0].fire('click');
    assert.equal(b.panel.allow.hidden, true);
  }
});

test('cross-tab withdrawal and consent removal stop collection', () => {
  const b = boot(); b.allow(); b.click();
  b.storage.set(consentKey, JSON.stringify({ value: 'denied', updatedAt: Date.now() }));
  b.window.fire('storage', { key: consentKey }); b.click();
  assert.equal(b.events('app_store_click').length, 1);
  assert.equal(b.window['ga-disable-G-LOCALTEST'], true);
  b.storage.clear(); b.window.fire('storage', { key: null });
  assert.equal(b.panel.hidden, false);
});

test('long-lived tabs stop collection when consent expires', () => {
  const b = boot(); b.allow();
  b.advance(lifetime + 1);
  b.click();
  assert.equal(b.events('app_store_click').length, 0);
  [...b.timers.values()][0].fn();
  assert.equal(b.window['ga-disable-G-LOCALTEST'], true);
  assert.equal(b.panel.hidden, false);
});

test('a repeated script, nested click, Enter, modified click and middle click count once each', () => {
  const b = boot(); b.allow();
  vm.runInContext(source, b.context);
  b.click();
  b.click(b.nested, { detail: 0 }); // Enter/native keyboard click.
  b.click(b.nested, { ctrlKey: true });
  b.click(b.nested, { type: 'auxclick', button: 1 });
  b.click(b.nested, { type: 'auxclick', button: 2 });
  b.click(b.nested, { defaultPrevented: true });
  assert.equal(b.events('app_store_click').length, 4);
  assert.equal(b.document.handlers.click.length, 1);
  assert.equal(b.events('click').length, 0); // Never manually sends GA's auto outbound event.
});

test('analytics errors never cancel native navigation', () => {
  const b = boot(); b.allow();
  b.window.gtag = () => { throw Error('blocked'); };
  const event = b.click();
  assert.equal(event.defaultPrevented, false);
  assert.equal(b.anchor.href, storeUrl);
});

test('campaign overrides preserve the complete configured link and work without consent or GA', () => {
  // Opaque fixture only, never requested or offered as a generated Apple campaign.
  const campaign = storeUrl + '?fixture=opaque%20value&keep=1';
  const b = boot({ config: {
    measurementId: '', appStoreCampaignUrl: storeUrl + '?fixture=global',
    appStoreCampaigns: { '/features/action-start/': { hero: campaign, default: storeUrl + '?fixture=page' } }
  } });
  assert.equal(b.anchor.href, campaign);
  b.anchor.dataset.ctaLocation = 'inline'; b.click();
  assert.equal(b.anchor.href, storeUrl + '?fixture=page');
  assert.equal(b.queue().length, 0);
});

test('invalid campaign destinations fall back to working original links', () => {
  for (const destination of ['javascript:alert(1)', 'https://evil.test/id6762046509',
    'https://apps.apple.com/app/id123', 'https://user:pass@apps.apple.com/app/id6762046509',
    'http://apps.apple.com/app/id6762046509', 'https://apps.apple.com:444/app/id6762046509']) {
    const b = boot({ config: { appStoreCampaignUrl: destination } });
    assert.equal(b.anchor.href, storeUrl);
  }
});

test('unknown routes and other app destinations are not tracked; index.html is normalized', () => {
  const unknown = boot({ url: 'https://wishleaf.app/private/user@example.test/' });
  unknown.allow(); unknown.click();
  assert.equal(unknown.queue().length, 0);
  const home = boot({ url: 'https://wishleaf.app/index.html?private=true' });
  home.allow(); home.click();
  assert.equal(home.events('app_store_click')[0][2].page_path, '/');
  assert.equal(home.events('app_store_click')[0][2].content_group, 'home');
  home.anchor.href = 'https://apps.apple.com/app/id123'; home.click();
  assert.equal(home.events('app_store_click').length, 1);
});

test('unannotated future links use section fallback and debug is opt-in', () => {
  const b = boot(); b.allow();
  b.anchor.dataset = {};
  b.anchor.parent = new Element('section', { section: '.closing' });
  b.click();
  assert.equal(b.events('app_store_click')[0][2].cta_location, 'footer');
  assert.equal('debug_mode' in b.events('app_store_click')[0][2], false);
  b.window.WishLeafAnalytics.setDebug(true); b.click();
  assert.equal(b.events('app_store_click')[1][2].debug_mode, true);
  b.window.WishLeafAnalytics.setDebug(false); b.click();
  assert.equal('debug_mode' in b.events('app_store_click')[2][2], false);
});

test('another Google tag is not initialized a second time', () => {
  for (const options of [{ gtag: () => {} }, { foreignScript: true }]) {
    const b = boot(options); b.allow(); b.click();
    assert.equal(b.document.head.children.length, 0);
    assert.equal(b.events('app_store_click').length, 0);
    assert.equal(b.warnings.length, 1);
  }
});

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.name.startsWith('.') ? [] : entry.isDirectory() ? htmlFiles(path.join(dir, entry.name)) :
      entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
}

test('every static page loads shared assets once and every download entry has a location', () => {
  let downloadCount = 0;
  for (const file of htmlFiles(root)) {
    const html = fs.readFileSync(file, 'utf8');
    const route = '/' + path.relative(root, file).replaceAll(path.sep, '/').replace(/index\.html$/, '');
    const browser = boot({ url: 'https://wishleaf.app' + route });
    browser.allow();
    const base = /<base href="([^"]+)"/.exec(html)?.[1] || './';
    for (const asset of ['analytics-config.js', 'analytics.js', 'analytics.css']) {
      const matches = [...html.matchAll(new RegExp(`(?:src|href)="([^"]*${asset.replace('.', '\\.')})"`, 'g'))];
      assert.equal(matches.length, 1, `${file}: ${asset}`);
      assert.equal(fs.existsSync(path.resolve(path.dirname(file), base, matches[0][1])), true, `${file}: asset resolves`);
    }
    assert.ok(html.indexOf('analytics-config.js') < html.indexOf('analytics.js'));
    for (const [tag] of html.matchAll(/<a\b[^>]*href="https:\/\/apps\.apple\.com\/[^\"]+"[^>]*>/g)) {
      downloadCount++;
      assert.match(tag, /data-app-store/);
      assert.match(tag, /data-cta-location="(hero|inline|footer|navigation)"/);
      assert.doesNotMatch(tag, /onclick=/);
      browser.anchor.dataset.ctaLocation = /data-cta-location="([^"]+)"/.exec(tag)[1];
      browser.click();
      const payload = browser.events('app_store_click').at(-1)[2];
      assert.equal(payload.page_path, route);
      assert.equal(payload.content_group, browser.window.WishLeafAnalyticsConfig.pages[route]);
      assert.equal(payload.cta_location, browser.anchor.dataset.ctaLocation);
    }
  }
  assert.equal(downloadCount, 14);
});
