# utm-link-builder

[![CI](https://github.com/lari-pellini/utm-link-builder/actions/workflows/ci.yml/badge.svg)](https://github.com/lari-pellini/utm-link-builder/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-native%20on%20Node-3178c6)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Build, bulk-generate and **lint** UTM campaign links so your GA4 reports stop showing `Instagram`, `instagram` and `IG` as three different sources.

Written in TypeScript and executed **directly by Node.js** (type stripping, Node ≥ 22.18) — no build step, no runtime dependencies.

> 🇧🇷 [Leia em português](#-português)

## Why

Messy UTMs are one of the most common reasons campaign reports don't add up:

- `utm_source=Instagram` and `utm_source=instagram` are **different values** in GA4
- spaces and accents turn into `%20` / `%C3%A3` noise
- a `utm_medium` GA4 doesn't recognise (e.g. `stories`) lands in **"Unassigned"**
- UTMs placed after a `#fragment` never reach the server

This tool normalises values when building links and warns you about all of the above when checking existing ones.

## Usage

```bash
# one link
node src/cli.ts build --url https://example.com/promo --source Instagram --medium social --campaign "Black Friday"
# https://example.com/promo?utm_source=instagram&utm_medium=social&utm_campaign=black-friday

# check links you already shared
node src/cli.ts lint "http://example.com/?utm_source=Instagram&utm_medium=stories"
#   ⚠️  url: Use https so the referrer and UTM values are not lost.
#   ⚠️  utm_campaign: utm_campaign is missing.
#   ⚠️  utm_source: "Instagram" has uppercase letters; reports are case-sensitive.
#   ⚠️  utm_medium: "stories" is not a medium GA4 recognises by default; ...

# use your team's allowed values (also auto-loaded from ./utm.config.json)
node src/cli.ts lint --config examples/utm.config.json \
  "https://example.com/?utm_source=newsletter&utm_medium=stories&utm_campaign=weekly"

# a whole campaign plan exported from Google Sheets
node src/cli.ts csv examples/campaigns.csv > links.csv
```

The optional JSON config accepts `allowedSources` and `allowedMediums` arrays. A configured medium list replaces GA4's built-in list; without it, the existing GA4 check remains in effect. See [examples/utm.config.json](examples/utm.config.json).

The CSV needs a `url` column plus any of `source`, `medium`, `campaign`, `content`, `term`. A `final_url` column is appended (or `ERROR: …` for incomplete rows). Use `--separator _` if your team prefers `black_friday`.

## As a library

```ts
import { buildUtmUrl, lintUtmUrl } from './src/utm.ts';

buildUtmUrl('https://shop.example/verao?color=blue', { source: 'Newsletter', medium: 'email', campaign: 'Promoção de Verão' });
// https://shop.example/verao?color=blue&utm_source=newsletter&utm_medium=email&utm_campaign=promocao-de-verao
```

## Development

```bash
npm install      # only for the type checker
npm test
npm run typecheck
```

Ideas for contributions: a tiny web UI or a Google Sheets Apps Script version. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🇧🇷 Português

Ferramenta para **criar, gerar em lote e validar links com UTM**, para que o GA4 pare de mostrar `Instagram`, `instagram` e `IG` como três origens diferentes.

- normaliza os valores (minúsculas, sem espaços e sem acentos: `Promoção de Verão` → `promocao-de-verao`);
- gera links em lote a partir de uma planilha CSV (Google Sheets / Excel);
- avisa sobre UTMs com letras maiúsculas, espaços, `utm_medium` que o GA4 não reconhece e parâmetros perdidos depois do `#`.

```bash
node src/cli.ts csv minha-campanha.csv > links.csv
```

## License

MIT © Larissa Pellini
