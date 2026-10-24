// Static site builder for Digifyhub — zero dependencies.
// Usage: node build.mjs   (writes the finished pages into ./docs)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(root, 'src/site.json'), 'utf8'));
const read = (p) => readFileSync(join(root, 'src', p), 'utf8');

const layout = read('layout.html');
const header = read('partials/header.html');
const footer = read('partials/footer.html');
const leadForm = read('partials/lead-form.html');
const cta = read('partials/cta.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const siteUrl = (site.siteUrl || '').replace(/\/$/, '');
const abs = (path) => (siteUrl ? `${siteUrl}/${path}` : path);

// Social links: an empty URL in site.json hides that icon.
const icons = {
  facebook: '<path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8z"/>',
  linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3zM9.5 9.75h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.91 1.3-1.91 2.63V21h-4z"/>',
  instagram: '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2.5c-2.6 0-2.9 0-3.9.06C5.2 2.7 3.1 4.8 2.96 7.7 2.9 8.7 2.9 9 2.9 12s0 3.3.06 4.3c.14 2.9 2.25 5 5.14 5.14 1 .06 1.3.06 3.9.06s2.9 0 3.9-.06c2.9-.14 5-2.25 5.14-5.14.06-1 .06-1.3.06-4.3s0-3.3-.06-4.3c-.14-2.9-2.25-5-5.14-5.14-1-.06-1.3-.06-3.9-.06zm0 1.7c2.5 0 2.8 0 3.8.06 2 .1 3.3 1.3 3.4 3.4.05 1 .06 1.3.06 3.8s0 2.8-.06 3.8c-.1 2-1.3 3.3-3.4 3.4-1 .05-1.3.06-3.8.06s-2.8 0-3.8-.06c-2-.1-3.3-1.3-3.4-3.4-.05-1-.06-1.3-.06-3.8s0-2.8.06-3.8c.1-2 1.3-3.3 3.4-3.4 1-.05 1.3-.06 3.8-.06z"/>',
  whatsapp: '<path d="M17.5 14.4c-.3-.15-1.75-.86-2-.96-.28-.1-.48-.15-.68.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.45.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.8h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.97 1-3.62-.24-.37a9.8 9.8 0 0 1-1.5-5.22c0-5.42 4.41-9.83 9.84-9.83a9.8 9.8 0 0 1 9.83 9.84c0 5.42-4.42 9.83-9.84 9.83zM20.4 3.6A11.7 11.7 0 0 0 12.05.15C5.55.15.27 5.43.27 11.92c0 2.08.54 4.1 1.58 5.9L.17 23.95l6.27-1.64a11.8 11.8 0 0 0 5.6 1.43h.01c6.5 0 11.78-5.28 11.78-11.78 0-3.15-1.23-6.1-3.45-8.33z"/>',
};
const socialLinks = Object.entries(site.social)
  .filter(([, url]) => url)
  .map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="Digifyhub on ${name[0].toUpperCase() + name.slice(1)}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg></a>`)
  .join('\n');

const svgIcons = JSON.parse(read('icons.json'));
const fill = (tpl, vars) =>
  tpl
    .replace(/\{\{icon:([\w-]+)\}\}/g, (m, k) => {
      if (!svgIcons[k]) throw new Error(`Unknown icon: ${k}`);
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgIcons[k]}</svg>`;
    })
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

const shared = {
  phone: site.phone,
  phoneHref: 'tel:' + site.phone.replace(/[^\d+]/g, ''),
  email: site.email,
  whatsapp: 'https://wa.me/' + site.phone.replace(/\D/g, ''),
  socialLinks,
  waIcon: icons.whatsapp,
  mailIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phoneIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  year: String(new Date().getFullYear()),
};

for (const page of site.pages) {
  const navLinks = site.nav
    .map((n) => `<li><a href="${n.href}"${n.href === page.file ? ' aria-current="page"' : ''}>${n.label}</a></li>`)
    .join('');
  const vars = { ...shared, navLinks, landing: page.file };
  let body = read(`pages/${page.file}`);
  body = body.replace('{{leadForm}}', fill(leadForm, vars)).replace('{{cta}}', fill(cta, vars));
  const jsonLd = page.jsonLd && existsSync(join(root, 'src', page.jsonLd)) ? `<script type="application/ld+json">${fill(read(page.jsonLd), vars).trim()}</script>` : '';
  const html = fill(layout, {
    ...vars,
    title: esc(page.title),
    description: esc(page.description),
    canonical: siteUrl ? `<link rel="canonical" href="${abs(page.file === 'index.html' ? '' : page.file)}">` : '',
    ogUrl: siteUrl ? `<meta property="og:url" content="${abs(page.file === 'index.html' ? '' : page.file)}">` : '',
    ogImage: abs('assets/img/og-image.jpg'),
    jsonLd,
    header: fill(header, vars),
    footer: fill(footer, vars),
    main: fill(body, vars),
    bodyClass: page.bodyClass || '',
  });
  writeFileSync(join(root, 'docs', page.file), html);
  console.log('built', page.file);
}

// robots.txt + sitemap.xml (sitemap needs the public URL, set siteUrl in src/site.json)
writeFileSync(join(root, 'docs/robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
if (siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = site.pages
    .map((p) => `  <url><loc>${abs(p.file === 'index.html' ? '' : p.file)}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  writeFileSync(join(root, 'docs/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log('built sitemap.xml');
}
