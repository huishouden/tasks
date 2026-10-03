import { appUrl } from '@huishouden/pwa-kit/site';

/** Production, for code without a page (unit tests, scripts). */
const SITE = 'https://huishouden-piekstra.web.app';

/**
 * The page's origin when it is https, so staging links to staging. The household rules accept only
 * https links on agenda items and reminders, so a local http dev server links to production.
 */
const origin = globalThis.location?.protocol === 'https:' ? globalThis.location.origin : SITE;

/** An absolute link into Tasks on the suite's one site: `appLink('?list=chores')`. */
export const appLink = (path = '') => appUrl(import.meta.env.BASE_URL ?? '/tasks/', path, origin);
