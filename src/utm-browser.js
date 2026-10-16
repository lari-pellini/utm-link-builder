// Browser-compatible copy of the dependency-free helpers in utm.ts.
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];

export const KNOWN_MEDIUMS = new Set([
  'cpc', 'ppc', 'paidsearch', 'paid-search', 'paid_search',
  'display', 'banner', 'cpm', 'expandable', 'interstitial',
  'email', 'e-mail', 'e_mail',
  'social', 'social-network', 'social-media', 'sm', 'social_network', 'social_media',
  'paid-social', 'paid_social', 'paidsocial',
  'organic', 'referral', 'affiliate', 'audio', 'sms', 'video', 'push', 'mobile', 'notification',
]);

export function normalize(value, options = {}) {
  const separator = options.separator ?? '-';
  let result = value.trim().replace(/\s+/g, separator);
  if (options.lowercase ?? true) result = result.toLowerCase();
  if (options.stripAccents ?? true) result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return result;
}

export function buildUtmUrl(baseUrl, params, options = {}) {
  for (const required of ['source', 'medium', 'campaign']) {
    if (!params[required]?.trim()) throw new Error(`utm_${required} is required`);
  }
  const url = new URL(baseUrl);
  const entries = [
    ['utm_source', params.source],
    ['utm_medium', params.medium],
    ['utm_campaign', params.campaign],
    ['utm_content', params.content],
    ['utm_term', params.term],
    ['utm_id', params.id],
  ];
  for (const [key, value] of entries) {
    if (value?.trim()) url.searchParams.set(key, normalize(value, options));
    else url.searchParams.delete(key);
  }
  return url.toString();
}

export function parseUtm(input) {
  const url = new URL(input);
  const found = {};
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) found[key] = value;
  }
  return found;
}

export function lintUtmUrl(input) {
  const warnings = [];
  let url;
  try {
    url = new URL(input);
  } catch {
    return [{ key: 'url', message: 'Not a valid absolute URL.' }];
  }
  if (url.protocol !== 'https:') warnings.push({ key: 'url', message: 'Use https so the referrer and UTM values are not lost.' });

  const utm = parseUtm(input);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    if (!utm[key]) warnings.push({ key, message: `${key} is missing.` });
  }
  for (const [key, value] of Object.entries(utm)) {
    if (value !== value.toLowerCase()) warnings.push({ key, message: `"${value}" has uppercase letters; reports are case-sensitive.` });
    if (/\s/.test(value)) warnings.push({ key, message: `"${value}" contains spaces.` });
  }
  if (utm.utm_medium && !KNOWN_MEDIUMS.has(utm.utm_medium.toLowerCase())) {
    warnings.push({ key: 'utm_medium', message: `"${utm.utm_medium}" is not a medium GA4 recognises by default; traffic may show up as "Unassigned".` });
  }
  if (url.hash.includes('utm_')) {
    warnings.push({ key: 'url', message: 'UTM parameters appear after the #fragment and will not be sent to the server.' });
  }
  return warnings;
}
