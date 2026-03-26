import { google } from "googleapis";
import { getConfig } from "../config";
import { CalendarEventParams, CalendarEventResult } from "../types/calendar";
import { Defaults, Timeouts } from "../config/constants";
import { withRetry } from "../utils/retry";
import * as logger from "../utils/logger";

function getCalendarClient() {
  const config = getConfig();

  const auth = new google.auth.JWT({
    email: config.googleCalendar.serviceAccountEmail,
    key: config.googleCalendar.privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({
    version: "v3",
    auth,
    timeout: Timeouts.HTTP_REQUEST_TIMEOUT_MS,
  } as any);
}

export async function createEvent(
  params: CalendarEventParams
): Promise<CalendarEventResult> {
  const config = getConfig();
  const calendar = getCalendarClient();

  const event = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.startDateTime,
      timeZone: Defaults.TIMEZONE,
    },
    end: {
      dateTime: params.endDateTime,
      timeZone: Defaults.TIMEZONE,
    },
    location: params.location,
  };

  const result = await withRetry(
    () =>
      calendar.events.insert({
        calendarId: config.googleCalendar.calendarId,
        requestBody: event,
      }),
    { label: "Google Calendar createEvent" }
  );

  const eventId = result.data.id!;
  const htmlLink = result.data.htmlLink!;

  logger.info("Calendar event created", { eventId });

  return { eventId, htmlLink };
}

export async function deleteEvent(eventId: string): Promise<void> {
  const config = getConfig();
  const calendar = getCalendarClient();

  await withRetry(
    () =>
      calendar.events.delete({
        calendarId: config.googleCalendar.calendarId,
        eventId,
      }),
    { label: "Google Calendar deleteEvent" }
  );

  logger.info("Calendar event deleted", { eventId });
}
