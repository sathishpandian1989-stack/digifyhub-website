// Static site builder for Digifyhub — zero dependencies.
// Usage: node build.mjs   (writes the finished pages into ./docs)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

// Cache-busting: asset URLs change whenever the file content changes, so browsers can cache them for long.
const version = (path) => createHash('md5').update(readFileSync(join(root, 'docs', path))).digest('hex').slice(0, 8);
const assetVersions = {
  cssVersion: version('assets/css/styles.css'),
  jsVersion: version('assets/js/main.js'),
  configVersion: version('assets/js/config.js'),
};
const fontsUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Plus+Jakarta+Sans:wght@600;700;800&amp;display=swap';

const pageUrl = (file) => abs(file === 'index.html' ? '' : file);
const verification = [
  site.googleSiteVerification && `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">`,
  site.bingSiteVerification && `<meta name="msvalidate.01" content="${esc(site.bingSiteVerification)}">`,
].filter(Boolean).join('\n  ');
const pixelId = String(site.metaPixelId || '').replace(/\D/g, '');
const analytics = [
  site.ga4Id &&
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.ga4Id)}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(site.ga4Id)}');</script>`,
  pixelId &&
    `<!-- Meta Pixel -->\n  <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');</script>`,
].filter(Boolean).join('\n  ');
const bodyStart = pixelId
  ? `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixelId}&amp;ev=PageView&amp;noscript=1"></noscript>`
  : '';

// ---- Structured data (schema.org JSON-LD) ----
const orgId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;
const organization = {
  '@type': 'Organization',
  '@id': orgId,
  name: 'Digifyhub',
  url: `${siteUrl}/`,
  logo: { '@type': 'ImageObject', url: abs('assets/img/logo.png'), width: 600, height: 171 },
  image: abs('assets/img/og-image.jpg'),
  slogan: 'Dream Big. Start Smart. Grow Digitally.',
  description: 'Digital marketing and business growth agency offering SEO, Google Ads, Meta Ads, social media marketing, website development and lead generation for small businesses and entrepreneurs.',
  email: site.email,
  telephone: site.phone.replace(/\s/g, ''),
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone: site.phone.replace(/\s/g, ''),
    email: site.email,
    availableLanguage: ['English'],
  },
  sameAs: Object.entries(site.social).filter(([k, v]) => v && k !== 'whatsapp').map(([, v]) => v),
  knowsAbout: ['Search engine optimization', 'Local SEO', 'Google Ads', 'Meta Ads', 'Social media marketing', 'Website development', 'Lead generation'],
};
const website = { '@type': 'WebSite', '@id': websiteId, url: `${siteUrl}/`, name: 'Digifyhub', publisher: { '@id': orgId }, inLanguage: 'en-IN' };
const pageTypes = { 'about.html': 'AboutPage', 'contact.html': 'ContactPage', 'faq.html': 'FAQPage', 'blog.html': 'CollectionPage' };
const faqEntities = JSON.parse(read('schema/faq.json')).mainEntity;
const services = JSON.parse(read('schema/services.json'));

function structuredData(page) {
  const url = pageUrl(page.file);
  const webPage = {
    '@type': pageTypes[page.file] || 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    isPartOf: { '@id': websiteId },
    inLanguage: 'en-IN',
  };
  const graph = [webPage];
  if (page.file === 'index.html') {
    webPage.about = { '@id': orgId };
    graph.push(organization, website);
  } else {
    webPage.breadcrumb = { '@id': `${url}#breadcrumb` };
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
        { '@type': 'ListItem', position: 2, name: page.name, item: url },
      ],
    });
  }
  if (page.file === 'faq.html') webPage.mainEntity = faqEntities;
  if (page.file === 'services.html') {
    for (const sv of services) {
      graph.push({ '@type': 'Service', '@id': `${url}#${sv.id}`, name: sv.name, serviceType: sv.serviceType, description: sv.description, url: `${url}#${sv.id}`, provider: { '@id': orgId } });
    }
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

// lastmod = date of the last commit that touched the page source (today if it has uncommitted changes)
const today = new Date().toISOString().slice(0, 10);
function lastModified(file) {
  try {
    const src = `src/pages/${file}`;
    if (execFileSync('git', ['status', '--porcelain', src], { cwd: root }).toString().trim()) return today;
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', src], { cwd: root }).toString().trim() || today;
  } catch {
    return today;
  }
}

function renderPage(page, extra = {}) {
  const navLinks = site.nav
    .map((n) => `<li><a href="${n.href}"${n.href === page.file || (n.href === './' && page.file === 'index.html') ? ' aria-current="page"' : ''}>${n.label}</a></li>`)
    .join('');
  const vars = { ...shared, navLinks, landing: page.file };
  let body = read(`pages/${page.file}`);
  body = body.replace('{{leadForm}}', fill(leadForm, vars)).replace('{{cta}}', fill(cta, vars));
  return fill(layout, {
    ...vars,
    ...assetVersions,
    fontsUrl,
    title: esc(page.title),
    description: esc(page.description),
    robots: page.robots || 'index, follow, max-image-preview:large, max-snippet:-1',
    canonical: siteUrl && !extra.noCanonical ? `<link rel="canonical" href="${pageUrl(page.file)}">` : '',
    ogUrl: siteUrl && !extra.noCanonical ? `<meta property="og:url" content="${pageUrl(page.file)}">` : '',
    ogImage: abs('assets/img/og-image.jpg'),
    preload: page.preload ? `<link rel="preload" as="image" href="${page.preload}" fetchpriority="high">` : '',
    verification,
    analytics,
    bodyStart,
    jsonLd: siteUrl && !extra.noCanonical ? structuredData(page) : '',
    header: fill(header, vars),
    footer: fill(footer, vars),
    main: fill(body, vars),
    bodyClass: page.bodyClass || '',
  });
}

for (const page of site.pages) {
  writeFileSync(join(root, 'docs', page.file), renderPage(page));
  console.log('built', page.file);
}

// 404 page: not indexed, and <base href="/"> so its assets load from any missing URL depth.
const notFound = { file: '404.html', name: 'Page not found', title: 'Page Not Found | Digifyhub', description: 'The page you were looking for could not be found.', robots: 'noindex, follow' };
writeFileSync(join(root, 'docs/404.html'), renderPage(notFound, { noCanonical: true }).replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <base href="/">'));
console.log('built 404.html');

writeFileSync(join(root, 'docs/site.webmanifest'), JSON.stringify({
  name: 'Digifyhub', short_name: 'Digifyhub', start_url: '/', display: 'browser',
  background_color: '#061A40', theme_color: '#061A40',
  icons: [
    { src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2) + '\n');

// robots.txt + sitemap.xml (sitemap needs the public URL, set siteUrl in src/site.json)
writeFileSync(join(root, 'docs/robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
if (siteUrl) {
  const urls = site.pages
    .map((p) => `  <url><loc>${pageUrl(p.file)}</loc><lastmod>${lastModified(p.file)}</lastmod></url>`)
    .join('\n');
  writeFileSync(join(root, 'docs/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log('built sitemap.xml');
}
