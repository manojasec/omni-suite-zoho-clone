import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SurveyThanksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const survey = await prisma.survey.findUnique({ where: { publicSlug: slug } });
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Thanks!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {survey?.thankYouText ?? "Your response has been recorded."}
        </p>
      </Card>
    </div>
  );
}
