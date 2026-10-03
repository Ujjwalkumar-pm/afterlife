import { injectSpeedInsights } from '@vercel/speed-insights';

/** Vercel Speed Insights (real-user Core Web Vitals). Never allowed to affect the page. */
export function startInsights(): void {
  try {
    injectSpeedInsights();
  } catch (err) {
    console.warn('[Afterlife] speed insights unavailable', err);
  }
}
