import { z } from "zod";

const trimmedOptional = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim() || undefined);

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  managerId: trimmedOptional,
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const employeeSchema = z.object({
  employeeNumber: z.string().trim().min(1, "Employee number is required").max(50),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().email("Valid email is required"),
  phone: trimmedOptional,
  jobTitle: trimmedOptional,
  departmentId: trimmedOptional,
  managerId: trimmedOptional,
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"])
    .default("FULL_TIME"),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]).default("ACTIVE"),
  hireDate: z.string().min(1, "Hire date is required"),
  terminationDate: trimmedOptional,
  address: trimmedOptional,
  notes: trimmedOptional,
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  daysPerYear: z.coerce.number().int().min(0).max(366).default(0),
  paid: z.coerce.boolean().default(true),
});
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;

export const leaveRequestSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    leaveTypeId: z.string().min(1, "Leave type is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    days: z.coerce.number().positive("Days must be greater than 0").max(366),
    reason: trimmedOptional,
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const attendanceSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    date: z.string().min(1, "Date is required"),
    checkIn: trimmedOptional,
    checkOut: trimmedOptional,
    hours: z.coerce.number().min(0).max(24).default(0),
    note: trimmedOptional,
  })
  .refine(
    (v) => {
      if (v.checkIn && v.checkOut) {
        return new Date(v.checkOut) >= new Date(v.checkIn);
      }
      return true;
    },
    { message: "Check-out must be after check-in", path: ["checkOut"] },
  );
export type AttendanceInput = z.infer<typeof attendanceSchema>;
