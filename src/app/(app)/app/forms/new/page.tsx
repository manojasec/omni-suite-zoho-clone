import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormBuilder } from "../form-builder";
import { createFormAction } from "../actions";

export default function NewFormPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader><CardTitle>New form</CardTitle></CardHeader>
        <CardContent>
          <FormBuilder action={createFormAction} submitLabel="Create form" />
        </CardContent>
      </Card>
    </div>
  );
}
