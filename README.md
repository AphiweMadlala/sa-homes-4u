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

## Contact channels

`scripts/generate.js`'s `CONFIG` block holds SA Homes 4U's two confirmed contact channels — email (`sa.houses4u@gmail.com`) and Instagram (`@sa_homes4u`) — used everywhere a contact action appears (header, footer, property enquiries, Contact, Sell With Us). No phone number, WhatsApp number, or physical address has been supplied, so none is published; add one to `CONFIG` and wire it into the relevant templates only once SA Homes 4U provides it.

## Deployment

The site is hosted on GitHub Pages as a **project site** (repo `AphiweMadlala/sa-homes-4u`, not a `<user>.github.io` repo), which serves from a `/sa-homes-4u` subpath rather than the domain root:

**https://aphiwemadlala.github.io/sa-homes-4u/**

`CONFIG.siteUrl` in `scripts/generate.js` is set to that full URL (subpath included), which drives the absolute canonical URLs, `sitemap.xml`, `robots.txt`'s `Sitemap:` line, and social-preview tags (`og:image`, `og:url`, Twitter card). Every other link and asset reference in the generated pages (nav, logo, property cards, images, CSS/JS) is written relative to the page it's on via each template's `root` variable — never a domain-root-absolute `/…` path — specifically so the site works correctly under a subpath like this one. If SA Homes 4U ever moves to their own domain, update `CONFIG.siteUrl` to the new root (no trailing slash, no subpath) and re-run the generator; nothing else needs to change.

## Production-readiness housekeeping already in place

- `assets/favicon.svg` — browser tab icon, referenced from every generated page.
- `404.html` — generated not-found page (works out of the box on hosts that look for `/404.html`, e.g. GitHub Pages, Netlify).
- `robots.txt` — allows crawling; gains a `Sitemap:` line automatically once `CONFIG.siteUrl` is set.
- `sitemap.xml` — generated once `CONFIG.siteUrl` is set (see above).
- Each property page carries `RealEstateListing` JSON-LD structured data (price, address, bed/bath counts, images) for richer search results.
