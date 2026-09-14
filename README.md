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

## Before launch

`CONFIG.siteUrl` is unset because no production domain was known at build time. Until it's filled in (e.g. `'https://www.sahomes4u.co.za'`, no trailing slash), pages use root-relative canonical URLs, `sitemap.xml` isn't generated, and social-preview tags (`og:image`, `og:url`, Twitter card) are omitted rather than built against a fabricated domain. Set it and re-run the generator once the domain is live.

## Production-readiness housekeeping already in place

- `assets/favicon.svg` — browser tab icon, referenced from every generated page.
- `404.html` — generated not-found page (works out of the box on hosts that look for `/404.html`, e.g. GitHub Pages, Netlify).
- `robots.txt` — allows crawling; gains a `Sitemap:` line automatically once `CONFIG.siteUrl` is set.
- `sitemap.xml` — generated once `CONFIG.siteUrl` is set (see above).
- Each property page carries `RealEstateListing` JSON-LD structured data (price, address, bed/bath counts, images) for richer search results.
