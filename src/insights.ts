import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';

/** Vercel Speed Insights (real-user Core Web Vitals) and Web Analytics. Never allowed to affect the page. */
export function startInsights(): void {
  try {
    injectSpeedInsights();
  } catch (err) {
    console.warn('[Afterlife] speed insights unavailable', err);
  }
  try {
    inject();
  } catch (err) {
    console.warn('[Afterlife] web analytics unavailable', err);
  }
}
