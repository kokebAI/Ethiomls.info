/**
 * EthioMLS developer directory importer / light scraper.
 *
 * Default source: curated JSON at data/developers/addis-developers.json
 * Optional: Wikidata SPARQL discovery of Ethiopian real-estate organizations
 * (public CC0 data — rate-limited, polite User-Agent).
 *
 * Upserts User (CORPORATE_DEVELOPER) + DeveloperProfile by registrationNumber.
 *
 * Usage:
 *   npm run scrape:developers
 *   npm run scrape:developers -- --dry-run
 *   npm run scrape:developers -- --source=curated
 *   npm run scrape:developers -- --source=wikidata
 *   npm run scrape:developers -- --source=all --delay-ms=750
 *   npm run scrape:developers -- --file=data/developers/addis-developers.json
 *   npm run scrape:developers -- --verify   # mark profiles verified (trusted only)
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, UserRole } from "@prisma/client";

loadEnvFile(path.join(process.cwd(), ".env"));

const USER_AGENT =
  "EthioMLSDeveloperImporter/1.0 (+https://ethiomls.info; directory research; contact=ops@ethiomls.info)";
const DEFAULT_JSON = path.join(
  process.cwd(),
  "data/developers/addis-developers.json",
);
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

/**
 * Stable non-login stub — not a bcrypt hash. Import accounts cannot sign in
 * until claimed / password set through a proper onboarding flow.
 */
const IMPORT_PASSWORD_HASH =
  "scrape-import:disabled:" +
  createHash("sha256").update("ethiomls-developer-import-v1").digest("hex");

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
    // .env optional when vars are already exported
  }
}

type LocalizedName = { en: string; am: string; om?: string };

type CuratedDeveloper = {
  tradeName: string;
  displayName: LocalizedName;
  registrationNumber: string;
  website?: string | null;
  hqCode?: string | null;
  licenseNumber?: string | null;
  tin?: string | null;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
};

type CuratedFile = {
  source?: string;
  developers: CuratedDeveloper[];
};

type ImportRecord = {
  tradeName: string;
  displayName: LocalizedName;
  registrationNumber: string;
  website: string | null;
  hqCode: string | null;
  licenseNumber: string | null;
  tin: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  source: string;
};

type CliOptions = {
  dryRun: boolean;
  source: "curated" | "wikidata" | "all";
  file: string;
  delayMs: number;
  verify: boolean;
  limit: number | null;
};

