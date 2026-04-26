import { describe, expect, it } from "vitest";
import {
  applicationSubmissionSchema,
  careerJobSlugSchema,
  formatEmploymentType,
  formatSalaryRange,
  slugifyTitle,
} from "@/modules/recruit/career-schemas";

describe("slugifyTitle", () => {
  it("lowercases and dasherizes a title", () => {
    expect(slugifyTitle("Senior Software Engineer")).toBe("senior-software-engineer");
  });

  it("strips diacritics", () => {
    expect(slugifyTitle("Café Manager")).toBe("cafe-manager");
  });

  it("collapses non-alphanum runs", () => {
    expect(slugifyTitle("C++   /  Rust  Engineer!")).toBe("c-rust-engineer");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugifyTitle("---hello---")).toBe("hello");
  });

  it("returns empty for empty input", () => {
    expect(slugifyTitle("")).toBe("");
  });

  it("caps length at 160 characters", () => {
    const long = "a".repeat(300);
    expect(slugifyTitle(long).length).toBe(160);
  });
});

describe("careerJobSlugSchema", () => {
  it("accepts an empty string", () => {
    expect(careerJobSlugSchema.parse("")).toBe("");
  });

  it("accepts a valid slug", () => {
    expect(careerJobSlugSchema.parse("senior-engineer-2")).toBe("senior-engineer-2");
  });

  it("rejects uppercase or spaces", () => {
    expect(careerJobSlugSchema.safeParse("Bad Slug!").success).toBe(false);
    expect(careerJobSlugSchema.safeParse("Engineer").success).toBe(false);
  });

  it("rejects slugs over 160 characters", () => {
    expect(careerJobSlugSchema.safeParse("a".repeat(161)).success).toBe(false);
  });
});

describe("applicationSubmissionSchema", () => {
  const base = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  };

  it("accepts a minimal valid submission", () => {
    const r = applicationSubmissionSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("requires firstName, lastName, and email", () => {
    expect(
      applicationSubmissionSchema.safeParse({ ...base, firstName: "" }).success,
    ).toBe(false);
    expect(
      applicationSubmissionSchema.safeParse({ ...base, lastName: "" }).success,
    ).toBe(false);
    expect(
      applicationSubmissionSchema.safeParse({ ...base, email: "" }).success,
    ).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      applicationSubmissionSchema.safeParse({ ...base, email: "not-an-email" })
        .success,
    ).toBe(false);
  });

  it("rejects malformed URL fields", () => {
    expect(
      applicationSubmissionSchema.safeParse({
        ...base,
        linkedinUrl: "not-a-url",
      }).success,
    ).toBe(false);
    expect(
      applicationSubmissionSchema.safeParse({ ...base, resumeUrl: "ftp//bad" })
        .success,
    ).toBe(false);
  });

  it("accepts empty optional URL fields", () => {
    const r = applicationSubmissionSchema.safeParse({
      ...base,
      linkedinUrl: "",
      resumeUrl: "",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a cover letter over 5000 characters", () => {
    const r = applicationSubmissionSchema.safeParse({
      ...base,
      coverLetter: "x".repeat(5001),
    });
    expect(r.success).toBe(false);
  });

  it("defaults source to career-site", () => {
    const r = applicationSubmissionSchema.parse(base);
    expect(r.source).toBe("career-site");
  });
});

describe("formatSalaryRange", () => {
  it("formats a min–max range", () => {
    expect(formatSalaryRange(80000, 120000, "USD")).toBe("$80k–$120k USD");
  });

  it("formats Up to when only max is set", () => {
    expect(formatSalaryRange(null, 100000, "USD")).toBe("Up to $100k USD");
  });

  it("formats From when only min is set", () => {
    expect(formatSalaryRange(50000, null, "USD")).toBe("From $50k USD");
  });

  it("returns Not specified when both are missing", () => {
    expect(formatSalaryRange(null, null)).toBe("Not specified");
    expect(formatSalaryRange(undefined, undefined)).toBe("Not specified");
  });
});

describe("formatEmploymentType", () => {
  it("maps each enum value to a label", () => {
    expect(formatEmploymentType("FULL_TIME")).toBe("Full time");
    expect(formatEmploymentType("PART_TIME")).toBe("Part time");
    expect(formatEmploymentType("CONTRACT")).toBe("Contract");
    expect(formatEmploymentType("INTERN")).toBe("Internship");
    expect(formatEmploymentType("TEMPORARY")).toBe("Temporary");
  });

  it("falls back to the input for unknown values", () => {
    expect(formatEmploymentType("WHATEVER")).toBe("WHATEVER");
  });
});
