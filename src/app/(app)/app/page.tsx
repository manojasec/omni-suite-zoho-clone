import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const ctx = await requireSession();
  const wsId = ctx.workspaceId;
  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } });
  const currency = ws?.currency ?? "USD";

  const [contacts, openDeals, dealValue, openInvoices, overdueInvoices, openTickets, tasksDueSoon, leadsLast30] =
    await Promise.all([
      prisma.contact.count({ where: { workspaceId: wsId } }),
      prisma.deal.count({ where: { workspaceId: wsId, status: "OPEN" } }),
      prisma.deal.aggregate({ where: { workspaceId: wsId, status: "OPEN" }, _sum: { value: true } }),
      prisma.invoice.aggregate({
        where: { workspaceId: wsId, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
        _sum: { balance: true },
      }),
      prisma.invoice.count({ where: { workspaceId: wsId, status: "OVERDUE" } }),
      prisma.ticket.count({ where: { workspaceId: wsId, status: { in: ["OPEN", "PENDING"] } } }),
      prisma.task.count({
        where: {
          workspaceId: wsId,
          status: { notIn: ["DONE", "CANCELLED"] },
          dueAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.contact.count({
        where: {
          workspaceId: wsId,
          lifecycleStage: "LEAD",
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  const widgets = [
    { title: "Pipeline value (open)", value: formatCurrency(Number(dealValue._sum.value ?? 0), currency) },
    { title: "Open deals", value: openDeals },
    { title: "Outstanding invoices", value: formatCurrency(Number(openInvoices._sum.balance ?? 0), currency) },
    { title: "Overdue invoices", value: overdueInvoices },
    { title: "Open tickets", value: openTickets },
    { title: "Tasks due in 7 days", value: tasksDueSoon },
    { title: "New leads (30 days)", value: leadsLast30 },
    { title: "Total contacts", value: contacts },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {ctx.name ?? "there"}</h1>
        <p className="text-sm text-muted-foreground">Here's what's happening across your workspace.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {widgets.map((w) => (
          <Card key={w.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{w.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{w.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
