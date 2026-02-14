function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function getTrackingBaseUrl(): string {
  const envBaseUrl = (import.meta.env.VITE_TRACKING_BASE_URL as string | undefined)?.trim();
  if (envBaseUrl) return normalizeBaseUrl(envBaseUrl);

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return 'https://www.grafica.ar';
}

export function buildTrackingUrl(token: string): string {
  return `${getTrackingBaseUrl()}/track/${token}`;
}

