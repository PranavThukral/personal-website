import type { MetadataRoute } from "next";
import { site } from "./content";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url, changeFrequency: "monthly", priority: 1 }];
}
