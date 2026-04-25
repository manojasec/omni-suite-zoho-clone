"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import {
  departmentSchema,
  employeeSchema,
  leaveTypeSchema,
  leaveRequestSchema,
  attendanceSchema,
} from "@/modules/hr/schemas";
import { recordAuditEvent } from "@/modules/audit/record";

// ===== Departments =====

export async function createDepartmentAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "department", "create");
  const parsed = departmentSchema.safeParse({
    name: fd.get("name") ?? "",
    managerId: fd.get("managerId") ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await prisma.department.findFirst({
    where: { workspaceId: ctx.workspaceId, name: parsed.data.name },
    select: { id: true },
  });
  if (existing) throw new Error("A department with that name already exists");

  const d = await prisma.department.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      managerId: parsed.data.managerId ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "department",
    resourceId: d.id,
  });
  revalidatePath("/app/hr/departments");
}

export async function archiveDepartmentAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "department", "delete");
  const d = await prisma.department.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!d) throw new Error("Department not found");
  await prisma.department.update({ where: { id }, data: { archived: true } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "archive",
    resource: "department",
    resourceId: id,
  });
  revalidatePath("/app/hr/departments");
}

// ===== Employees =====

function employeeFdToObj(fd: FormData) {
  return {
    employeeNumber: fd.get("employeeNumber") ?? "",
    firstName: fd.get("firstName") ?? "",
    lastName: fd.get("lastName") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
    jobTitle: fd.get("jobTitle") ?? "",
    departmentId: fd.get("departmentId") ?? "",
    managerId: fd.get("managerId") ?? "",
    employmentType: (fd.get("employmentType") as string) || "FULL_TIME",
    status: (fd.get("status") as string) || "ACTIVE",
    hireDate: fd.get("hireDate") ?? "",
    terminationDate: fd.get("terminationDate") ?? "",
    address: fd.get("address") ?? "",
    notes: fd.get("notes") ?? "",
  };
}

export async function createEmployeeAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "employee", "create");
  const parsed = employeeSchema.safeParse(employeeFdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.departmentId) {
    const d = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!d) throw new Error("Invalid department");
  }

  const dup = await prisma.employee.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [
        { employeeNumber: parsed.data.employeeNumber },
        { email: parsed.data.email },
      ],
    },
    select: { id: true },
  });
  if (dup) throw new Error("Employee number or email already in use");

  const emp = await prisma.employee.create({
    data: {
      workspaceId: ctx.workspaceId,
      employeeNumber: parsed.data.employeeNumber,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      jobTitle: parsed.data.jobTitle ?? null,
      departmentId: parsed.data.departmentId ?? null,
      managerId: parsed.data.managerId ?? null,
      employmentType: parsed.data.employmentType,
      status: parsed.data.status,
      hireDate: new Date(parsed.data.hireDate),
      terminationDate: parsed.data.terminationDate
        ? new Date(parsed.data.terminationDate)
        : null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "employee",
    resourceId: emp.id,
  });
  revalidatePath("/app/hr/employees");
  redirect(`/app/hr/employees/${emp.id}`);
}

export async function updateEmployeeAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "employee", "edit");
  const existing = await prisma.employee.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Employee not found");

  const parsed = employeeSchema.safeParse(employeeFdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.departmentId) {
    const d = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!d) throw new Error("Invalid department");
  }

  await prisma.employee.update({
    where: { id },
    data: {
      employeeNumber: parsed.data.employeeNumber,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      jobTitle: parsed.data.jobTitle ?? null,
      departmentId: parsed.data.departmentId ?? null,
      managerId: parsed.data.managerId ?? null,
      employmentType: parsed.data.employmentType,
      status: parsed.data.status,
      hireDate: new Date(parsed.data.hireDate),
      terminationDate: parsed.data.terminationDate
        ? new Date(parsed.data.terminationDate)
        : null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "employee",
    resourceId: id,
  });
  revalidatePath(`/app/hr/employees/${id}`);
  revalidatePath("/app/hr/employees");
}

export async function terminateEmployeeAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "employee", "delete");
  const existing = await prisma.employee.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Employee not found");
  await prisma.employee.update({
    where: { id },
    data: { status: "TERMINATED", terminationDate: new Date() },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "terminate",
    resource: "employee",
    resourceId: id,
  });
  revalidatePath(`/app/hr/employees/${id}`);
  revalidatePath("/app/hr/employees");
}

// ===== Leave Types =====

export async function createLeaveTypeAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leaveType", "create");
  const parsed = leaveTypeSchema.safeParse({
    name: fd.get("name") ?? "",
    daysPerYear: fd.get("daysPerYear") ?? "0",
    paid: fd.get("paid") === "on" || fd.get("paid") === "true",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const dup = await prisma.leaveType.findFirst({
    where: { workspaceId: ctx.workspaceId, name: parsed.data.name },
    select: { id: true },
  });
  if (dup) throw new Error("Leave type already exists");

  const lt = await prisma.leaveType.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      daysPerYear: parsed.data.daysPerYear,
      paid: parsed.data.paid,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "leaveType",
    resourceId: lt.id,
  });
  revalidatePath("/app/hr/leave-types");
}

