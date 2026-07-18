import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/*/login",
          "/*/signup",
          "/*/register",
          "/*/profile",
          "/*/dashboard",
          "/*/admin/",
          "/*/listings/new",
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
