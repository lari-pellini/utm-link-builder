export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
  id?: string;
}

export interface BuildOptions {
  /** Character used to replace spaces. Defaults to "-". */
  separator?: '-' | '_';
  /** Lowercase every value. Defaults to true (GA4 treats "Email" and "email" as different mediums). */
  lowercase?: boolean;
  /** Remove accents ("Verão" → "verao") so links don't fill up with %C3%A3. Defaults to true. */
  stripAccents?: boolean;
}

/**
 * Mediums that GA4's default channel grouping recognises out of the box.
 * Anything else ends up in "Unassigned" unless you create a custom channel group.
 */
export const KNOWN_MEDIUMS = new Set([
  'cpc', 'ppc', 'paidsearch', 'paid-search', 'paid_search',
  'display', 'banner', 'cpm', 'expandable', 'interstitial',
  'email', 'e-mail', 'e_mail',
  'social', 'social-network', 'social-media', 'sm', 'social_network', 'social_media',
  'paid-social', 'paid_social', 'paidsocial',
  'organic', 'referral', 'affiliate', 'audio', 'sms', 'video', 'push', 'mobile', 'notification',
]);

export function normalize(value: string, options: BuildOptions = {}): string {
  const separator = options.separator ?? '-';
  let result = value.trim().replace(/\s+/g, separator);
  if (options.lowercase ?? true) result = result.toLowerCase();
  if (options.stripAccents ?? true) result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return result;
}

export function buildUtmUrl(baseUrl: string, params: UtmParams, options: BuildOptions = {}): string {
  for (const required of ['source', 'medium', 'campaign'] as const) {
    if (!params[required]?.trim()) throw new Error(`utm_${required} is required`);
  }
  const url = new URL(baseUrl);
  const entries: Array<[UtmKey, string | undefined]> = [
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

export function parseUtm(input: string): Partial<Record<UtmKey, string>> {
  const url = new URL(input);
  const found: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null) found[key] = value;
  }
  return found;
}

export interface LintWarning {
  key: UtmKey | 'url';
  message: string;
}

export interface LintOptions {
  /** When set, sources outside this team-specific list are warned about. */
  allowedSources?: readonly string[];
  /** When set, this replaces the built-in GA4 medium list. */
  allowedMediums?: readonly string[];
}

/** Finds the inconsistencies that usually make campaign reports messy. */
export function lintUtmUrl(input: string, options: LintOptions = {}): LintWarning[] {
  const warnings: LintWarning[] = [];
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return [{ key: 'url', message: 'Not a valid absolute URL.' }];
  }
  if (url.protocol !== 'https:') warnings.push({ key: 'url', message: 'Use https so the referrer and UTM values are not lost.' });

  const utm = parseUtm(input);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
    if (!utm[key]) warnings.push({ key, message: `${key} is missing.` });
  }
  for (const [key, value] of Object.entries(utm) as Array<[UtmKey, string]>) {
    if (value !== value.toLowerCase()) warnings.push({ key, message: `"${value}" has uppercase letters; reports are case-sensitive.` });
    if (/\s/.test(value)) warnings.push({ key, message: `"${value}" contains spaces.` });
  }
  if (utm.utm_source && options.allowedSources && !includesIgnoreCase(options.allowedSources, utm.utm_source)) {
    warnings.push({ key: 'utm_source', message: `"${utm.utm_source}" is not in the configured allowed sources list.` });
  }
  const allowedMediums = options.allowedMediums;
  const mediumNotAllowed = utm.utm_medium
    ? allowedMediums
      ? !includesIgnoreCase(allowedMediums, utm.utm_medium)
      : !KNOWN_MEDIUMS.has(utm.utm_medium.toLowerCase())
    : false;
  if (mediumNotAllowed) {
    const message = allowedMediums
      ? `"${utm.utm_medium}" is not in the configured allowed mediums list.`
      : `"${utm.utm_medium}" is not a medium GA4 recognises by default; traffic may show up as "Unassigned".`;
    warnings.push({ key: 'utm_medium', message });
  }
  if (url.hash.includes('utm_')) {
    warnings.push({ key: 'url', message: 'UTM parameters appear after the #fragment and will not be sent to the server.' });
  }
  return warnings;
}

function includesIgnoreCase(values: readonly string[], value: string): boolean {
  const normalized = value.toLowerCase();
  return values.some((candidate) => candidate.toLowerCase() === normalized);
}
