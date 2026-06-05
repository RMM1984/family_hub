import ical from "node-ical";
import { differenceInCalendarDays } from "date-fns";

export async function parseAirbnbIcal(url: string) {
  const events = await ical.async.fromURL(url);
  return Object.values(events)
    .filter((event: any) => event.type === "VEVENT")
    .map((event: any) => {
      const summary = String(event.summary ?? "").trim();
      const description = event.description ? String(event.description) : "";
      const guestCount = parseGuestCount(`${summary}\n${description}`);
      return {
        uid: String(event.uid),
        title: summary || "Reserva Airbnb",
        guest_name: parseGuestName(summary, description),
        guest_count: guestCount,
        guest_count_status: guestCount === null ? "missing" : "imported",
        check_in: toDateOnly(event.start),
        check_out: toDateOnly(event.end),
        nights: differenceInCalendarDays(event.end, event.start),
        description: description || null,
        raw_summary: summary || null,
        raw_description: description || null
      };
    });
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseGuestName(summary: string, description: string) {
  const text = `${summary}\n${description}`;
  const explicit = text.match(/(?:guest|huesped|hu[eé]sped|cliente|nombre)\s*[:\-]\s*([^\n\r,;]+)/i);
  if (explicit?.[1]) return cleanupName(explicit[1]);
  if (/^(reserved|airbnb\s*\(not available\)|not available)$/i.test(summary.trim())) return null;
  return null;
}

function parseGuestCount(text: string) {
  const patterns = [
    /(?:guests?|hu[eé]spedes?|personas?|adults?|adultos?)\s*[:\-]?\s*(\d{1,2})/i,
    /(\d{1,2})\s*(?:guests?|hu[eé]spedes?|personas?|adults?|adultos?)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0 && value < 50) return value;
  }
  return null;
}

function cleanupName(value: string) {
  const cleaned = value.trim();
  return cleaned.length > 1 ? cleaned : null;
}
