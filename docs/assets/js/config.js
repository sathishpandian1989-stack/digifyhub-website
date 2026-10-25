/*
 * Digifyhub site configuration.
 *
 * FORM_ENDPOINT: https://script.google.com/macros/s/AKfycbzI3Zt2uGT4wNtGLkUAsyaaQOuVnYltWFjzNB1VY_uURys2kkYp8TWdlcpDURduDJqF/exec
 * apps-script/Code.gs (Deploy → New deployment → Web app). It looks like:
 *   https://script.google.com/macros/s/AKfycb.../exec
 * The URL is a public endpoint, not a secret — the Google Sheet itself stays private.
 */
window.DIGIFYHUB_CONFIG = {
  FORM_ENDPOINT: '',
  REQUEST_TIMEOUT_MS: 25000,
};
