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
| `josh-hero.jpg` | Header portrait (4:5, vertical) ✓ added |
| `josh-about.jpg` | About section (portrait frame) ✓ added |
| `social-tatum.jpg` | Social, Officer Tatum card (4:5) ✓ added |
| `social-sgt-care.png` | Social, Sgt. Care card (logo, shown uncropped on white) ✓ added |
| `social-amanchukwu.jpg` | Social, John Amanchukwu card (4:5) ✓ added |
| `social-why-files.jpg` | Social, The Why Files card (4:5) ✓ added |
| `dashboard.jpg` | AI Systems, replaces the built-in dashboard mockup (16:10) |
| `asset-*.jpg` | Brand Assets gallery (5 images; edit the list inside the Brand Assets tile in `index.html`) ✓ added |
| `og-image.jpg` | Link preview image when the site is shared (1200×630) |

To use a different file name or format (`.png`, `.webp`), change the `src` on the matching `<img>` in `index.html`.

## Brand tile previews

Every Brand tile uses an image saved in `assets/img/` (`site-*.jpg`, `trailer-ai-content.jpg`, `film-ai-still.jpg`, `asset-*.jpg`). To change one, replace the file or point that tile's `<img src>` at a new one.

## Change the look

Colors and fonts are tokens at the top of `assets/css/styles.css` (`--accent` is the amber highlight).
