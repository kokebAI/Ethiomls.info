import packageJson from "@/package.json";

export type DeployVersionInfo = {
  appVersion: string;
  commitSha: string;
  commitShort: string;
  environment: string;
};

/**
 * App version + deploy identity from package.json and host env
 * (Vercel / Netlify / local).
 */
export function getDeployVersion(): DeployVersionInfo {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.COMMIT_REF?.trim() ||
    process.env.NETLIFY_COMMIT_REF?.trim() ||
    process.env.CF_PAGES_COMMIT_SHA?.trim() ||
    "local";

  const environment =
    process.env.VERCEL_ENV?.trim() ||
    process.env.CONTEXT?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development";

  return {
    appVersion: packageJson.version || "0.0.0",
    commitSha: sha,
    commitShort: sha === "local" ? "local" : sha.slice(0, 7),
    environment,
  };
}