const prisma = new PrismaClient();

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    source: "curated",
    file: DEFAULT_JSON,
    delayMs: 500,
    verify: false,
    limit: null,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--verify") opts.verify = true;
    else if (arg.startsWith("--source=")) {
      const v = arg.slice("--source=".length);
      if (v === "curated" || v === "wikidata" || v === "all") opts.source = v;
      else throw new Error(`Invalid --source=${v} (curated|wikidata|all)`);
    } else if (arg.startsWith("--file=")) {
      opts.file = path.resolve(process.cwd(), arg.slice("--file=".length));
    } else if (arg.startsWith("--delay-ms=")) {
      opts.delayMs = Math.max(0, Number(arg.slice("--delay-ms=".length)) || 0);
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      opts.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
EthioMLS developer scraper / importer

  --dry-run              Print actions without writing to the database
  --source=curated|wikidata|all   Default: curated
  --file=<path>          Curated JSON path (default: data/developers/addis-developers.json)
  --delay-ms=<n>         Pause between remote requests / upserts (default: 500)
  --limit=<n>            Cap number of developers processed
  --verify               Set isVerified=true (only for trusted sources)
  --help                 Show this help
`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function emailForRegistration(registrationNumber: string): string {
  const digest = createHash("sha1")
    .update(registrationNumber)
    .digest("hex")
    .slice(0, 10);
  const slug = slugify(registrationNumber) || digest;
  return `dev.${slug}.${digest}@import.ethiomls.local`;
}

function normalizeDisplayName(
  name: LocalizedName | string,
  fallback: string,
): LocalizedName {
  if (typeof name === "string") {
    return { en: name, am: name };
  }
  const en = name.en?.trim() || fallback;
  const am = name.am?.trim() || en;
  const om = name.om?.trim();
  return om ? { en, am, om } : { en, am };
}

async function loadCurated(filePath: string): Promise<ImportRecord[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as CuratedFile;
  if (!Array.isArray(parsed.developers)) {
    throw new Error(`Invalid curated file: missing developers[] in ${filePath}`);
  }

  return parsed.developers.map((d) => {
    const tradeName = d.tradeName.trim();
    const registrationNumber = d.registrationNumber.trim();
    if (!tradeName || !registrationNumber) {
      throw new Error("Each developer needs tradeName and registrationNumber");
    }
    return {
      tradeName,
      displayName: normalizeDisplayName(d.displayName, tradeName),
      registrationNumber,
      website: d.website?.trim() || null,
      hqCode: d.hqCode?.trim() || null,
      licenseNumber: d.licenseNumber?.trim() || null,
      tin: d.tin?.trim() || null,
      email: d.email?.trim() || emailForRegistration(registrationNumber),
      fullName: d.fullName?.trim() || `${tradeName} Admin`,
      phone: d.phone?.trim() || null,
      source: parsed.source || "curated-public-directory",
    };
  });
}

/**
 * Soft discovery via Wikidata (public SPARQL endpoint).
 * Labels only — registration numbers are synthetic ET-WD-* keys.
 */
const WIKIDATA_NAME_OK =
  /\b(real\s*estate|homes|developers?|properties|property\s+developer)\b/i;
const WIKIDATA_NAME_BLOCK =
  /\b(hotel|mall|aviation|airport|bank|university|ministry|museum|stadium|church|mosque|hospital|school|factory|industry|mining|airline)\b/i;

async function fetchWikidataDevelopers(delayMs: number): Promise<ImportRecord[]> {
  // Prefer industry=real estate (Q12271) or org labels that look like RE developers.
  const sparql = `
SELECT DISTINCT ?item ?itemLabel ?website WHERE {
  ?item wdt:P17 wd:Q115 .
  {
    ?item wdt:P452 wd:Q12271 .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q4830453 .
    ?item rdfs:label ?enLabel .
    FILTER(LANG(?enLabel) = "en")
    FILTER(REGEX(?enLabel, "(Real Estate|Homes|Developers)", "i"))
  }
  OPTIONAL { ?item wdt:P856 ?website . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,am". }
}
LIMIT 80
`.trim();

  console.log("Fetching Wikidata SPARQL (Ethiopian real-estate orgs)…");
  await sleep(delayMs);

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL failed: HTTP ${res.status}`);
  }

  const body = (await res.json()) as {
    results?: {
      bindings?: Array<{
        item?: { value?: string };
        itemLabel?: { value?: string };
        website?: { value?: string };
      }>;
    };
  };

  const bindings = body.results?.bindings ?? [];
  const out: ImportRecord[] = [];
  const seen = new Set<string>();

  for (const row of bindings) {
    const label = row.itemLabel?.value?.trim();
    const qid = row.item?.value?.split("/").pop();
    if (!label || !qid || seen.has(qid)) continue;
    if (/wikipedia|category|wikimedia/i.test(label)) continue;
    if (WIKIDATA_NAME_BLOCK.test(label)) continue;
    if (!WIKIDATA_NAME_OK.test(label)) continue;
    seen.add(qid);

    const registrationNumber = `ET-WD-${qid}`;
    out.push({
      tradeName: label,
      displayName: { en: label, am: label },
      registrationNumber,
      website: row.website?.value?.trim() || null,
      hqCode: null,
      licenseNumber: null,
      tin: null,
      email: emailForRegistration(registrationNumber),
      fullName: `${label} Admin`,
      phone: null,
      source: "wikidata",
    });
  }

  console.log(
    `Wikidata returned ${out.length} filtered developer candidates (from ${bindings.length} raw rows).`,
  );
  return out;
}

function mergeRecords(batches: ImportRecord[][]): ImportRecord[] {
  const byReg = new Map<string, ImportRecord>();
  for (const batch of batches) {
    for (const rec of batch) {
      const existing = byReg.get(rec.registrationNumber);
      if (!existing) {
        byReg.set(rec.registrationNumber, rec);
        continue;
      }
      // Prefer curated when colliding — keep richer fields
      byReg.set(rec.registrationNumber, {
        ...existing,
        ...rec,
        website: rec.website || existing.website,
        hqCode: rec.hqCode || existing.hqCode,
        displayName: {
          en: rec.displayName.en || existing.displayName.en,
          am: rec.displayName.am || existing.displayName.am,
          ...(rec.displayName.om || existing.displayName.om
            ? { om: rec.displayName.om || existing.displayName.om }
            : {}),
        },
        source: `${existing.source}+${rec.source}`,
      });
    }
  }
  return [...byReg.values()];
}

