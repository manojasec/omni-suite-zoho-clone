/**
 * Minimal RFC 5545 (iCalendar) generator for Booking objects.
 * Zero deps. Outputs CRLF-delimited VCALENDAR with a single VEVENT.
 */

export type IcsEventInput = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  organizerEmail?: string | null;
  organizerName?: string | null;
  attendeeEmail?: string | null;
  attendeeName?: string | null;
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  url?: string | null;
};

/** Format a Date as UTC `YYYYMMDDTHHMMSSZ`. */
export function toIcsUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

/** Escape per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold long lines to ≤75 octets (RFC 5545 §3.1) using CRLF + space. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    out.push(i === 0 ? chunk : " " + chunk);
    i += i === 0 ? 75 : 74;
  }
  return out.join("\r\n");
}

export function buildIcs(input: IcsEventInput): string {
  const status = input.status ?? "CONFIRMED";
  const now = toIcsUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OmniSuite//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(input.startsAt)}`,
    `DTEND:${toIcsUtc(input.endsAt)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    `STATUS:${status}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  if (input.url) lines.push(`URL:${escapeIcsText(input.url)}`);
  if (input.organizerEmail) {
    const cn = input.organizerName ? `;CN=${escapeIcsText(input.organizerName)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${input.organizerEmail}`);
  }
  if (input.attendeeEmail) {
    const cn = input.attendeeName ? `;CN=${escapeIcsText(input.attendeeName)}` : "";
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED${cn}:mailto:${input.attendeeEmail}`,
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
