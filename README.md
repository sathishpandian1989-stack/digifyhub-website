# Digifyhub — Agency Website

**Dream Big. Start Smart. Grow Digitally.**

A fast, responsive website for the Digifyhub digital marketing agency. It works on laptop, tablet and mobile, uses the logo palette (deep navy, blue/cyan, teal/green and a small amber accent), and has a lead form connected to Google Sheets and email through Google Apps Script.

## What's inside

```
docs/                  ← the live website (GitHub Pages serves this folder)
  index.html … terms.html
  assets/css/styles.css
  assets/js/main.js    ← menu, animations, lead form logic
  assets/js/config.js  ← paste your Apps Script Web App URL here
  assets/img/          ← logo, favicon, page banners
  assets/video/        ← put hero.mp4 here (see below)
src/                   ← page sources + shared header/footer/form
  site.json            ← page titles, meta descriptions, nav, contact & social links
build.mjs              ← zero-dependency build: `node build.mjs` → regenerates docs/*.html
apps-script/Code.gs    ← Google Sheets + email backend
apps-script/README.md  ← step-by-step backend setup
```

**Pages:** Home, Services, About, Portfolio / Case Studies, Entrepreneur Hub, Blog / Resources, Contact / Get a Proposal, FAQ, Privacy Policy, Terms.

**Built in:** one H1 per page, a unique SEO title and meta description for every page (copied from the content brief), Open Graph tags, JSON-LD (organisation + FAQ), descriptive alt text, keyboard and screen-reader friendly navigation and form, reduced-motion support, a floating WhatsApp button, and clickable `tel:`, `mailto:` and `wa.me` links.

## Editing content

1. Edit files in `src/` (page bodies in `src/pages/`, shared parts in `src/partials/`, meta/links in `src/site.json`).
2. Run `node build.mjs` (Node 18+). It rewrites the HTML files in `docs/`.
3. Commit and push.

CSS, JS and images are edited directly in `docs/assets/`.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch** → branch `main`, folder **`/docs`** → **Save**.
3. Your site goes live at `https://<username>.github.io/<repo>/` (or on your custom domain).
4. Put that public URL in `src/site.json` → `"siteUrl"`, then run `node build.mjs` and push again. This adds canonical URLs, `og:url` and `sitemap.xml`. Submit the sitemap in Google Search Console.

## Connecting the lead form

Follow **[apps-script/README.md](apps-script/README.md)**. Then paste the Web App URL into `docs/assets/js/config.js`. Until you do, the form tells visitors it couldn't send their enquiry and shows the phone, email and WhatsApp contacts instead. It never pretends a lead was saved.

## Before launch — items to confirm

- [ ] **Hero video:** copy the supplied `01_Hero page Video.mp4` to `docs/assets/video/hero.mp4` (muted, around 10s, compressed). It autoplays muted, loops and plays inline, with no controls. A poster image shows while it loads or if autoplay is blocked.
- [ ] **Instagram:** the URL in the brief is a Zoom meeting link, so the Instagram icon is hidden. Add your real profile URL to `src/site.json` → `social.instagram` and rebuild.
- [ ] **LinkedIn:** the brief had an admin-dashboard URL. The site uses the public page `https://www.linkedin.com/company/143543114/`. Check it's correct.
- [ ] **Google Map:** a ready-to-use embed block is commented out in `src/pages/contact.html`. Enable it only after the public business address or service area is confirmed.
- [ ] **Founder intro:** add the founder's story and photo to the About page.
- [ ] **Case studies:** the portfolio shows clearly labelled *demo* approaches only. Add real projects with verified results as they're completed.
- [ ] **Blog:** article cards are marked "Coming soon". Link them as posts are published.
- [ ] **Legal:** review the Privacy Policy and Terms for your jurisdiction.
- [ ] **Analytics:** add a GA4 tag to `src/layout.html` if wanted. The form already fires a `generate_lead` event when `gtag` is present.
