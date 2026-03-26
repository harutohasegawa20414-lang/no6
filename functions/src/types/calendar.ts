export interface CalendarEventParams {
  summary: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
}
