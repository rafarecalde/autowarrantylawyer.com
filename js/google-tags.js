/**
 * Google Ads conversion helper for autowarrantylawyer.com.
 *
 * The GA4 config (G-F983DQ22DR) and Google Ads config (AW-1020943370)
 * are in each HTML <head>. This site had no existing G- or AW- ID.
 *
 * send_to uses the same conversion label as recaldelaw.com practice
 * landings: AW-1020943370/CXe2CPPUwMIZEIq46eYD.
 * Marketing should confirm or replace that label for lemon-law campaigns
 * before treating these conversions as the campaign goal.
 *
 * Primary call CTAs (hotline bar, button-styled tel links, mobile call bar,
 * article and strip CTAs) report through gtag_report_conversion and still
 * dial tel:+18662955347. Form success calls the same helper from intake.js.
 */
(function () {
  'use strict';

  var SEND_TO = 'AW-1020943370/CXe2CPPUwMIZEIq46eYD';

  function gtag_report_conversion(url) {
    var navigated = false;
    function callback() {
      if (navigated) return;
      navigated = true;
      if (typeof url !== 'undefined' && url) {
        window.location = url;
      }
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: SEND_TO,
        event_callback: callback
      });
      if (url) window.setTimeout(callback, 900);
    } else if (url) {
      callback();
    }
    return false;
  }

  window.gtag_report_conversion = gtag_report_conversion;
  window.AW_CONVERSION_SEND_TO = SEND_TO;

  function isPrimaryCall(anchor) {
    if (anchor.classList.contains('mobile-call')) return true;
    if (anchor.classList.contains('btn')) return true;
    if (anchor.closest('.callbar')) return true;
    if (anchor.closest('.hero-cta')) return true;
    if (anchor.closest('.article-cta')) return true;
    if (anchor.closest('.cta-strip')) return true;
    return false;
  }

  document.addEventListener('click', function (event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var anchor = event.target && event.target.closest ? event.target.closest('a[href^="tel:"]') : null;
    if (!anchor || !isPrimaryCall(anchor)) return;
    var href = anchor.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    gtag_report_conversion(href);
  });
})();
