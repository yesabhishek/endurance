/**
 * Privacy mode blurs every figure on screen. The choice lives in a cookie so the
 * server can render the right state from the first byte; reading it from
 * localStorage after hydration would flash your numbers on every page load.
 */
export const PRIVACY_COOKIE = "endurance-privacy";

export const PRIVACY_HIDDEN = "hidden";

/** One year, in seconds. */
export const PRIVACY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
