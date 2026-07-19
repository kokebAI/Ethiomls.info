/**
 * One-shot: attach Kavod mall website photos to curated projects + unit listings.
 *
 *   npx tsx scripts/backfill-kavod-photos.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildProjectId } from "../lib/properties/propertyId";

function loadEnvFile(filePath: string) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));

const prisma = new PrismaClient();

type CuratedProject = {
  slug: string;
  registrationNumber: string;
  subCityCode: string;
  coverImageUrl?: string | null;
  galleryImageUrls?: string[];
};

async function main() {
  const file = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data/projects/addis-projects.json"),
      "utf8",
    ),
  ) as { projects: CuratedProject[] };

  const kavod = file.projects.filter(
    (p) => p.registrationNumber === "ET-DIR-KAVOD-024",
  );

  const dev = await prisma.developerProfile.findFirst({
    where: { registrationNumber: "ET-DIR-KAVOD-024" },
    select: { id: true, tradeName: true, registrationNumber: true },
  });
  if (!dev) throw new Error("Kavod developer profile not found");

  let projectsUpdated = 0;
  let listingsUpdated = 0;

  for (const rec of kavod) {
    const gallery = [
      ...new Set(
        (rec.galleryImageUrls ?? []).filter(
          (url): url is string => typeof url === "string" && url.length > 0,
        ),
      ),
    ];
    const cover =
      (typeof rec.coverImageUrl === "string" && rec.coverImageUrl) ||
      gallery[0] ||
      null;
    if (!cover) {
      console.warn(`skip ${rec.slug}: no photos`);
      continue;
    }

    const projectId = buildProjectId({
      subCityCode: rec.subCityCode,
      developerRegistration: rec.registrationNumber,
      developerTradeName: dev.tradeName,
      slug: rec.slug,
    });

    const project = await prisma.project.updateMany({
      where: { id: projectId },
      data: { coverImageUrl: cover, galleryImageUrls: gallery },
    });
    projectsUpdated += project.count;

    const listings = await prisma.listing.updateMany({
      where: { developerId: dev.id, projectId },
      data: {
        coverImageUrl: cover,
        galleryImageUrls: gallery,
        images: gallery,
      },
    });
    listingsUpdated += listings.count;

    console.log(
      `✓ ${rec.slug} → ${projectId} · project=${project.count} listings=${listings.count} photos=${gallery.length}`,
    );
  }

  const withPhotos = await prisma.listing.count({
    where: {
      developerId: dev.id,
      coverImageUrl: { not: null },
      NOT: { metadataTags: { has: "document-assisted-submission" } },
    },
  });

  console.log(
    JSON.stringify({ projectsUpdated, listingsUpdated, withPhotos }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
