import { SOURCE_PAGES, TNB_ACTIVE_MEN_URL, TNB_SENIOR_MEN_URL } from "@/lib/tnbSources";
import { cityGuessFromClub, parseGroupPage } from "@/lib/parse";
import type { AppData, Fixture, GroupLink, TeamEntry } from "@/types/tnb";

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixturesForClub(fixtures: Fixture[], club: string) {
  const normalizedClub = normalizeName(club);

  return fixtures.filter((fixture) => {
    const home = normalizeName(fixture.homeTeam);
    const away = normalizeName(fixture.awayTeam);

    return home === normalizedClub || away === normalizedClub;
  });
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 TNB Herren Live App",
      accept: "text/html,application/xhtml+xml"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} beim Abruf von ${url}`);
  }

  return response.text();
}

async function discoverGroups() {
  const ranges = [
    { from: 207, to: 305, ageClass: "Herren", section: "Damen/Herren" as const, sourceUrl: TNB_ACTIVE_MEN_URL },
    { from: 306, to: 391, ageClass: "Herren 30", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL },
    { from: 392, to: 479, ageClass: "Herren 40", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL },
    { from: 480, to: 550, ageClass: "Herren 50", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL },
    { from: 551, to: 567, ageClass: "Herren 55", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL },
    { from: 568, to: 594, ageClass: "Herren 60", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL },
    { from: 595, to: 611, ageClass: "Herren 65", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL },
    { from: 612, to: 625, ageClass: "Herren 70", section: "Altersklassen" as const, sourceUrl: TNB_SENIOR_MEN_URL }
  ];

  const links: GroupLink[] = [];

  for (const range of ranges) {
    for (let group = range.from; group <= range.to; group++) {
      links.push({
        groupId: String(group),
        ageClass: range.ageClass,
        leagueSection: range.section,
        sourceUrl: range.sourceUrl,
        groupUrl: `https://tnb.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/groupPage?championship=TNB+Sommer+2026&group=${group}&targetFed=TNB`
      });
    }
  }

  return links;
}

function teamId(groupId: string, club: string) {
  return `${groupId}-${club.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-")}`;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function scrapeTnbMen(options: { limit?: number; concurrency?: number } = {}): Promise<AppData> {
  const warnings: string[] = [];
  const groups = await discoverGroups();
  const selectedGroups = typeof options.limit === "number" ? groups.slice(0, options.limit) : groups;

  const groupResults = await mapWithConcurrency(selectedGroups, options.concurrency ?? 5, async (link) => {
    try {
      const html = await fetchHtml(link.groupUrl);
      return { link, parsed: parseGroupPage(html, link.groupUrl, link.ageClass), error: null as string | null };
    } catch (error) {
      return { link, parsed: null, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
    }
  });

  const teams: TeamEntry[] = [];

  for (const result of groupResults) {
    if (result.error || !result.parsed) {
      warnings.push(`${result.link.ageClass} Gruppe ${result.link.groupId}: ${result.error}`);
      continue;
    }

    const parsed = result.parsed;

    for (const row of parsed.standings) {
      const ownFixtures = fixturesForClub(parsed.fixtures, row.team);

      teams.push({
        id: teamId(result.link.groupId, row.team),
        club: row.team,
        cityGuess: cityGuessFromClub(row.team),
        gender: "Herren",
        ageClass: parsed.ageClass || result.link.ageClass,
        league: parsed.league || result.link.ageClass,
        group: parsed.group || `Gruppe ${result.link.groupId}`,
        groupId: result.link.groupId,
        groupUrl: result.link.groupUrl,
        fetchedAt: new Date().toISOString(),
        standings: parsed.standings,
        fixtures: parsed.fixtures,
        warnings: parsed.warnings
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    championship: "TNB Sommer 2026",
    sourcePages: SOURCE_PAGES,
    groupCount: selectedGroups.length,
    teamCount: teams.length,
    teams,
    warnings
  };
}



