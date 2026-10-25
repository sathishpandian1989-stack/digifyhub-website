/*
 * Digifyhub site configuration.
 * FORM_ENDPOINT is the Google Apps Script web app URL (ends in /exec).
 * It is a public endpoint, not a secret. The Google Sheet itself stays private.
 */
window.DIGIFYHUB_CONFIG = {
  FORM_ENDPOINT: 'https://script.google.com/macros/s/AKfycbwg6Oc1MyRhtLWhFJMgzqAdsZEoMB-3keX2qmTQpSEiNCSW-yQafMsO0OyHsctIXwn4/exec',
  REQUEST_TIMEOUT_MS: 25000,
};
