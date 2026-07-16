/**
 * Schedulable EthioMLS scrape runner (developers + projects when available).
 *
 * Follows the same CLI pattern as `stale-listings.ts`:
 *   npm run cron:scrape                 # one-shot
 *   npm run cron:scrape:schedule        # node-cron daemon
 *
 * Default schedule: weekly Sunday 03:00 Africa/Addis_Ababa (curated JSON
 * importers). Dry-run is OFF for scheduled/production runs.
 *
 * Env:
 *   SCRAPE_CRON_SCHEDULE   cron expr (default "0 3 * * 0")
 *   SCRAPE_TARGETS         auto | developers | projects | all (default auto)
 *   SCRAPE_DRY_RUN         "true"/"1" to force dry-run (default false)
 *   SCRAPE_DEVELOPERS_DELAY_MS  forwarded as --delay-ms (default 750)
 *   SCRAPE_TIMEZONE        IANA tz (default Africa/Addis_Ababa)
 *
 * Targets `auto` / `all`: run developers always; run projects only when
 * `scripts/scrape-projects.ts` exists (hook for the projects scraper).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import cron from "node-cron";

const ROOT = process.cwd();
const TSX_BIN = path.join(ROOT, "node_modules", ".bin", "tsx");
const DEVELOPERS_SCRIPT = path.join(ROOT, "scripts", "scrape-developers.ts");
const PROJECTS_SCRIPT = path.join(ROOT, "scripts", "scrape-projects.ts");

/** Weekly Sunday 03:00 — polite cadence for curated importers. */
const DEFAULT_CRON = "0 3 * * 0";
const DEFAULT_TZ = "Africa/Addis_Ababa";
const DEFAULT_DEVELOPERS_DELAY_MS = 750;

type ScrapeTarget = "developers" | "projects";

