/**
 * Backfill cover/gallery photos for every listing (and parent project) that
 * still has none. Prefers scraped developer-site images when available;
 * otherwise uses curated Unsplash residential pools so cards/detail always
 * show a real photo plane.
 *
 *   npx tsx scripts/backfill-all-listing-photos.ts
 *   npx tsx scripts/backfill-all-listing-photos.ts --dry-run
 *   npx tsx scripts/backfill-all-listing-photos.ts --write-json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;

/** Verified Unsplash residential / interior photos (HEAD 200). */
const STOCK = [
  u("1600596542815-ffad4c1539a9"),
  u("1600607687939-ce8a6c25118c"),
  u("1502672260266-1c1ef2d93688"),
  u("1564013799919-ab600027ffc6"),
  u("1600585154340-be6161a56a0c"),
  u("1512917774080-9991f1c4c750"),
  u("1600566753190-17f0baa2a6c3"),
  u("1600210492493-0946911123ea"),
  u("1600573472592-401b489a3cdc"),
  u("1600585154526-990dced4db0d"),
  u("1613490493576-7fde63acd811"),
  u("1605276374104-dee2a0ed3cd6"),
  u("1600585152220-90363fe7e115"),
  u("1484154218962-a197022b5858"),
  u("1522708323590-d24dbb6b0267"),
  u("1505691938895-1758d7feb511"),
  u("1560448204-603b3fc33ddc"),
  u("1582268611958-ebfd161ef9cf"),
  u("1556912172-45b7abe8b7e1"),
  u("1560185127-6ed189bf02f4"),
];

/** Prefer real developer CDN images when we have them. */
const DEVELOPER_SCRAPED: Record<string, string[]> = {
  "SKYTOWER-2025": [
    "https://noahrealestateplc.com/images/noah/projects/intro_images/noah_centrum_hero.jpg",
    "https://noahrealestateplc.com/images/noah/projects/intro_images/Askuwal_gallery1.jpg",
    "https://noahrealestateplc.com/images/noah/projects/intro_images/garden_ph1.jpg",
    "https://noahrealestateplc.com/images/noah/projects/intro_images/garden_ph2.jpg",
    "https://noahrealestateplc.com/images/noah/projects/intro_images/photo_21_2024-06-13_15-04-57.jpg",
    "https://noahrealestateplc.com/images/noah/projects/intro_images/photo_26_2024-06-13_15-04-57.jpg",
  ],
  "AYAT-HILLS-2025": [
    "https://ayatrealestate.com/_next/static/media/property_twentytwo.9afdcffc.webp",
    ...STOCK.slice(0, 5),
  ],
  "EVERGREEN-LMK-2026": [
    "https://static.wixstatic.com/media/5d9109_5f1e89f321aa4a468caaa425ea0656f4~mv2.jpg/v1/fill/w_1400,h_900,al_c,q_85,enc_auto/project.jpg",
    "https://static.wixstatic.com/media/5d9109_4fa9ad8b220f4953a3b1f35283893427~mv2.jpg/v1/fill/w_1400,h_900,al_c,q_85,enc_auto/project.jpg",
    "https://static.wixstatic.com/media/5d9109_c29113df514b4246b8409a4ae69e13d1~mv2.jpg/v1/fill/w_1400,h_900,al_c,q_85,enc_auto/project.jpg",
    "https://static.wixstatic.com/media/5d9109_8a1c4aa01a2941bb8dbb99d79f5e566c~mv2.jpg/v1/fill/w_1400,h_900,al_c,q_85,enc_auto/project.jpg",
  ],
  "FLINT-GARDENS-2026": [
    "https://www.flintstonehomes.com/default-og-image.jpg",
    ...STOCK.slice(2, 7),
  ],
};

function poolForSlug(slug: string, index: number): string[] {
  const scraped = DEVELOPER_SCRAPED[slug];
  if (scraped?.length) return scraped.slice(0, 6);
  // Rotate stock so projects don't all share the same cover.
  const start = (index * 3) % STOCK.length;
  const gallery: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    gallery.push(STOCK[(start + i) % STOCK.length]!);
  }
  return gallery;
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run"),
    writeJson: argv.includes("--write-json"),
  };
}

