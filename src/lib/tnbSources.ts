import type { GroupLink } from "@/types/tnb";

export const CHAMPIONSHIP = process.env.TNB_CHAMPIONSHIP || "TNB Sommer 2026";

export const TNB_ACTIVE_MEN_URL =
  "https://tnb.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/leaguePage?championship=TNB+Sommer+2026&tab=2";

export const TNB_SENIOR_MEN_URL =
  "https://tnb.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/leaguePage?championship=TNB+Sommer+2026&tab=3";

export const SOURCE_PAGES = [TNB_ACTIVE_MEN_URL, TNB_SENIOR_MEN_URL];

export function normalizeGroupUrl(href: string) {
  const url = new URL(href, "https://tnb.liga.nu");
  url.searchParams.set("championship", "TNB Sommer 2026");
  url.searchParams.set("targetFed", "TNB");
  return url.toString();
}

export function uniqueGroupLinks(links: GroupLink[]) {
  const seen = new Set<string>();
  const output: GroupLink[] = [];

  for (const link of links) {
    const key = `${link.ageClass}-${link.groupId}`;
    if (!seen.has(key)) {
      seen.add(key);
      output.push(link);
    }
  }

  return output.sort((a, b) => Number(a.groupId) - Number(b.groupId));
}
