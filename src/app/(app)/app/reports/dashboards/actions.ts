"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { dashboardSchema, widgetSchema } from "@/modules/dashboards/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

export async function createDashboardAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboard", "create");
  const parsed = dashboardSchema.safeParse({
    name: s(fd, "name"),
    description: s(fd, "description"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const dash = await prisma.dashboard.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      createdById: ctx.userId,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "dashboard",
    resourceId: dash.id,
    diff: { name: dash.name },
  });
  redirect(`/app/reports/dashboards/${dash.id}`);
}

export async function updateDashboardAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboard", "edit");
  const existing = await prisma.dashboard.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Dashboard not found");
  const parsed = dashboardSchema.safeParse({ name: s(fd, "name"), description: s(fd, "description") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.dashboard.update({
    where: { id },
    data: { name: parsed.data.name, description: parsed.data.description ?? null },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "dashboard",
    resourceId: id,
    diff: { name: parsed.data.name },
  });
  revalidatePath(`/app/reports/dashboards/${id}`);
}

export async function deleteDashboardAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboard", "delete");
  const existing = await prisma.dashboard.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Dashboard not found");
  await prisma.dashboard.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "dashboard",
    resourceId: id,
    diff: { name: existing.name },
  });
  redirect("/app/reports/dashboards");
}

async function loadDashboardOwned(dashboardId: string, workspaceId: string) {
  const dash = await prisma.dashboard.findFirst({ where: { id: dashboardId, workspaceId } });
  if (!dash) throw new Error("Dashboard not found");
  return dash;
}

export async function addWidgetAction(dashboardId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboardWidget", "create");
  await loadDashboardOwned(dashboardId, ctx.workspaceId);
  const parsed = widgetSchema.safeParse({
    title: s(fd, "title"),
    kind: s(fd, "kind"),
    source: s(fd, "source"),
    metric: s(fd, "metric"),
    metricField: s(fd, "metricField"),
    groupBy: s(fd, "groupBy"),
    rangeDays: s(fd, "rangeDays") || "30",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const last = await prisma.dashboardWidget.findFirst({ where: { dashboardId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? -1) + 1;
  const widget = await prisma.dashboardWidget.create({
    data: {
      dashboardId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      source: parsed.data.source,
      metric: parsed.data.metric,
      metricField: parsed.data.metricField ?? null,
      groupBy: parsed.data.groupBy ?? null,
      rangeDays: parsed.data.rangeDays,
      position,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "dashboardWidget",
    resourceId: widget.id,
    diff: { title: widget.title, source: widget.source, kind: widget.kind },
  });
  revalidatePath(`/app/reports/dashboards/${dashboardId}`);
}

export async function deleteWidgetAction(widgetId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboardWidget", "delete");
  const widget = await prisma.dashboardWidget.findFirst({
    where: { id: widgetId, dashboard: { workspaceId: ctx.workspaceId } },
    include: { dashboard: true },
  });
  if (!widget) throw new Error("Widget not found");
  await prisma.dashboardWidget.delete({ where: { id: widgetId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "dashboardWidget",
    resourceId: widgetId,
    diff: { title: widget.title },
  });
  revalidatePath(`/app/reports/dashboards/${widget.dashboardId}`);
}

export async function moveWidgetAction(widgetId: string, direction: "up" | "down") {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboardWidget", "edit");
  const widget = await prisma.dashboardWidget.findFirst({
    where: { id: widgetId, dashboard: { workspaceId: ctx.workspaceId } },
  });
  if (!widget) throw new Error("Widget not found");
  const neighbor = await prisma.dashboardWidget.findFirst({
    where: {
      dashboardId: widget.dashboardId,
      position: direction === "up" ? { lt: widget.position } : { gt: widget.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.dashboardWidget.update({ where: { id: widget.id }, data: { position: neighbor.position } }),
    prisma.dashboardWidget.update({ where: { id: neighbor.id }, data: { position: widget.position } }),
  ]);
  revalidatePath(`/app/reports/dashboards/${widget.dashboardId}`);
}
