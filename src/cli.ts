#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCsv, toCsv } from './csv.ts';
import { buildUtmUrl, lintUtmUrl } from './utm.ts';
import type { LintOptions } from './utm.ts';

const HELP = `utm-link-builder

  Build one link:
    utm build --url https://example.com/promo --source instagram --medium social --campaign black-friday [--content story-1]

  Check an existing link:
    utm lint "https://example.com/?utm_source=Instagram&utm_medium=stories" [--config utm.config.json]

  Build links in bulk from a CSV (columns: url,source,medium,campaign,content,term):
    utm csv campaigns.csv > links.csv
`;

function readLintOptions(path: string, explicit: boolean): LintOptions {
  if (!existsSync(path)) {
    if (explicit) throw new Error(`Config file not found: ${path}`);
    return {};
  }

  let config: unknown;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read config file ${path}: ${(err as Error).message}`);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('UTM config must be a JSON object');
  }

  const readList = (key: 'allowedSources' | 'allowedMediums'): string[] | undefined => {
    const value = (config as Record<string, unknown>)[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error(`UTM config "${key}" must be an array of non-empty strings`);
    }
    return value.map((item: string) => item.trim());
  };

  return { allowedSources: readList('allowedSources'), allowedMediums: readList('allowedMediums') };
}

export function run(argv: string[]): { output: string; ok: boolean } {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      source: { type: 'string' },
      medium: { type: 'string' },
      campaign: { type: 'string' },
      content: { type: 'string' },
      term: { type: 'string' },
      separator: { type: 'string', default: '-' },
      config: { type: 'string' },
    },
  });
  const separator = values.separator === '_' ? '_' : '-';
  if (values.config && command !== 'lint') throw new Error('--config can only be used with lint');

  if (command === 'build') {
    if (!values.url) throw new Error('--url is required');
    const link = buildUtmUrl(
      values.url,
      { source: values.source ?? '', medium: values.medium ?? '', campaign: values.campaign ?? '', content: values.content, term: values.term },
      { separator },
    );
    return { output: link, ok: true };
  }

  if (command === 'lint') {
    if (!positionals.length) throw new Error('Pass at least one link to check');
    const configPath = values.config ?? 'utm.config.json';
    const lintOptions = readLintOptions(configPath, values.config !== undefined);
    let ok = true;
    const report = positionals.map((link) => {
      const warnings = lintUtmUrl(link, lintOptions);
      if (warnings.length) ok = false;
      return [link, ...(warnings.length ? warnings.map((w) => `  ⚠️  ${w.key}: ${w.message}`) : ['  ✅ No problems found.'])].join('\n');
    });
    return { output: report.join('\n\n'), ok };
  }

  if (command === 'csv') {
    if (!positionals[0]) throw new Error('Pass the path to a CSV file');
    const [header, ...rows] = parseCsv(readFileSync(positionals[0], 'utf8'));
    const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
    const index = { url: col('url'), source: col('source'), medium: col('medium'), campaign: col('campaign'), content: col('content'), term: col('term') };
    if (index.url < 0) throw new Error('CSV needs a "url" column');
    const out = [[...header, 'final_url']];
    for (const row of rows) {
      const cell = (i: number) => (i >= 0 ? row[i] ?? '' : '');
      let finalUrl: string;
      try {
        finalUrl = buildUtmUrl(
          cell(index.url),
          { source: cell(index.source), medium: cell(index.medium), campaign: cell(index.campaign), content: cell(index.content), term: cell(index.term) },
          { separator },
        );
      } catch (err) {
        finalUrl = `ERROR: ${(err as Error).message}`;
      }
      out.push([...row, finalUrl]);
    }
    return { output: toCsv(out).trimEnd(), ok: true };
  }

  return { output: HELP, ok: command === undefined };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { output, ok } = run(process.argv.slice(2));
    console.log(output);
    process.exitCode = ok ? 0 : 1;
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
