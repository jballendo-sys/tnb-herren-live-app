import * as cheerio from "cheerio";
import type { Fixture, FixtureStatus, GroupLink, StandingRow } from "@/types/tnb";
import { normalizeGroupUrl } from "@/lib/tnbSources";

function clean(value: string | undefined | null) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asNumber(value: string | undefined) {
  const n = Number(clean(value));
  return Number.isFinite(n) ? n : null;
}

function groupIdFromHref(href: string) {
  try {
    const url = new URL(href, "https://tnb.liga.nu");
    return url.searchParams.get("group");
  } catch {
    const match = href.match(/[?&]group=(\d+)/);
    return match ? match[1] : null;
  }
}

function isMenAgeClass(label: string) {
  return /^Herren(?:\s(?:30|40|50|55|60|65|70|75|80))?$/.test(label);
}

export function parseLeaguePage(html: string, sourceUrl: string, section: "Damen/Herren" | "Altersklassen") {
  const $ = cheerio.load(html);
  const links: GroupLink[] = [];
  let currentAgeClass = "";

  $("body").find("a").each((_, element) => {
    const label = clean($(element).text());
    const href = $(element).attr("href") || "";

    if (isMenAgeClass(label)) {
      currentAgeClass = label;
      return;
    }

    const groupId = groupIdFromHref(href);
    const isGroup = /^Gr\.\s*\d+/.test(label) && groupId;

    if (isGroup && currentAgeClass && isMenAgeClass(currentAgeClass)) {
      links.push({
        groupId,
        ageClass: currentAgeClass,
        leagueSection: section,
        sourceUrl,
        groupUrl: normalizeGroupUrl(href)
      });
    }
  });

  return links;
}

function detectStatus(cells: string[]): FixtureStatus {
  const text = cells.join(" ").toLowerCase();
  if (text.includes("offen")) return "open";
  if (text.includes("live")) return "live";
  if (cells.some((cell) => /^\d+:\d+$/.test(cell))) return "completed";
  return "unknown";
}

function parseDateTime(value: string) {
  const normalized = clean(value);
  const dateMatch = normalized.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
  const timeMatch = normalized.match(/(\d{1,2}:\d{2})/);

  return {
    date: dateMatch ? dateMatch[1] : null,
    time: timeMatch ? timeMatch[1] : null
  };
}

function extractTitleParts(text: string, groupUrl: string, ageClassFallback: string) {
  const groupId = new URL(groupUrl).searchParams.get("group") || "";
  const compact = clean(text);

  const match = compact.match(/TNB Sommer 2026\s+(Herren(?:\s(?:30|40|50|55|60|65|70|75|80))?)\s+(.+?)\s+Gr\.\s*(\d+)/);

  if (!match) {
    return {
      ageClass: ageClassFallback,
      league: ageClassFallback,
      group: groupId ? `Gruppe ${groupId}` : "Gruppe"
    };
  }

  return {
    ageClass: match[1],
    league: `${match[2]} ${match[1]}`.trim(),
    group: `Gruppe ${match[3]}`
  };
}

function parseStandings($: cheerio.CheerioAPI) {
  const standings: StandingRow[] = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("th,td")
      .map((__, cell) => clean($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length >= 10 && /^\d+$/.test(cells[0])) {
      standings.push({
        rank: asNumber(cells[0]),
        team: cells[1],
        played: asNumber(cells[2]),
        wins: asNumber(cells[3]),
        draws: asNumber(cells[4]),
        losses: asNumber(cells[5]),
        tablePoints: cells[6] || null,
        matchPoints: cells[7] || null,
        sets: cells[8] || null,
        games: cells[9] || null
      });
    }
  });

  return standings;
}

