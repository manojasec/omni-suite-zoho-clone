import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AudienceForm } from "../audience-form";
import { createAudienceAction } from "../../actions";

export default function NewAudiencePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>New audience</CardTitle></CardHeader>
        <CardContent>
          <AudienceForm action={createAudienceAction} submitLabel="Create audience" />
        </CardContent>
      </Card>
    </div>
  );
}