async function upsertDeveloper(
  rec: ImportRecord,
  subCityByCode: Map<string, string>,
  opts: CliOptions,
): Promise<"created" | "updated" | "skipped"> {
  const hqId = rec.hqCode ? subCityByCode.get(rec.hqCode) : undefined;
  if (rec.hqCode && !hqId) {
    console.warn(
      `  ! Unknown hqCode "${rec.hqCode}" for ${rec.registrationNumber} — leaving HQ unset`,
    );
  }

  if (opts.dryRun) {
    console.log(
      `  [dry-run] upsert ${rec.registrationNumber} — ${rec.tradeName}` +
        (hqId ? ` (hq=${rec.hqCode})` : "") +
        (opts.verify ? " [verify]" : ""),
    );
    return "skipped";
  }

  const existing = await prisma.developerProfile.findUnique({
    where: { registrationNumber: rec.registrationNumber },
    select: { id: true, userId: true, isVerified: true },
  });

  const user = await prisma.user.upsert({
    where: { email: rec.email },
    update: {
      fullName: rec.fullName,
      role: UserRole.CORPORATE_DEVELOPER,
      isActive: true,
    },
    create: {
      email: rec.email,
      passwordHash: IMPORT_PASSWORD_HASH,
      fullName: rec.fullName,
      role: UserRole.CORPORATE_DEVELOPER,
      localePrefs: ["am", "en"],
    },
  });

  if (rec.phone) {
    const phoneTaken = await prisma.user.findFirst({
      where: { phone: rec.phone, NOT: { id: user.id } },
      select: { id: true },
    });
    if (!phoneTaken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: rec.phone },
      });
    }
  }

  // If registration exists but is tied to a different user email, keep the profile
  // linked to its original user and only refresh directory fields.
  const userId = existing?.userId ?? user.id;

  await prisma.developerProfile.upsert({
    where: { registrationNumber: rec.registrationNumber },
    update: {
      tradeName: rec.tradeName,
      displayName: rec.displayName,
      licenseNumber: rec.licenseNumber,
      tin: rec.tin,
      website: rec.website,
      headquartersSubCityId: hqId ?? null,
      // Never clear verified seed profiles; only elevate when --verify
      isVerified: opts.verify ? true : (existing?.isVerified ?? false),
      userId,
    },
    create: {
      userId,
      tradeName: rec.tradeName,
      displayName: rec.displayName,
      registrationNumber: rec.registrationNumber,
      licenseNumber: rec.licenseNumber,
      tin: rec.tin,
      website: rec.website,
      headquartersSubCityId: hqId ?? null,
      isVerified: opts.verify,
    },
  });

  return existing ? "updated" : "created";
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("EthioMLS developer scrape/import");
  console.log(
    JSON.stringify(
      {
        dryRun: opts.dryRun,
        source: opts.source,
        file: opts.file,
        delayMs: opts.delayMs,
        verify: opts.verify,
        limit: opts.limit,
      },
      null,
      2,
    ),
  );

  const batches: ImportRecord[][] = [];

  if (opts.source === "curated" || opts.source === "all") {
    const curated = await loadCurated(opts.file);
    console.log(`Loaded ${curated.length} curated developers from ${opts.file}`);
    batches.push(curated);
  }

  if (opts.source === "wikidata" || opts.source === "all") {
    try {
      batches.push(await fetchWikidataDevelopers(opts.delayMs));
    } catch (err) {
      console.error(
        `Wikidata fetch failed (continuing with curated if any):`,
        err instanceof Error ? err.message : err,
      );
      if (opts.source === "wikidata" && batches.length === 0) throw err;
    }
  }

  let records = mergeRecords(batches);
  if (opts.limit != null) records = records.slice(0, opts.limit);

  console.log(`Processing ${records.length} unique developers…`);

  const subCities = await prisma.subCity.findMany({
    select: { id: true, code: true },
  });
  const subCityByCode = new Map(subCities.map((s) => [s.code, s.id]));

  if (subCities.length === 0 && !opts.dryRun) {
    console.warn(
      "Warning: no SubCity rows found. Run `npm run db:seed` so HQ codes can map.",
    );
  }

  let created = 0;
  let updated = 0;
  let drySkipped = 0;
  let failed = 0;

  for (const rec of records) {
    try {
      const result = await upsertDeveloper(rec, subCityByCode, opts);
      if (result === "created") created += 1;
      else if (result === "updated") updated += 1;
      else drySkipped += 1;
      console.log(
        `  ✓ ${rec.registrationNumber} — ${rec.tradeName} (${result}) [${rec.source}]`,
      );
    } catch (err) {
      failed += 1;
      console.error(
        `  ✗ ${rec.registrationNumber} — ${rec.tradeName}:`,
        err instanceof Error ? err.message : err,
      );
    }
    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }

  const totalInDb = opts.dryRun
    ? null
    : await prisma.developerProfile.count();

  console.log("\nSummary");
  console.log(
    JSON.stringify(
      {
        processed: records.length,
        created,
        updated,
        dryRunWouldUpsert: drySkipped,
        failed,
        totalDeveloperProfiles: totalInDb,
        verifiedByDefault: opts.verify,
      },
      null,
      2,
    ),
  );

  if (opts.dryRun) {
    console.log("\nDry-run only — re-run without --dry-run to write to the database.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
