import { CompanyForm } from "../company-form";
import { createCompanyAction } from "../actions";

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New company</h1>
        <p className="text-sm text-muted-foreground">Add an account to your CRM.</p>
      </div>
      <CompanyForm action={createCompanyAction} submitLabel="Create company" />
    </div>
  );
}
