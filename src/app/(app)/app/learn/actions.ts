"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  courseSchema,
  lessonSchema,
  enrollSchema,
  reorderSchema,
  slugifyCourse,
} from "@/modules/learn/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function loadCourse(workspaceId: string, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, workspaceId } });
  if (!course) throw new Error("Course not found");
  return course;
}

async function loadLesson(workspaceId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, course: { workspaceId } },
  });
  if (!lesson) throw new Error("Lesson not found");
  return lesson;
}

async function loadEnrollment(workspaceId: string, enrollmentId: string) {
  const e = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, course: { workspaceId } },
    include: { course: { select: { id: true, slug: true } } },
  });
  if (!e) throw new Error("Enrollment not found");
  return e;
}

export async function createCourseAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "create");

  const title = s(fd, "title");
  const slug = slugifyCourse(s(fd, "slug") || title);
  const parsed = courseSchema.safeParse({
    slug,
    title,
    summary: s(fd, "summary"),
    description: s(fd, "description"),
    coverImageUrl: s(fd, "coverImageUrl"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let course;
  try {
    course = await prisma.course.create({
      data: {
        workspaceId: ctx.workspaceId,
        slug: parsed.data.slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        description: parsed.data.description,
        coverImageUrl: parsed.data.coverImageUrl,
        createdById: ctx.userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Course slug already exists");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "course",
    resourceId: course.id,
    diff: { slug: course.slug, title: course.title },
  });

  revalidatePath("/app/learn");
  redirect(`/app/learn/${course.id}`);
}

export async function publishCourseAction(courseId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "edit");
  const course = await loadCourse(ctx.workspaceId, courseId);

  await prisma.course.update({
    where: { id: course.id },
    data: { status: "PUBLISHED", publishedAt: course.publishedAt ?? new Date() },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "course",
    resourceId: course.id,
    diff: { status: "PUBLISHED" },
  });

  revalidatePath(`/app/learn/${course.id}`);
  revalidatePath("/app/learn");
}

export async function archiveCourseAction(courseId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "edit");
  const course = await loadCourse(ctx.workspaceId, courseId);

  await prisma.course.update({ where: { id: course.id }, data: { status: "ARCHIVED" } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "course",
    resourceId: course.id,
    diff: { status: "ARCHIVED" },
  });

  revalidatePath(`/app/learn/${course.id}`);
  revalidatePath("/app/learn");
}

export async function deleteCourseAction(courseId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "delete");
  const course = await loadCourse(ctx.workspaceId, courseId);

  await prisma.course.delete({ where: { id: course.id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "course",
    resourceId: course.id,
    diff: { slug: course.slug },
  });

  revalidatePath("/app/learn");
  redirect("/app/learn");
}

export async function addLessonAction(courseId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "lesson", "create");
  const course = await loadCourse(ctx.workspaceId, courseId);

  const parsed = lessonSchema.safeParse({
    title: s(fd, "title"),
    content: s(fd, "content"),
    durationMinutes: s(fd, "durationMinutes") || "0",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const last = await prisma.lesson.findFirst({
    where: { courseId: course.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      position,
      title: parsed.data.title,
      content: parsed.data.content,
      durationMinutes: parsed.data.durationMinutes,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "lesson",
    resourceId: lesson.id,
    diff: { courseId: course.id, title: lesson.title },
  });

  revalidatePath(`/app/learn/${course.id}`);
}

export async function deleteLessonAction(lessonId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "lesson", "delete");
  const lesson = await loadLesson(ctx.workspaceId, lessonId);

  await prisma.lesson.delete({ where: { id: lesson.id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "lesson",
    resourceId: lesson.id,
    diff: { title: lesson.title },
  });

  revalidatePath(`/app/learn/${lesson.courseId}`);
}

export async function reorderLessonAction(lessonId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "lesson", "edit");
  const lesson = await loadLesson(ctx.workspaceId, lessonId);

  const parsed = reorderSchema.safeParse({ direction: s(fd, "direction") });
  if (!parsed.success) throw new Error("Invalid direction");

  const neighbor =
    parsed.data.direction === "up"
      ? await prisma.lesson.findFirst({
          where: { courseId: lesson.courseId, position: { lt: lesson.position } },
          orderBy: { position: "desc" },
        })
      : await prisma.lesson.findFirst({
          where: { courseId: lesson.courseId, position: { gt: lesson.position } },
          orderBy: { position: "asc" },
        });
  if (!neighbor) {
    revalidatePath(`/app/learn/${lesson.courseId}`);
    return;
  }

  // Swap positions using a temporary value to dodge the @@unique([courseId, position]).
  const tempPosition = -1 - lesson.position;
  await prisma.$transaction([
    prisma.lesson.update({ where: { id: lesson.id }, data: { position: tempPosition } }),
    prisma.lesson.update({ where: { id: neighbor.id }, data: { position: lesson.position } }),
    prisma.lesson.update({ where: { id: lesson.id }, data: { position: neighbor.position } }),
  ]);

  revalidatePath(`/app/learn/${lesson.courseId}`);
}

export async function enrollLearnerAction(courseId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "courseEnrollment", "create");
  const course = await loadCourse(ctx.workspaceId, courseId);

  const parsed = enrollSchema.safeParse({
    learnerEmail: s(fd, "learnerEmail"),
    learnerName: s(fd, "learnerName"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let enrollment;
  try {
    enrollment = await prisma.courseEnrollment.create({
      data: {
        courseId: course.id,
        learnerEmail: parsed.data.learnerEmail,
        learnerName: parsed.data.learnerName,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Learner already enrolled");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "courseEnrollment",
    resourceId: enrollment.id,
    diff: { courseId: course.id, learnerEmail: enrollment.learnerEmail },
  });

  revalidatePath(`/app/learn/${course.id}`);
}

export async function unenrollLearnerAction(enrollmentId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "courseEnrollment", "delete");
  const enrollment = await loadEnrollment(ctx.workspaceId, enrollmentId);

  await prisma.courseEnrollment.delete({ where: { id: enrollment.id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "courseEnrollment",
    resourceId: enrollment.id,
    diff: { courseId: enrollment.courseId, learnerEmail: enrollment.learnerEmail },
  });

  revalidatePath(`/app/learn/${enrollment.courseId}`);
}

export async function markLessonCompleteAction(enrollmentId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "courseEnrollment", "edit");
  const enrollment = await loadEnrollment(ctx.workspaceId, enrollmentId);

  const lessonId = s(fd, "lessonId");
  if (!lessonId) throw new Error("Lesson required");

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, courseId: enrollment.courseId },
    select: { id: true },
  });
  if (!lesson) throw new Error("Lesson not found in this course");

  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
    create: { enrollmentId: enrollment.id, lessonId: lesson.id },
    update: {},
  });

  // Auto-complete enrollment if every lesson now has progress.
  const [totalLessons, completedLessons] = await Promise.all([
    prisma.lesson.count({ where: { courseId: enrollment.courseId } }),
    prisma.lessonProgress.count({ where: { enrollmentId: enrollment.id } }),
  ]);
  if (totalLessons > 0 && completedLessons >= totalLessons && enrollment.status !== "COMPLETED") {
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  revalidatePath(`/app/learn/${enrollment.courseId}/learners/${enrollment.id}`);
  revalidatePath(`/app/learn/${enrollment.courseId}`);
}

export async function clearLessonCompletionAction(enrollmentId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "courseEnrollment", "edit");
  const enrollment = await loadEnrollment(ctx.workspaceId, enrollmentId);

  const lessonId = s(fd, "lessonId");
  if (!lessonId) throw new Error("Lesson required");

  await prisma.lessonProgress.deleteMany({
    where: { enrollmentId: enrollment.id, lessonId },
  });

  if (enrollment.status === "COMPLETED") {
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "ENROLLED", completedAt: null },
    });
  }

  revalidatePath(`/app/learn/${enrollment.courseId}/learners/${enrollment.id}`);
  revalidatePath(`/app/learn/${enrollment.courseId}`);
}
