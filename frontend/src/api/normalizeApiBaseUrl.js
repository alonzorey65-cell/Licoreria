export function normalizeApiBaseUrl(url) {
  const trimmedUrl = url.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/?#]+$/i.test(trimmedUrl) ? `${trimmedUrl}/api` : trimmedUrl;
}
