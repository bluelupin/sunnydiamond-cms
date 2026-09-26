/** Resolve product paths to absolute website links for email clients. */
export function appointmentSourceUrl(value?: string | null) {
  const source = value?.trim();
  if (!source) return undefined;
  try {
    // Reject protocol-relative URLs and backslashes rather than changing hosts.
    if (source.startsWith('//') || source.includes('\\')) return undefined;
    const base = process.env.WEB_BASE_URL?.trim();
    const url = /^[a-z][a-z\d+.-]*:/i.test(source)
      ? new URL(source) : new URL(source, base || undefined);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