export async function archiveLeaveTypeAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leaveType", "delete");
  const lt = await prisma.leaveType.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!lt) throw new Error("Leave type not found");
  await prisma.leaveType.update({ where: { id }, data: { archived: true } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "archive",
    resource: "leaveType",
    resourceId: id,
  });
  revalidatePath("/app/hr/leave-types");
}

// ===== Leave Requests =====

export async function createLeaveRequestAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leaveRequest", "create");
  const parsed = leaveRequestSchema.safeParse({
    employeeId: fd.get("employeeId") ?? "",
    leaveTypeId: fd.get("leaveTypeId") ?? "",
    startDate: fd.get("startDate") ?? "",
    endDate: fd.get("endDate") ?? "",
    days: fd.get("days") ?? "1",
    reason: fd.get("reason") ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const [emp, lt] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
    prisma.leaveType.findFirst({
      where: { id: parsed.data.leaveTypeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
  ]);
  if (!emp) throw new Error("Invalid employee");
  if (!lt) throw new Error("Invalid leave type");

  const lr = await prisma.leaveRequest.create({
    data: {
      workspaceId: ctx.workspaceId,
      employeeId: parsed.data.employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      status: "PENDING",
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      days: parsed.data.days,
      reason: parsed.data.reason ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "leaveRequest",
    resourceId: lr.id,
  });
  revalidatePath("/app/hr/leave");
}

export async function approveLeaveRequestAction(id: string) {
  const ctx = await requireSession();
  if (!can(ctx.role, "leaveRequest", "manage")) {
    throw new Error("You don't have permission to approve leave");
  }
  const lr = await prisma.leaveRequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!lr) throw new Error("Request not found");
  if (lr.status !== "PENDING") throw new Error("Only pending requests can be approved");

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: ctx.userId,
      decidedAt: new Date(),
      rejectionReason: null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "approve",
    resource: "leaveRequest",
    resourceId: id,
  });
  revalidatePath(`/app/hr/leave/${id}`);
  revalidatePath("/app/hr/leave");
}

export async function rejectLeaveRequestAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  if (!can(ctx.role, "leaveRequest", "manage")) {
    throw new Error("You don't have permission to reject leave");
  }
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) throw new Error("Rejection reason is required");
  const lr = await prisma.leaveRequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!lr) throw new Error("Request not found");
  if (lr.status !== "PENDING") throw new Error("Only pending requests can be rejected");

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: ctx.userId,
      decidedAt: new Date(),
      rejectionReason: reason,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "reject",
    resource: "leaveRequest",
    resourceId: id,
  });
  revalidatePath(`/app/hr/leave/${id}`);
  revalidatePath("/app/hr/leave");
}

export async function cancelLeaveRequestAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leaveRequest", "edit");
  const lr = await prisma.leaveRequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!lr) throw new Error("Request not found");
  if (lr.status !== "PENDING" && lr.status !== "APPROVED") {
    throw new Error("Only pending or approved requests can be cancelled");
  }
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "cancel",
    resource: "leaveRequest",
    resourceId: id,
  });
  revalidatePath(`/app/hr/leave/${id}`);
  revalidatePath("/app/hr/leave");
}

// ===== Attendance =====

export async function recordAttendanceAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leaveRequest", "create"); // attendance shares HR role
  const parsed = attendanceSchema.safeParse({
    employeeId: fd.get("employeeId") ?? "",
    date: fd.get("date") ?? "",
    checkIn: fd.get("checkIn") ?? "",
    checkOut: fd.get("checkOut") ?? "",
    hours: fd.get("hours") ?? "0",
    note: fd.get("note") ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const emp = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!emp) throw new Error("Invalid employee");

  const dateOnly = new Date(parsed.data.date);
  // Compute hours if check-in / check-out provided and hours not set
  let hours = parsed.data.hours;
  let checkIn: Date | null = null;
  let checkOut: Date | null = null;
  if (parsed.data.checkIn) {
    checkIn = new Date(`${parsed.data.date}T${parsed.data.checkIn}`);
  }
  if (parsed.data.checkOut) {
    checkOut = new Date(`${parsed.data.date}T${parsed.data.checkOut}`);
  }
  if (checkIn && checkOut && hours === 0) {
    hours = Math.round(((checkOut.getTime() - checkIn.getTime()) / 36e5) * 100) / 100;
  }

  await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: parsed.data.employeeId, date: dateOnly } },
    create: {
      workspaceId: ctx.workspaceId,
      employeeId: parsed.data.employeeId,
      date: dateOnly,
      checkIn,
      checkOut,
      hours,
      note: parsed.data.note ?? null,
    },
    update: {
      checkIn,
      checkOut,
      hours,
      note: parsed.data.note ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "upsert",
    resource: "attendance",
    resourceId: `${parsed.data.employeeId}:${parsed.data.date}`,
  });
  revalidatePath("/app/hr/attendance");
}
