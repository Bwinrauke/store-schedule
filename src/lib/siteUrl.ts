/**
 * The site's public address, for links people will share.
 *
 * Vercel locks its per-deployment addresses (my-app-git-abc123.vercel.app)
 * behind a Vercel login by default; only the production domain is open. So a
 * shared link must use the production domain, never whatever URL the admin
 * happened to have open. Order: an explicit override, then the production
 * domain Vercel sets on every deployment, then the request's own host.
 */
export function siteUrl(requestHost: string | null, requestProto?: string | null): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  if (!requestHost) return null;
  const proto = requestProto ?? (requestHost.startsWith("localhost") ? "http" : "https");
  return `${proto}://${requestHost}`;
}

/** True when the page is being viewed on a Vercel deployment-specific address. */
export function isDeploymentOnlyHost(requestHost: string | null): boolean {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!requestHost || !production || process.env.NEXT_PUBLIC_SITE_URL) return false;
  return requestHost !== production && requestHost.endsWith(".vercel.app");
}
