/*
 * Digifyhub site configuration.
 *
 * FORM_ENDPOINT: paste the Google Apps Script Web App URL here after deploying
 * apps-script/Code.gs (Deploy → New deployment → Web app). It looks like:
 *   https://script.google.com/macros/s/AKfycb.../exec
 * The URL is a public endpoint, not a secret — the Google Sheet itself stays private.
 */
window.DIGIFYHUB_CONFIG = {
  FORM_ENDPOINT: '',
  REQUEST_TIMEOUT_MS: 25000,
};
