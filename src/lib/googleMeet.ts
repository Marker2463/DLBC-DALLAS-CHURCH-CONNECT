/**
 * Deprecated: The service-account and hardcoded meeting implementation
 * has been replaced by the canonical backend OAuth meeting provider
 * in server/googleMeetRoutes.ts and src/lib/googleMeetClient.ts.
 *
 * There is exactly ONE backend meeting-creation path.
 */

export {
  createConsultationMeeting,
  joinConsultationMeeting,
  connectPastorGoogleCalendar,
} from './googleMeetClient';
