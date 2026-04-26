"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  STORE_ORDER_STATUSES,
  addOrderItemSchema,
  aggregateOrderTotals,
  canTransitionOrder,
  computeLineTotals,
  createOrderSchema,
  storeCustomerSchema,
  storefrontSchema,
  updateOrderItemSchema,
} from "@/modules/commerce/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function recomputeOrderTotals(orderId: string): Promise<void> {
  const items = await prisma.storeOrderItem.findMany({
    where: { orderId },
    select: {
      lineSubtotal: true,
      lineTax: true,
      lineTotal: true,
      quantity: true,
    },
  });
  const totals = aggregateOrderTotals(items);
  await prisma.storeOrder.update({
    where: { id: orderId },
    data: {
      subtotal: new Prisma.Decimal(totals.subtotal),
      tax: new Prisma.Decimal(totals.tax),
      total: new Prisma.Decimal(totals.total),
    },
  });
}

function ensurePending(status: string): void {
  if (status !== "PENDING") throw new Error("Order must be PENDING to edit");
}

// ---------------- Storefront ----------------

export async function upsertStorefrontAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storefront", "edit");
  const data = storefrontSchema.parse(toFormObject(fd));

  const existing = await prisma.storefront.findFirst({
    where: { workspaceId: ctx.workspaceId },
  });

  try {
    if (existing) {
      await prisma.storefront.update({
        where: { id: existing.id },
        data: {
          slug: data.slug,
          name: data.name,
          headline: data.headline,
          currency: data.currency,
          supportEmail: data.supportEmail,
          status: data.status,
        },
      });
    } else {
      assertCan(ctx.role, "storefront", "create");
      await prisma.storefront.create({
        data: {
          workspaceId: ctx.workspaceId,
          slug: data.slug,
          name: data.name,
          headline: data.headline,
          currency: data.currency,
          supportEmail: data.supportEmail,
          status: data.status,
        },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Storefront slug "${data.slug}" is already taken`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: existing ? "edit" : "create",
    resource: "storefront",
    resourceId: existing?.id,
    diff: { slug: data.slug, status: data.status },
  });
  revalidatePath("/app/store");
}

// ---------------- Customers ----------------

export async function createStoreCustomerAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeCustomer", "create");
  const data = storeCustomerSchema.parse(toFormObject(fd));

  let customer;
  try {
    customer = await prisma.storeCustomer.create({
      data: {
        workspaceId: ctx.workspaceId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        shippingAddress: data.shippingAddress,
        notes: data.notes,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Customer with email "${data.email}" already exists`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "storeCustomer",
    resourceId: customer.id,
    diff: { email: customer.email },
  });
  revalidatePath("/app/store/customers");
  redirect(`/app/store/customers/${customer.id}`);
}

export async function updateStoreCustomerAction(customerId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeCustomer", "edit");
  const customer = await prisma.storeCustomer.findFirst({
    where: { id: customerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");
  const data = storeCustomerSchema.parse(toFormObject(fd));

  try {
    await prisma.storeCustomer.update({
      where: { id: customerId },
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        shippingAddress: data.shippingAddress,
        notes: data.notes,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Customer with email "${data.email}" already exists`);
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "storeCustomer",
    resourceId: customerId,
  });
  revalidatePath(`/app/store/customers/${customerId}`);
  revalidatePath("/app/store/customers");
}

export async function deleteStoreCustomerAction(customerId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeCustomer", "delete");
  const customer = await prisma.storeCustomer.findFirst({
    where: { id: customerId, workspaceId: ctx.workspaceId },
    include: { _count: { select: { orders: true } } },
  });
  if (!customer) throw new Error("Customer not found");
  if (customer._count.orders > 0) {
    throw new Error("Cannot delete a customer who has orders");
  }
  await prisma.storeCustomer.delete({ where: { id: customerId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "storeCustomer",
    resourceId: customerId,
  });
  revalidatePath("/app/store/customers");
  redirect("/app/store/customers");
}

// ---------------- Orders ----------------

async function nextOrderNumber(workspaceId: string): Promise<number> {
  const last = await prisma.storeOrder.findFirst({
    where: { workspaceId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function createOrderAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "create");
  const data = createOrderSchema.parse(toFormObject(fd));

  const customer = await prisma.storeCustomer.findFirst({
    where: { id: data.customerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");

  const number = await nextOrderNumber(ctx.workspaceId);
  const order = await prisma.storeOrder.create({
    data: {
      workspaceId: ctx.workspaceId,
      number,
      customerId: customer.id,
      currency: data.currency,
      notes: data.notes,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "storeOrder",
    resourceId: order.id,
    diff: { number },
  });
  revalidatePath("/app/store/orders");
  redirect(`/app/store/orders/${order.id}`);
}

export async function addOrderItemAction(orderId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "edit");
  const order = await prisma.storeOrder.findFirst({
    where: { id: orderId, workspaceId: ctx.workspaceId },
  });
  if (!order) throw new Error("Order not found");
  ensurePending(order.status);

  const data = addOrderItemSchema.parse(toFormObject(fd));
  const product = await prisma.product.findFirst({
    where: { id: data.productId, workspaceId: ctx.workspaceId },
  });
  if (!product) throw new Error("Product not found");

  const totals = computeLineTotals({
    unitPrice: product.price,
    taxPercent: product.taxPercent,
    quantity: data.quantity,
  });

  try {
    await prisma.storeOrderItem.create({
      data: {
        orderId,
        productId: product.id,
        nameSnapshot: product.name,
        quantity: data.quantity,
        unitPrice: new Prisma.Decimal(Number(product.price)),
        taxPercent: new Prisma.Decimal(Number(product.taxPercent)),
        lineSubtotal: new Prisma.Decimal(totals.lineSubtotal),
        lineTax: new Prisma.Decimal(totals.lineTax),
        lineTotal: new Prisma.Decimal(totals.lineTotal),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Product is already on this order — update its quantity instead");
    }
    throw e;
  }

  await recomputeOrderTotals(orderId);
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "storeOrder",
    resourceId: orderId,
    diff: { addedProductId: product.id, quantity: data.quantity },
  });
  revalidatePath(`/app/store/orders/${orderId}`);
}

export async function updateOrderItemAction(itemId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "edit");
  const item = await prisma.storeOrderItem.findFirst({
    where: { id: itemId, order: { workspaceId: ctx.workspaceId } },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!item) throw new Error("Order item not found");
  ensurePending(item.order.status);

  const { quantity } = updateOrderItemSchema.parse(toFormObject(fd));
  const totals = computeLineTotals({
    unitPrice: item.unitPrice,
    taxPercent: item.taxPercent,
    quantity,
  });
  await prisma.storeOrderItem.update({
    where: { id: itemId },
    data: {
      quantity,
      lineSubtotal: new Prisma.Decimal(totals.lineSubtotal),
      lineTax: new Prisma.Decimal(totals.lineTax),
      lineTotal: new Prisma.Decimal(totals.lineTotal),
    },
  });
  await recomputeOrderTotals(item.order.id);
  revalidatePath(`/app/store/orders/${item.order.id}`);
}

export async function removeOrderItemAction(itemId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "edit");
  const item = await prisma.storeOrderItem.findFirst({
    where: { id: itemId, order: { workspaceId: ctx.workspaceId } },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!item) throw new Error("Order item not found");
  ensurePending(item.order.status);
  await prisma.storeOrderItem.delete({ where: { id: itemId } });
  await recomputeOrderTotals(item.order.id);
  revalidatePath(`/app/store/orders/${item.order.id}`);
}

export async function transitionOrderAction(orderId: string, fd: FormData) {
  const ctx = await requireSession();
  const next = s(fd, "to");
  if (!STORE_ORDER_STATUSES.includes(next as (typeof STORE_ORDER_STATUSES)[number])) {
    throw new Error("Invalid target status");
  }
  const order = await prisma.storeOrder.findFirst({
    where: { id: orderId, workspaceId: ctx.workspaceId },
    include: { _count: { select: { items: true } } },
  });
  if (!order) throw new Error("Order not found");
  if (!canTransitionOrder(order.status, next as (typeof STORE_ORDER_STATUSES)[number])) {
    throw new Error(`Cannot transition from ${order.status} to ${next}`);
  }

  if (next === "REFUNDED") {
    assertCan(ctx.role, "storeOrder", "manage");
  } else {
    assertCan(ctx.role, "storeOrder", "edit");
  }

  if (next === "PAID" && order._count.items === 0) {
    throw new Error("Cannot mark an empty order as paid");
  }

  const update: Prisma.StoreOrderUpdateInput = {
    status: next as (typeof STORE_ORDER_STATUSES)[number],
  };
  if (next === "PAID") update.paidAt = new Date();
  if (next === "FULFILLED") update.fulfilledAt = new Date();
  if (next === "CANCELED") update.canceledAt = new Date();
  if (next === "REFUNDED") update.refundedAt = new Date();

  await prisma.storeOrder.update({ where: { id: orderId }, data: update });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "storeOrder",
    resourceId: orderId,
    diff: { from: order.status, to: next },
  });
  revalidatePath(`/app/store/orders/${orderId}`);
  revalidatePath("/app/store/orders");
}

export async function deleteOrderAction(orderId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "delete");
  const order = await prisma.storeOrder.findFirst({
    where: { id: orderId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.status === "PAID" || order.status === "FULFILLED") {
    throw new Error("Paid or fulfilled orders cannot be deleted; refund instead");
  }
  await prisma.storeOrder.delete({ where: { id: orderId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "storeOrder",
    resourceId: orderId,
  });
  revalidatePath("/app/store/orders");
  redirect("/app/store/orders");
}