type CronScrapeOptions = {
  targets: ScrapeTarget[] | "auto";
  dryRun: boolean;
  developersDelayMs: number;
  scheduleExpr: string;
  timezone: string;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

function parseTargetsToken(
  raw: string | undefined,
): ScrapeTarget[] | "auto" {
  if (!raw || !raw.trim()) return "auto";
  const token = raw.trim().toLowerCase();
  if (token === "auto" || token === "all") return "auto";
  const parts = token.split(/[,+\s]+/).filter(Boolean);
  const out: ScrapeTarget[] = [];
  for (const p of parts) {
    if (p === "developers" || p === "developer") out.push("developers");
    else if (p === "projects" || p === "project") out.push("projects");
    else {
      throw new Error(
        `Unknown scrape target "${p}". Use auto|developers|projects|all.`,
      );
    }
  }
  if (out.length === 0) return "auto";
  return [...new Set(out)];
}

function parseCliOptions(argv: string[]): CronScrapeOptions {
  let targets = parseTargetsToken(process.env.SCRAPE_TARGETS);
  // Scheduled / one-shot production runs write to DB unless explicitly opted out.
  let dryRun = parseBool(process.env.SCRAPE_DRY_RUN, false);
  let developersDelayMs = Number.parseInt(
    process.env.SCRAPE_DEVELOPERS_DELAY_MS ?? "",
    10,
  );
  if (!Number.isFinite(developersDelayMs) || developersDelayMs < 0) {
    developersDelayMs = DEFAULT_DEVELOPERS_DELAY_MS;
  }
  let scheduleExpr =
    process.env.SCRAPE_CRON_SCHEDULE?.trim() || DEFAULT_CRON;
  let timezone = process.env.SCRAPE_TIMEZONE?.trim() || DEFAULT_TZ;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--no-dry-run") dryRun = false;
    else if (arg.startsWith("--targets=")) {
      targets = parseTargetsToken(arg.slice("--targets=".length));
    } else if (arg.startsWith("--delay-ms=")) {
      const n = Number.parseInt(arg.slice("--delay-ms=".length), 10);
      if (Number.isFinite(n) && n >= 0) developersDelayMs = n;
    } else if (arg.startsWith("--cron=")) {
      scheduleExpr = arg.slice("--cron=".length).trim() || scheduleExpr;
    } else if (arg.startsWith("--timezone=")) {
      timezone = arg.slice("--timezone=".length).trim() || timezone;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { targets, dryRun, developersDelayMs, scheduleExpr, timezone };
}

function printHelp(): void {
  console.log(`Usage:
  npm run cron:scrape [-- --targets=auto|developers|projects|all] [--dry-run]
  npm run cron:scrape:schedule [-- --cron="0 3 * * 0"]

Env: SCRAPE_CRON_SCHEDULE, SCRAPE_TARGETS, SCRAPE_DRY_RUN,
     SCRAPE_DEVELOPERS_DELAY_MS, SCRAPE_TIMEZONE`);
}

function projectsScriptAvailable(): boolean {
  return existsSync(PROJECTS_SCRIPT);
}

function resolveTargets(requested: ScrapeTarget[] | "auto"): ScrapeTarget[] {
  const hasProjects = projectsScriptAvailable();
  if (requested === "auto") {
    return hasProjects ? ["developers", "projects"] : ["developers"];
  }
  const resolved = requested.filter((t) => {
    if (t === "projects" && !hasProjects) {
      console.warn(
        "[scrape-cron] projects target requested but scripts/scrape-projects.ts is missing — skipping (hook ready)",
      );
      return false;
    }
    return true;
  });
  return resolved.length > 0 ? resolved : ["developers"];
}

function runScript(scriptPath: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!existsSync(scriptPath)) {
      reject(new Error(`Scrape script not found: ${scriptPath}`));
      return;
    }
    if (!existsSync(TSX_BIN)) {
      reject(
        new Error(
          `tsx not found at ${TSX_BIN}. Run npm install from the repo root.`,
        ),
      );
      return;
    }

    const child = spawn(TSX_BIN, [scriptPath, ...args], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(scriptPath)} killed by ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export async function runScrapeJob(
  options?: Partial<CronScrapeOptions>,
): Promise<void> {
  const base = parseCliOptions([]);
  const opts: CronScrapeOptions = { ...base, ...options };
  const targets = resolveTargets(opts.targets);

  console.info(
    `[scrape-cron] starting targets=${targets.join(",")} dryRun=${opts.dryRun} @ ${new Date().toISOString()}`,
  );

  if (!projectsScriptAvailable()) {
    console.info(
      "[scrape-cron] scripts/scrape-projects.ts not present — projects scrape hooked for when it lands",
    );
  }

  let failures = 0;

  for (const target of targets) {
    if (target === "developers") {
      const args = [`--delay-ms=${opts.developersDelayMs}`];
      if (opts.dryRun) args.push("--dry-run");
      console.info(`[scrape-cron] → developers ${args.join(" ")}`);
      const code = await runScript(DEVELOPERS_SCRIPT, args);
      if (code !== 0) {
        failures += 1;
        console.error(`[scrape-cron] developers exited ${code}`);
      }
    } else if (target === "projects") {
      const args: string[] = [];
      if (opts.dryRun) args.push("--dry-run");
      console.info(`[scrape-cron] → projects ${args.join(" ") || "(live)"}`);
      const code = await runScript(PROJECTS_SCRIPT, args);
      if (code !== 0) {
        failures += 1;
        console.error(`[scrape-cron] projects exited ${code}`);
      }
    }
  }

  if (failures > 0) {
    throw new Error(`[scrape-cron] ${failures} target(s) failed`);
  }

  console.info(`[scrape-cron] completed @ ${new Date().toISOString()}`);
}

const shouldDaemonize = process.argv.includes("--schedule");
const isDirectRun = process.argv[1]?.includes("scrape");

if (shouldDaemonize) {
  const opts = parseCliOptions(process.argv.slice(2));
  if (!cron.validate(opts.scheduleExpr)) {
    console.error(
      `[scrape-cron] invalid SCRAPE_CRON_SCHEDULE / --cron: ${opts.scheduleExpr}`,
    );
    process.exit(1);
  }

  cron.schedule(
    opts.scheduleExpr,
    () => {
      void runScrapeJob(opts).catch((error) => {
        console.error("[scrape-cron] scheduled run failed", error);
      });
    },
    { timezone: opts.timezone },
  );

  console.info(
    `[scrape-cron] scheduled "${opts.scheduleExpr}" (${opts.timezone}); ` +
      `targets=${opts.targets === "auto" ? "auto" : opts.targets.join("+")}; ` +
      `dryRun=${opts.dryRun}`,
  );
} else if (isDirectRun) {
  const opts = parseCliOptions(process.argv.slice(2));
  void runScrapeJob(opts)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
