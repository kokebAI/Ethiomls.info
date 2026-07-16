import { Prisma } from "@prisma/client";

/** Coerce Prisma Json / unknown values into a string[]. */
export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      return asStringArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

export function asJsonStringArray(
  value: string[] | null | undefined,
): Prisma.InputJsonValue {
  return (value ?? []) as Prisma.InputJsonValue;
}
