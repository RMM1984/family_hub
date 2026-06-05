import ical from "node-ical";
import { differenceInCalendarDays } from "date-fns";

export async function parseAirbnbIcal(url: string) {
  const events = await ical.async.fromURL(url);
  return Object.values(events)
    .filter((event: any) => event.type === "VEVENT")
    .map((event: any) => ({
      uid: String(event.uid),
      title: String(event.summary ?? "Reserva Airbnb"),
      guest_name: String(event.summary ?? "Reserva Airbnb").replace(/reserved/gi, "Reserva").trim(),
      check_in: toDateOnly(event.start),
      check_out: toDateOnly(event.end),
      nights: differenceInCalendarDays(event.end, event.start),
      description: event.description ?? null
    }));
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
