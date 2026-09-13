# SA Homes 4U

A static property-sales website for SA Homes 4U, generated from `data/properties.json`.

## Structure

- `index.html`, `properties.html`, `about.html`, `sell-with-us.html`, `contact.html`, `properties/*.html` — generated pages. **Do not hand-edit these** — edit `scripts/generate.js` and re-run it instead, or your changes will be overwritten.
- `scripts/generate.js` — the site generator. Reads `data/properties.json` and produces every HTML page (header/footer/nav are defined once here).
- `data/properties.json` — factual source of truth for all listings (see `references/SOURCES.md`).
- `assets/properties/` — local property photos (WebP), referenced by `data/properties.json`.
- `assets/css/style.css`, `assets/js/main.js` — shared styles and behavior (nav, filters, gallery lightbox).
- `references/` — design authority docs (`hero-reference.png`, `SOURCES.md`).

## Regenerating the site

After changing `data/properties.json` (or the generator itself), rebuild every page with:

```
node scripts/generate.js
```

To preview locally:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/index.html`.

## Before launch

`scripts/generate.js` has a `CONFIG` block at the top with **placeholder** business contact details (WhatsApp number, phone, email, address) — none of this was present in the source data, so it must be replaced with SA Homes 4U's real contact details before going live. Re-run the generator after editing it.
