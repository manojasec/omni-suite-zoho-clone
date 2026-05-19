import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BookingConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const { id } = await searchParams;
  if (!id) notFound();

  const booking = await prisma.booking.findFirst({
    where: { publicId: id, bookingType: { publicSlug: slug } },
    include: { bookingType: { select: { name: true, durationMins: true } } },
  });
  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card className="p-8 text-center space-y-3">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
          ✓
        </div>
        <h1 className="text-2xl font-semibold">You&apos;re booked!</h1>
        <p className="text-sm text-muted-foreground">
          {booking.bookingType.name} · {booking.bookingType.durationMins} min
        </p>
        <p className="text-base">
          {booking.startsAt.toISOString().replace("T", " ").slice(0, 16)} UTC
        </p>
        <p className="text-sm text-muted-foreground">
          A confirmation will be sent to <strong>{booking.attendeeEmail}</strong>.
        </p>
        <div className="pt-3 flex flex-col items-center gap-2">
          <a
            href={`/api/bookings/${booking.publicId}/ics`}
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Add to calendar (.ics)
          </a>
          <Link href={`/book/${slug}`} className="text-sm hover:underline">Book another time</Link>
        </div>
      </Card>
    </div>
  );
}