function teamNamesFromStandings(standings: StandingRow[]) {
  return standings
    .map((row) => row.team)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function extractFixtureFromText(text: string, teams: string[], lastDateTime: { date: string | null; time: string | null }) {
  let remaining = clean(text)
    .replace(/^((Mo|Di|Mi|Do|Fr|Sa|So)\.\s*)?/i, "")
    .replace(/\banzeigen\b/gi, "")
    .trim();

  const parsedDate = parseDateTime(remaining);
  const date = parsedDate.date || lastDateTime.date;
  const time = parsedDate.time || lastDateTime.time;

  remaining = remaining
    .replace(/^\d{1,2}\.\d{1,2}\.\d{4}/, "")
    .replace(/^\d{1,2}:\d{2}/, "")
    .replace(/\s+/g, " ")
    .trim();

  const foundTeams = teams
    .map((team) => ({ team, index: remaining.indexOf(team) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.team);

  if (foundTeams.length < 2) return null;

    const scoreCells = Array.from(remaining.matchAll(/\d+:\d+/g), (match) => match[0]).filter((value: string) => {
    const [left, right] = value.split(":").map(Number);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (right === 0 && left > 9) return false;
    if (left > 9 || right > 9) return false;
    return true;
  });
  const status = remaining.toLowerCase().includes("offen")
    ? "open"
    : scoreCells.length > 0
      ? "completed"
      : "unknown";

  return {
    fixture: {
      date,
      time,
      homeTeam: foundTeams[0],
      awayTeam: foundTeams[1],
      matchPoints: scoreCells[0] || null,
      sets: scoreCells[1] || null,
      games: scoreCells[2] || null,
      status,
      reportUrl: null
    } as Fixture,
    dateTime: { date, time }
  };
}

function parseFixtures($: cheerio.CheerioAPI, standings: StandingRow[]) {
  const fixtures: Fixture[] = [];
  const teams = teamNamesFromStandings(standings);
  let lastDateTime = { date: null as string | null, time: null as string | null };

  $("tr").each((_, row) => {
    const rowText = clean($(row).text());
    if (!rowText) return;

    const looksLikeFixture =
      /(\d{1,2}\.\d{1,2}\.\d{4}|\boffen\b|\banzeigen\b|\d+:\d+)/i.test(rowText) &&
      teams.some((team) => rowText.includes(team));

    if (!looksLikeFixture) return;

    const extracted = extractFixtureFromText(rowText, teams, lastDateTime);
    if (!extracted) return;

    lastDateTime = extracted.dateTime;

    const reportHref = $(row)
      .find("a")
      .map((__, a) => $(a).attr("href") || "")
      .get()
      .find((href) => href.includes("meetingReport") || href.includes("spielbericht"));

    fixtures.push({
      ...extracted.fixture,
      reportUrl: reportHref ? new URL(reportHref, "https://tnb.liga.nu").toString() : null
    });
  });

  return fixtures;
}

export function parseGroupPage(html: string, groupUrl: string, ageClassFallback: string) {
  const $ = cheerio.load(html);
  const groupId = new URL(groupUrl).searchParams.get("group") || "";
  const titleParts = extractTitleParts(clean($("body").text()).slice(0, 1000), groupUrl, ageClassFallback);

  const standings = parseStandings($);
  const fixtures = parseFixtures($, standings);
  const warnings: string[] = [];

  if (!standings.length) warnings.push("Keine Tabelle erkannt");
  if (!fixtures.length) warnings.push("Keine Begegnungen erkannt");

  return {
    ageClass: titleParts.ageClass,
    league: titleParts.league,
    group: titleParts.group,
    groupId,
    standings,
    fixtures,
    warnings
  };
}

export function cityGuessFromClub(club: string) {
  let value = clean(club)
    .replace(/\b(e\.V\.|eV|v\.\s*1906|von\s+\d{4})\b/gi, "")
    .replace(/\b(TC|Tennisclub|Tennis Club|TV|TSV|TUS|TuS|VfL|SV|SC|MTV|DTV|HTC|TSC|Tennisverein|TG|SG|ETV|ESV|THC|BTK)\b/gi, "")
    .replace(/\b(I|II|III|IV|V)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  value = value.replace(/^(Blau Weiss|Blau-Weiss|Grün Weiß|Grün-Weiß|Rot Weiß|Rot-Weiß|Schwarz Weiß|Schwarz-Weiß)\s+/i, "");
  return value || club;
}



