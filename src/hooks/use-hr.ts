"use client";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useHRStore } from "@/store/hr-store";
import type { AppNotification, Department, Designation, Employee, Role } from "@/types";
import { can, type Permission } from "@/lib/permissions";
import { defaultNotificationPrefs } from "@/store/hr-store";

/** True once the component is mounted on the client and the persisted store is loaded. */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const p = useHRStore.persist;
    if (p.hasHydrated()) setReady(true);
    const unsub = p.onFinishHydration(() => setReady(true));
    return unsub;
  }, []);
  return ready;
}

export function useSession() {
  const { currentUserId, demoUsers, employees } = useHRStore(
    useShallow((s) => ({ currentUserId: s.currentUserId, demoUsers: s.data.demoUsers, employees: s.data.employees })),
  );
  return useMemo(() => {
    const user = demoUsers.find((u) => u.id === currentUserId) ?? null;
    const employee = user ? (employees.find((e) => e.id === user.employeeId) ?? null) : null;
    return { user, employee, role: (user?.role ?? null) as Role | null };
  }, [currentUserId, demoUsers, employees]);
}

/** Session for pages rendered inside the authenticated shell (user is guaranteed). */
export function useAuth() {
  const s = useSession();
  return s as { user: NonNullable<typeof s.user>; employee: Employee; role: Role };
}

export function usePermission(permission: Permission) {
  const { role } = useSession();
  return can(role ?? undefined, permission);
}

export function useLookups() {
  const { employees, departments, designations } = useHRStore(
    useShallow((s) => ({ employees: s.data.employees, departments: s.data.departments, designations: s.data.designations })),
  );
  return useMemo(() => {
    const emp = new Map<string, Employee>(employees.map((e) => [e.id, e]));
    const dept = new Map<string, Department>(departments.map((d) => [d.id, d]));
    const des = new Map<string, Designation>(designations.map((d) => [d.id, d]));
    return {
      employee: (id: string | null | undefined) => (id ? emp.get(id) : undefined),
      name: (id: string | null | undefined) => {
        const e = id ? emp.get(id) : undefined;
        return e ? `${e.firstName} ${e.lastName}` : "—";
      },
      department: (id: string | null | undefined) => (id ? dept.get(id) : undefined),
      deptName: (id: string | null | undefined) => (id ? (dept.get(id)?.name ?? "—") : "—"),
      designation: (id: string | null | undefined) => (id ? des.get(id) : undefined),
      desName: (id: string | null | undefined) => (id ? (des.get(id)?.title ?? "—") : "—"),
    };
  }, [employees, departments, designations]);
}

/** Employees the current user may see in team-scoped views. */
export function useScopedEmployees(options: { includeArchived?: boolean } = {}) {
  const employees = useHRStore((s) => s.data.employees);
  const { role, employee } = useSession();
  return useMemo(() => {
    const list = options.includeArchived ? employees : employees.filter((e) => !e.archived);
    if (role === "team_lead" && employee) return list.filter((e) => e.managerId === employee.id);
    if (role === "employee" && employee) return list.filter((e) => e.id === employee.id);
    return list;
  }, [employees, role, employee, options.includeArchived]);
}

export function isVisibleNotification(n: AppNotification, employeeId: string, role: Role) {
  return n.recipientEmployeeId === employeeId || n.recipientRole === role;
}

export function useMyNotifications() {
  const notifications = useHRStore((s) => s.data.notifications);
  const prefs = useHRStore((s) => (s.currentUserId ? s.notificationPrefs[s.currentUserId] : undefined));
  const { user } = useSession();
  return useMemo(() => {
    if (!user) return [] as AppNotification[];
    const p = prefs ?? defaultNotificationPrefs;
    return notifications
      .filter((n) => isVisibleNotification(n, user.employeeId, user.role) && p[n.type] !== false)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, prefs, user]);
}
