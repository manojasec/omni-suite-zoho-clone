import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcs } from "@/modules/bookings/ics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { publicId },
    include: {
      bookingType: { select: { name: true, durationMins: true } },
      host: { select: { name: true, email: true } },
      workspace: { select: { name: true } },
    },
  });
  if (!booking) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ics = buildIcs({
    uid: `${booking.publicId}@omnisuite`,
    summary: booking.bookingType.name,
    description: booking.notes,
    location: booking.location,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    organizerEmail: booking.host.email ?? null,
    organizerName: booking.host.name ?? null,
    attendeeEmail: booking.attendeeEmail,
    attendeeName: booking.attendeeName,
    status: booking.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${booking.publicId}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
