/**
 * Client-safe meeting URL validation and error definitions
 */

export class MeetingProviderUnavailableError extends Error {
  code = 'MEETING_PROVIDER_UNAVAILABLE';
  statusCode = 503;

  constructor(
    message = "The video room isn't available right now. Please try again shortly or contact the church office."
  ) {
    super(message);
    this.name = 'MeetingProviderUnavailableError';
  }
}

export function validateMeetingUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname === 'meet.google.com') {
      return !url.includes('/new') && !url.endsWith('new');
    }
    if (parsed.hostname.endsWith('zoom.us')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
