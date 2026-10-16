import type { BuildOptions, LintWarning, UtmParams, UtmKey } from './utm.ts';

export const UTM_KEYS: readonly UtmKey[];
export const KNOWN_MEDIUMS: ReadonlySet<string>;
export function normalize(value: string, options?: BuildOptions): string;
export function buildUtmUrl(baseUrl: string, params: UtmParams, options?: BuildOptions): string;
export function parseUtm(input: string): Partial<Record<UtmKey, string>>;
export function lintUtmUrl(input: string): LintWarning[];
