import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectForm } from "../project-form";
import { createProjectAction } from "../actions";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>New project</CardTitle></CardHeader>
        <CardContent><ProjectForm action={createProjectAction} submitLabel="Create project" /></CardContent>
      </Card>
    </div>
  );
}
