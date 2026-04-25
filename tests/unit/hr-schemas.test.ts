import { describe, expect, it } from "vitest";
import {
  departmentSchema,
  employeeSchema,
  leaveTypeSchema,
  leaveRequestSchema,
  attendanceSchema,
} from "@/modules/hr/schemas";

describe("hr/schemas", () => {
  describe("departmentSchema", () => {
    it("requires name", () => {
      expect(departmentSchema.safeParse({ name: "" }).success).toBe(false);
    });
    it("accepts valid", () => {
      expect(departmentSchema.safeParse({ name: "Engineering" }).success).toBe(true);
    });
  });

  describe("employeeSchema", () => {
    const base = {
      employeeNumber: "EMP-001",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      hireDate: "2026-01-01",
    };
    it("requires email format", () => {
      expect(employeeSchema.safeParse({ ...base, email: "not-email" }).success).toBe(false);
    });
    it("accepts a minimal valid input with defaults", () => {
      const r = employeeSchema.safeParse(base);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.employmentType).toBe("FULL_TIME");
        expect(r.data.status).toBe("ACTIVE");
      }
    });
    it("rejects missing employee number", () => {
      expect(employeeSchema.safeParse({ ...base, employeeNumber: "" }).success).toBe(false);
    });
  });

  describe("leaveTypeSchema", () => {
    it("coerces daysPerYear from string", () => {
      const r = leaveTypeSchema.safeParse({ name: "Annual", daysPerYear: "20" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.daysPerYear).toBe(20);
    });
    it("rejects negative days", () => {
      expect(leaveTypeSchema.safeParse({ name: "X", daysPerYear: "-5" }).success).toBe(false);
    });
  });

  describe("leaveRequestSchema", () => {
    const base = {
      employeeId: "emp1",
      leaveTypeId: "lt1",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
      days: "3",
    };
    it("rejects end before start", () => {
      const r = leaveRequestSchema.safeParse({ ...base, endDate: "2026-01-09" });
      expect(r.success).toBe(false);
    });
    it("accepts valid range", () => {
      expect(leaveRequestSchema.safeParse(base).success).toBe(true);
    });
    it("rejects zero days", () => {
      expect(leaveRequestSchema.safeParse({ ...base, days: "0" }).success).toBe(false);
    });
  });

  describe("attendanceSchema", () => {
    const base = {
      employeeId: "emp1",
      date: "2026-01-10",
      hours: "8",
    };
    it("accepts hours-only entry", () => {
      expect(attendanceSchema.safeParse(base).success).toBe(true);
    });
    it("rejects hours > 24", () => {
      expect(attendanceSchema.safeParse({ ...base, hours: "25" }).success).toBe(false);
    });
    it("rejects checkOut before checkIn", () => {
      const r = attendanceSchema.safeParse({
        ...base,
        checkIn: "2026-01-10T17:00:00",
        checkOut: "2026-01-10T09:00:00",
      });
      expect(r.success).toBe(false);
    });
  });
});