type CuratedFile = {
  source?: string;
  projects: Array<{
    slug: string;
    coverImageUrl?: string | null;
    galleryImageUrls?: string[];
    [key: string]: unknown;
  }>;
};

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const jsonPath = path.join(process.cwd(), "data/projects/addis-projects.json");
  const curated = JSON.parse(readFileSync(jsonPath, "utf8")) as CuratedFile;

  const slugGalleries = new Map<string, string[]>();
  curated.projects.forEach((project, index) => {
    const existing = (project.galleryImageUrls ?? []).filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    );
    const gallery =
      existing.length >= 3 ? existing : poolForSlug(project.slug, index);
    slugGalleries.set(project.slug, gallery);
    if (opts.writeJson || existing.length < 3) {
      project.coverImageUrl = gallery[0] ?? null;
      project.galleryImageUrls = gallery;
    }
  });

  if (opts.writeJson && !opts.dryRun) {
    writeFileSync(jsonPath, `${JSON.stringify(curated, null, 2)}\n`, "utf8");
    console.log(`Wrote galleries into ${jsonPath}`);
  }

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      coverImageUrl: true,
      galleryImageUrls: true,
      title: true,
    },
  });

  let projectsUpdated = 0;
  let listingsUpdated = 0;

  for (const [index, project] of projects.entries()) {
    const titleEn =
      project.title &&
      typeof project.title === "object" &&
      project.title !== null &&
      "en" in project.title
        ? String((project.title as { en?: string }).en ?? "")
        : "";

    const alreadyHasGallery =
      Boolean(project.coverImageUrl) && project.galleryImageUrls.length >= 3;

    let gallery: string[] | undefined;
    if (alreadyHasGallery) {
      gallery = project.galleryImageUrls;
    } else {
      for (const [slug, urls] of slugGalleries) {
        if (project.id.toUpperCase().includes(slug.toUpperCase())) {
          gallery = urls;
          break;
        }
      }
      if (!gallery) gallery = poolForSlug(project.id, index + 20);
    }

    const cover = gallery[0] ?? null;
    console.log(
      `${opts.dryRun ? "[dry-run] " : ""}project ${project.id} · ${titleEn || "—"} · ${gallery.length} photos${alreadyHasGallery ? " (keep)" : ""}`,
    );

    if (!opts.dryRun) {
      if (!alreadyHasGallery) {
        await prisma.project.update({
          where: { id: project.id },
          data: { coverImageUrl: cover, galleryImageUrls: gallery },
        });
        projectsUpdated += 1;
      }

      const result = await prisma.listing.updateMany({
        where: {
          projectId: project.id,
          OR: [{ coverImageUrl: null }, { images: { isEmpty: true } }],
        },
        data: {
          coverImageUrl: cover,
          galleryImageUrls: gallery,
          images: gallery,
        },
      });
      listingsUpdated += result.count;
    }
  }

  // Listings with no project (seed / document submissions).
  const orphans = await prisma.listing.findMany({
    where: {
      projectId: null,
      OR: [{ coverImageUrl: null }, { images: { isEmpty: true } }],
    },
    select: { id: true, category: true },
  });

  for (const [index, listing] of orphans.entries()) {
    const gallery = poolForSlug(`orphan-${listing.id}`, index + 40);
    const cover = gallery[0]!;
    console.log(
      `${opts.dryRun ? "[dry-run] " : ""}orphan listing ${listing.id} · ${gallery.length} photos`,
    );
    if (!opts.dryRun) {
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          coverImageUrl: cover,
          galleryImageUrls: gallery,
          images: gallery,
        },
      });
      listingsUpdated += 1;
    }
  }

  // Catch-all: any remaining listing still missing a cover.
  if (!opts.dryRun) {
    const stillMissing = await prisma.listing.findMany({
      where: {
        OR: [{ coverImageUrl: null }, { images: { isEmpty: true } }],
      },
      select: { id: true, projectId: true },
    });
    for (const [index, listing] of stillMissing.entries()) {
      const gallery = poolForSlug(`remain-${listing.id}`, index + 60);
      await prisma.listing.update({
        where: { id: listing.id },
        data: {
          coverImageUrl: gallery[0],
          galleryImageUrls: gallery,
          images: gallery,
        },
      });
      listingsUpdated += 1;
      console.log(`filled remaining ${listing.id}`);
    }
  }

  const withCover = await prisma.listing.count({
    where: { coverImageUrl: { not: null } },
  });
  const total = await prisma.listing.count();

  console.log(
    JSON.stringify(
      {
        dryRun: opts.dryRun,
        projectsUpdated,
        listingsUpdated,
        withCover,
        total,
      },
      null,
      2,
    ),
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
