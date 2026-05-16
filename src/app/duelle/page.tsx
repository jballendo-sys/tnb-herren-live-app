import { MainNav } from "@/components/MainNav";
﻿import { loadData } from "@/lib/storage";

function parseGermanDate(value: string | null | undefined) {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;

  return new Date(year, month - 1, day);
}

function formatDate(date: Date | null) {
  if (!date) return "Termin offen";

  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });
}

function parseGermanFixtureDate(value: string) {
  const [dayRaw, monthRaw, yearRaw] = String(value || "").split(".");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function isFixtureInCurrentMonth(fixtureDate: string, referenceDate: Date) {
  const parsedDate = parseGermanFixtureDate(fixtureDate);

  if (!parsedDate) {
    return false;
  }

  return (
    parsedDate.getMonth() === referenceDate.getMonth() &&
    parsedDate.getFullYear() === referenceDate.getFullYear()
  );
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeScore(value: string | null | undefined) {
  if (!value) return "Noch kein Ergebnis";

  const trimmed = String(value).trim();
  const isTime = /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(trimmed);
  const isScore = /^[0-9]:[0-9]$/.test(trimmed);

  if (isTime || !isScore) return "Noch kein Ergebnis";

  return trimmed;
}

function uniqueFixtureKey(item: any) {
  return [
    item.groupId,
    item.date,
    item.time,
    item.homeTeam,
    item.awayTeam
  ].join("|");
}

function leagueWithGroup(league: string | null | undefined, group: string | null | undefined) {
  const cleanLeague = String(league || "Liga unbekannt").trim();
  const cleanGroup = String(group || "").trim();

  if (!cleanGroup) return cleanLeague;

  return `${cleanLeague} (${cleanGroup})`;
}

function findStanding(standings: any[], teamName: string) {
  const team = normalize(teamName);

  return standings.find((row) => {
    const standingTeam = normalize(row.team);
    return standingTeam === team || standingTeam.includes(team) || team.includes(standingTeam);
  });
}

function rankOf(standings: any[], teamName: string) {
  const standing = findStanding(standings, teamName);
  const rank = Number(standing?.rank);

  return Number.isFinite(rank) ? rank : null;
}

function playedOf(standing: any) {
  const played = Number(standing?.played);
  return Number.isFinite(played) ? played : 0;
}

function lossesOf(standing: any) {
  const losses = Number(standing?.losses);
  return Number.isFinite(losses) ? losses : 0;
}

function isUndefeated(standing: any) {
  return standing && playedOf(standing) > 0 && lossesOf(standing) === 0;
}

function maxRank(standings: any[]) {
  const ranks = standings
    .map((row) => Number(row.rank))
    .filter((rank) => Number.isFinite(rank));

  return ranks.length ? Math.max(...ranks) : null;
}

function classifyTopMatch(item: any) {
  const homeStanding = findStanding(item.standings || [], item.homeTeam);
  const awayStanding = findStanding(item.standings || [], item.awayTeam);

  const homeRank = rankOf(item.standings || [], item.homeTeam);
  const awayRank = rankOf(item.standings || [], item.awayTeam);
  const lastRank = maxRank(item.standings || []);

  const bothUndefeated = isUndefeated(homeStanding) && isUndefeated(awayStanding);
  const oneVsTwo =
    homeRank !== null &&
    awayRank !== null &&
    ((homeRank === 1 && awayRank === 2) || (homeRank === 2 && awayRank === 1));

  const lastVsPenultimate =
    lastRank !== null &&
    homeRank !== null &&
    awayRank !== null &&
    ((homeRank === lastRank && awayRank === lastRank - 1) ||
      (awayRank === lastRank && homeRank === lastRank - 1));

  if (bothUndefeated) {
    return {
      priority: 2, label: "Ungeschlagen gegen ungeschlagen",
      reason: "Beide Mannschaften sind in dieser Gruppe noch ungeschlagen."
    };
  }

  if (oneVsTwo) {
    return {
      priority: 1, label: "Rang 1 gegen Rang 2",
      reason: "Spitzenspiel Rang 1 gegen Rang 2 zwischen den beiden bestplatzierten Mannschaften."
    };
  }

  if (lastVsPenultimate) {
    return {
      priority: 3,
      label: "Letzter gegen Vorletzter",
      reason: "Direktes Duell im unteren Tabellenbereich."
    };
  }

  return null;
}

function sortTopMatches(a: any, b: any) {
  if (a.classification.priority !== b.classification.priority) {
    return a.classification.priority - b.classification.priority;
  }

  const left = a.dateObj ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.dateObj ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;

  return left - right;
}


function parseDuelleRecord(value: string | null | undefined) {
  const [wonRaw, lostRaw] = String(value || "0:0").split(":").map(Number);
  const won = Number.isFinite(wonRaw) ? wonRaw : 0;
  const lost = Number.isFinite(lostRaw) ? lostRaw : 0;

  return {
    won,
    lost,
    total: won + lost
  };
}

function normalizeDuelleName(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findStandingForTeam(item: any, teamName: string) {
  return (item.standings || []).find((row: any) => normalizeDuelleName(row.team) === normalizeDuelleName(teamName));
}

function undefeatedSetLosses(item: any) {
  const homeStanding = findStandingForTeam(item, item.homeTeam);
  const awayStanding = findStandingForTeam(item, item.awayTeam);

  const homeSets = parseDuelleRecord(homeStanding?.sets);
  const awaySets = parseDuelleRecord(awayStanding?.sets);

  return homeSets.lost + awaySets.lost;
}

function undefeatedSetWinRate(item: any) {
  const homeStanding = findStandingForTeam(item, item.homeTeam);
  const awayStanding = findStandingForTeam(item, item.awayTeam);

  const homeSets = parseDuelleRecord(homeStanding?.sets);
  const awaySets = parseDuelleRecord(awayStanding?.sets);

  const won = homeSets.won + awaySets.won;
  const total = homeSets.total + awaySets.total;

  return total > 0 ? won / total : 0;
}

function compareTopMatches(a: any, b: any) {
  if (a.classification.priority !== b.classification.priority) {
    return a.classification.priority - b.classification.priority;
  }

  if (a.classification.priority === 2) {
    const aSetLosses = undefeatedSetLosses(a);
    const bSetLosses = undefeatedSetLosses(b);

    if (aSetLosses !== bSetLosses) {
      return aSetLosses - bSetLosses;
    }

    const aSetWinRate = undefeatedSetWinRate(a);
    const bSetWinRate = undefeatedSetWinRate(b);

    if (aSetWinRate !== bSetWinRate) {
      return bSetWinRate - aSetWinRate;
    }
  }

  const aDate = parseGermanFixtureDate(a.date)?.getTime() ?? 0;
  const bDate = parseGermanFixtureDate(b.date)?.getTime() ?? 0;

  return aDate - bDate;
}

function topMatchReason(item: any) {
  if (item.classification.priority === 2) {
    return `${item.classification.reason} Bei ungeschlagenen Duellen werden Teams mit weniger verlorenen Sätzen höher priorisiert. Gemeinsame Satzverluste bisher: ${undefeatedSetLosses(item)}.`;
  }

  return item.classification.reason;
}



function topMatchUniqueKey(item: any) {
  return [
    item.groupId || item.group,
    item.date,
    item.time || "",
    String(item.homeTeam || "").toLowerCase().replace(/\s+/g, " ").trim(),
    String(item.awayTeam || "").toLowerCase().replace(/\s+/g, " ").trim()
  ].join("|");
}

function uniqueTopMatches(items: any[]) {
  const seen = new Set();

  return items.filter((item) => {
    const key = topMatchUniqueKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}


export default async function DuellePage() {
  const data = await loadData();
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const seen = new Set<string>();
  const candidates: any[] = [];

  for (const team of data.teams || []) {
    for (const fixture of team.fixtures || []) {
      if (fixture.status === "completed") continue;

      const dateObj = parseGermanDate(fixture.date);
      if (!dateObj) continue;

      dateObj.setHours(0, 0, 0, 0);

      if (dateObj < today) continue;
      dateObj.setHours(0, 0, 0, 0);

      if (dateObj < today) continue;
      dateObj.setHours(0, 0, 0, 0);

      if (dateObj < today) continue;
      if (dateObj.getMonth() !== currentMonth || dateObj.getFullYear() !== currentYear) continue;

      const key = uniqueFixtureKey({
        groupId: team.groupId,
        date: fixture.date,
        time: fixture.time,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam
      });

      if (seen.has(key)) continue;
      seen.add(key);

      const item = {
        ...fixture,
        dateObj,
        ageClass: team.ageClass,
        league: team.league,
        group: team.group,
        groupId: team.groupId,
        groupUrl: team.groupUrl,
        standings: team.standings || []
      };

      const classification = classifyTopMatch(item);

      if (!classification) continue;

      candidates.push({
        ...item,
        classification
      });
    }
  }

  const currentMonthCandidates = uniqueTopMatches(
    candidates.filter((item) => isFixtureInCurrentMonth(item.date, today))
  );

  const topMatches = currentMonthCandidates
    .sort(compareTopMatches)
    .slice(0, 10);

  const topTableCount = currentMonthCandidates.filter((item) => item.classification.priority === 1).length;
  const undefeatedCount = currentMonthCandidates.filter((item) => item.classification.priority === 2).length;
  const rankOneVsThreeCount = currentMonthCandidates.filter((item) => item.classification.priority === 3).length;
  const bottomTableCount = currentMonthCandidates.filter((item) => item.classification.priority === 4).length;
  const visibleRankOneVsTwoCount = topMatches.filter((item) => item.classification.priority === 1).length;
  const visibleUndefeatedCount = topMatches.filter((item) => item.classification.priority === 2).length;
  const visibleRankOneVsThreeCount = topMatches.filter((item) => item.classification.priority === 3).length;
  const visibleBottomTableCount = topMatches.filter((item) => item.classification.priority === 4).length;



  return (
    <main className="container">
      <MainNav />
      <section className="header">
        <div>
          <div className="badge">TNB Top 10 Begegnungen</div>
          <h1 className="title">Die wichtigsten Begegnungen im {monthLabel(today)}</h1>
          <p className="subtitle">
            Diese Seite zeigt die zehn wichtigsten anstehenden Begegnungen im TNB Herrenbereich für den aktuellen Monat. Die Kacheln zählen alle eindeutigen Begegnungen des Monats je Kategorie. Die Liste darunter zeigt daraus die zehn höchst priorisierten Begegnungen.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 280 }}>
          <div className="metricLabel">Letzter Datenabruf</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {new Date(data.generatedAt).toLocaleString("de-DE")}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="/" style={{ fontWeight: 900 }}>Zurück zur App</a>
            <a href="/radar" style={{ fontWeight: 900 }}>Spieltagsradar</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card">
          <div className="metricLabel">Rang 1 gegen 2</div>
          <div className="metricValue">{topTableCount}</div>
        </div>

        <div className="card">
          <div className="metricLabel">Ungeschlagene Duelle</div>
          <div className="metricValue">{undefeatedCount}</div>
        </div>

        <div className="card">
          <div className="metricLabel">Kellerduelle</div>
          <div className="metricValue">{bottomTableCount}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Was zählt als Top Begegnung?</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Top Begegnungen sind Spiele mit besonderer Bedeutung für die Tabelle. Am höchsten bewertet werden direkte Spitzenspiele zwischen Rang 1 und Rang 2. Danach folgen Begegnungen zwischen zwei ungeschlagenen Teams sowie Spiele zwischen Rang 1 und Rang 3. Ergänzend werden direkte Kellerduelle zwischen dem letzten und vorletzten Team einer Gruppe berücksichtigt. Betrachtet wird immer der aktuelle Monat.
        </p>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Top Begegnungen im {monthLabel(today)}</h2>

        {topMatches.length === 0 ? (
          <p className="subtitle">
            Für diesen Monat wurden aktuell keine Begegnungen gefunden, die den Top Kriterien entsprechen.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {topMatches.map((item, index) => (
              <article className="fixture" key={`top-${uniqueFixtureKey(item)}`}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22 }}>#{index + 1}</div>
                  <div style={{ marginTop: 8 }}>
                    <strong>{formatDate(item.dateObj)}</strong>
                    <br />
                    <span style={{ color: "#66746c" }}>{item.time || "Zeit offen"}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{item.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {item.awayTeam}</div>
                  <div style={{ marginTop: 8, color: "#66746c", fontSize: 14 }}>
                    {item.ageClass} · {leagueWithGroup(item.league, item.group)}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">Priorität {item.classification.priority}</span>
                    <span className="badge">{item.classification.label}</span>
                  </div>
                  <div style={{ marginTop: 8, color: "#66746c", fontSize: 14 }}>
                    {topMatchReason(item)}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>{safeScore(item.matchPoints)}</div>
                  {item.groupUrl && (
                    <a href={item.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                      nuLiga öffnen
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}





