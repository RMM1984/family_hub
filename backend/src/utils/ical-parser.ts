import ical from "node-ical";
import { differenceInCalendarDays } from "date-fns";

export async function parseAirbnbIcal(url: string) {
  const events = await ical.async.fromURL(url);
  return Object.values(events)
    .filter((event: any) => event.type === "VEVENT")
    .map((event: any) => ({
      uid: String(event.uid),
      guest_name: String(event.summary ?? "Reserva Airbnb").replace(/reserved/gi, "Reserva").trim(),
      check_in: event.start,
      check_out: event.end,
      nights: differenceInCalendarDays(event.end, event.start)
    }));
}
