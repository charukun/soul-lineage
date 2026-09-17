export const REVIEW_NAVIGATION_FALLBACK = '/';

export function canReturnToPreviousReview({ referrer = '', currentHref = '', historyLength = 0 } = {}) {
  if (!referrer || !currentHref || historyLength <= 1) return false;
  try {
    const current = new URL(currentHref);
    const previous = new URL(referrer, current);
    return previous.origin === current.origin && previous.href !== current.href;
  } catch {
    return false;
  }
}
