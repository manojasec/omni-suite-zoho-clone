"use client";

import { createContext, useContext } from "react";
import type { SystemRole } from "@prisma/client";
import { can } from "./matrix";
import type { Resource, Action } from "./matrix";

const PermissionContext = createContext<SystemRole | null>(null);

export function PermissionProvider({
  role,
  children,
}: {
  role: SystemRole;
  children: React.ReactNode;
}) {
  return <PermissionContext.Provider value={role}>{children}</PermissionContext.Provider>;
}

/**
 * Client-side permission check. Hides UI; the server is the source of truth.
 * Always returns false outside a PermissionProvider.
 */
export function usePermission(resource: Resource, action: Action): boolean {
  const role = useContext(PermissionContext);
  if (!role) return false;
  return can(role, resource, action);
}

/** Convenience component: render children only when the user can perform an action. */
export function Can({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: Resource;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = usePermission(resource, action);
  return <>{allowed ? children : fallback}</>;
}
