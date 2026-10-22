# Josh Dillard — Growth Partner site

Static one-page site. No build step: open `index.html` in a browser, or deploy the folder to Netlify, Vercel or GitHub Pages as-is.

## Add your links

Edit the `SITE` block at the top of `assets/js/main.js`:

- `calendly`: every "Book a call" button opens this link.
- `videoSite`: shows the "See my video production work" link in the About section. It stays hidden until you add it.
- `social`: footer links. Any you leave empty stay hidden.

## Add your images

Drop files into `assets/img/` with these exact names. Each one replaces its placeholder automatically.

| File | Where it shows |
| --- | --- |
| `josh-hero.jpg` | Header portrait (4:5, vertical) |
| `josh-about.jpg` | About section (square) |
| `social-tatum.jpg` | Social, Officer Tatum card (4:5) ✓ added |
| `social-sgt-care.png` | Social, Sgt. Care card (logo, shown uncropped on white) ✓ added |
| `social-amanchukwu.jpg` | Social, John Amanchukwu card (4:5) ✓ added |
| `dashboard.jpg` | AI Systems, replaces the built-in dashboard mockup (16:10) |
| `brand-logo.jpg` | Brand, logo iteration (wide) |
| `brand-event.jpg` | Brand, event materials (tall) |
| `brand-website.jpg` | Brand, website |
| `brand-assets.jpg` | Brand, brand assets |
| `brand-merch.jpg` | Brand, merch & apparel |
| `brand-campaign.jpg` | Brand, campaign & print (wide) |
| `og-image.jpg` | Link preview image when the site is shared (1200×630) |

To use a different file name or format (`.png`, `.webp`), change the `src` on the matching `<img>` in `index.html`.

## Change the look

Colors and fonts are tokens at the top of `assets/css/styles.css` (`--accent` is the amber highlight).
