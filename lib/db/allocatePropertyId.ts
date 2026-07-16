import type { PrismaClient } from "@prisma/client";
import { generatePropertyId } from "@/src/utils/id-generator";

type IdClient = Pick<PrismaClient, "listing">;

/**
 * Allocate a unique 6-char property ID that is unused in `listings.id`.
 */
export async function allocateUniquePropertyId(
  client: IdClient,
  maxAttempts = 24,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const id = generatePropertyId();
    const existing = await client.listing.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return id;
  }

  throw new Error(
    `Unable to allocate a unique property ID after ${maxAttempts} attempts`,
  );
}
