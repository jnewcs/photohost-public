# Saumya Singhal Photography — public site

Static marketing site for https://saumyasinghal.photography. No build step:
plain HTML, CSS, and JavaScript, served by GitHub Pages from the `main` branch
root.

## Local preview

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Contact form

The form posts to the PhotoHost app:

- Endpoint: `https://photohost-production.up.railway.app/api/contact`
- Configured in `js/config.js`
- Protected by Cloudflare Turnstile (site key in `js/config.js`)

The PhotoHost backend stores each inquiry and emails `STUDIO_EMAIL` (see the
PhotoHost README for `STUDIO_EMAIL`, `TURNSTILE_SECRET_KEY`, and
`CONTACT_ALLOWED_ORIGINS`).

## Deploy

1. Push this repository to GitHub as a public repo.
2. In **Settings → Pages**, set **Source** to **Deploy from a branch**, branch
   `main`, folder `/ (root)`.
3. `CNAME` already contains `saumyasinghal.photography`.
4. In Cloudflare DNS for the domain:
   - Apex `A` records to GitHub Pages: `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - `www` `CNAME` to `<github-user>.github.io`
   - Keep both **DNS only** (grey cloud) until GitHub finishes issuing the
     certificate, then you can re-enable proxying if desired.
5. In the Turnstile widget settings, add `saumyasinghal.photography`,
   `www.saumyasinghal.photography`, and `localhost`.

## Updating photos

Images live in `assets/images/` as compressed JPEGs (max ~1600px, cover
~2400px). Keep the existing filenames (`proposal-1.jpg`, `engagement-3.jpg`,
etc.) when replacing them.

`terms-&-conditions/` is a redirect for the old encoded terms URL; the
canonical page is `terms-conditions/`.
