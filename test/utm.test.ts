import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.ts';
import { parseCsv, toCsv } from '../src/csv.ts';
import { buildUtmUrl, lintUtmUrl, normalize, parseUtm } from '../src/utm.ts';
import * as browserUtm from '../src/utm-browser.js';

test('normalize trims, lowercases and replaces spaces', () => {
  assert.equal(normalize('  Black Friday 2026 '), 'black-friday-2026');
  assert.equal(normalize('Black Friday', { separator: '_' }), 'black_friday');
  assert.equal(normalize('Black Friday', { lowercase: false }), 'Black-Friday');
  assert.equal(normalize('Promoção de Verão'), 'promocao-de-verao');
});

test('buildUtmUrl keeps existing query params and the fragment', () => {
  const url = buildUtmUrl('https://example.com/shop?color=blue#reviews', {
    source: 'Instagram',
    medium: 'social',
    campaign: 'Black Friday',
    content: 'story 1',
  });
  assert.equal(url, 'https://example.com/shop?color=blue&utm_source=instagram&utm_medium=social&utm_campaign=black-friday&utm_content=story-1#reviews');
});

test('buildUtmUrl replaces old UTM values instead of duplicating them', () => {
  const url = buildUtmUrl('https://example.com/?utm_source=old&utm_term=shoes', { source: 'newsletter', medium: 'email', campaign: 'weekly' });
  assert.deepEqual(parseUtm(url), { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'weekly' });
});

test('browser UTM helpers stay in sync with the CLI implementation', () => {
  const base = 'https://example.com/shop?color=blue&utm_source=old#reviews';
  const params = { source: 'Newsletter', medium: 'Email', campaign: 'Promoção de Verão', content: 'Story 1' };
  const built = buildUtmUrl(base, params);
  assert.equal(browserUtm.buildUtmUrl(base, params), built);
  assert.deepEqual(browserUtm.parseUtm(built), parseUtm(built));
  assert.deepEqual(browserUtm.lintUtmUrl(built), lintUtmUrl(built));
});

test('buildUtmUrl requires source, medium and campaign', () => {
  assert.throws(() => buildUtmUrl('https://example.com', { source: 'google', medium: '', campaign: 'x' }), /utm_medium is required/);
});

test('lintUtmUrl flags messy links', () => {
  const warnings = lintUtmUrl('http://example.com/?utm_source=Instagram&utm_medium=stories');
  const messages = warnings.map((w) => `${w.key}: ${w.message}`).join('\n');
  assert.match(messages, /url: Use https/);
  assert.match(messages, /utm_campaign is missing/);
  assert.match(messages, /utm_source: "Instagram" has uppercase/);
  assert.match(messages, /utm_medium: "stories" is not a medium GA4 recognises/);
});

test('lintUtmUrl spots UTMs hidden in the fragment', () => {
  const warnings = lintUtmUrl('https://example.com/#/promo?utm_source=x&utm_medium=email&utm_campaign=y');
  assert.ok(warnings.some((w) => /after the #fragment/.test(w.message)));
});

test('lintUtmUrl is quiet for a clean link', () => {
  assert.deepEqual(lintUtmUrl('https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest'), []);
});

test('csv round trip handles quotes and commas', () => {
  const rows = parseCsv('a,b\n"hello, world","say ""hi"""\n');
  assert.deepEqual(rows, [['a', 'b'], ['hello, world', 'say "hi"']]);
  assert.equal(toCsv(rows), 'a,b\n"hello, world","say ""hi"""\n');
});

test('cli csv builds links in bulk', () => {
  const file = fileURLToPath(new URL('../examples/campaigns.csv', import.meta.url));
  const { output } = run(['csv', file]);
  const [header, first, , broken] = parseCsv(output);
  assert.equal(header.at(-1), 'final_url');
  assert.equal(first.at(-1), 'https://loja.example.com/colecao-verao?utm_source=instagram&utm_medium=social&utm_campaign=verao-2026&utm_content=reels-01');
  assert.equal(broken.at(-1), 'ERROR: utm_source is required');
});
