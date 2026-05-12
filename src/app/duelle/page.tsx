import { loadData } from "@/lib/storage";

const REGION_PLACES = [
  "emmerthal",
  "hameln",
  "aerzen",
  "bad pyrmont",
  "hessisch oldendorf",
  "fischbeck",
  "fuhlen",
  "grohnde",
  "tündern",
  "tuendern",
  "klein berkel",
  "afferede",
  "afferde",
  "halvestorf",
  "hastenbeck",
  "salzhemmendorf",
  "coppenbrügge",
  "coppenbruegge",
  "bisperode",
  "lauenstein",
  "bodenwerder",
  "hohenbostel"
];

const EMMERTHAL_AGE_CLASSES = ["herren 30", "herren 50"];

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

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

function daysUntil(date: Date | null) {
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function safeScore(value: string | null | undefined) {
  if (!value) return "Noch kein Ergebnis";

  const trimmed = String(value).trim();
  const isTime = /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(trimmed);
  const isScore = /^[0-9]:[0-9]$/.test(trimmed);

  if (isTime || !isScore) return "Noch kein Ergebnis";

  return trimmed;
}

function regionHits(text: string) {
  const normalizedText = normalize(text);

  return REGION_PLACES.filter((place) => {
    return normalizedText.includes(normalize(place));
  });
}

function isHamelnPyrmontDuel(homeTeam: string, awayTeam: string) {
  return regionHits(homeTeam).length > 0 && regionHits(awayTeam).length > 0;
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

function isEmmerthalTeam(team: any) {
  return normalize(team.club).includes("emmerthal") && EMMERTHAL_AGE_CLASSES.includes(normalize(team.ageClass));
}

function isOwnEmmerthalFixture(fixture: any) {
  const text = normalize(`${fixture.homeTeam} ${fixture.awayTeam}`);
  return text.includes("emmerthal");
}

function standingOfTeam(standings: any[], teamName: string) {
  const normalizedTeam = normalize(teamName);

  return standings.find((row) => {
    const normalizedStandingTeam = normalize(row.team);
    return normalizedStandingTeam === normalizedTeam || normalizedStandingTeam.includes(normalizedTeam) || normalizedTeam.includes(normalizedStandingTeam);
  });
}

function closestCompetitors(team: any) {
  const ownStanding = standingOfTeam(team.standings || [], team.club);
  if (!ownStanding || !ownStanding.rank) return [];

  return (team.standings || [])
    .filter((row: any) => normalize(row.team) !== normalize(team.club))
    .map((row: any) => ({
      ...row,
      rankDistance: Math.abs(Number(row.rank) - Number(ownStanding.rank))
    }))
    .filter((row: any) => Number.isFinite(row.rankDistance))
    .sort((a: any, b: any) => a.rankDistance - b.rankDistance || Number(a.rank) - Number(b.rank))
    .slice(0, 2);
}

function fixtureContainsTeam(fixture: any, teamName: string) {
  const text = normalize(`${fixture.homeTeam} ${fixture.awayTeam}`);
  return text.includes(normalize(teamName));
}

function relevanceText(item: any) {
  if (item.kind === "own") {
    return `Eigenes anstehendes Spiel der TSG Emmerthal ${item.emmerthalAgeClass}.`;
  }

  return `Beobachtungsspiel, weil ein direkter Tabellennachbar der TSG Emmerthal ${item.emmerthalAgeClass} beteiligt ist.`;
}

function sortByDate(a: any, b: any) {
  const left = a.dateObj ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.dateObj ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;

  return left - right;
}

export default async function DuellePage() {
  const data = await loadData();

  const seen = new Set<string>();
  const duels: any[] = [];

  for (const team of data.teams || []) {
    for (const fixture of team.fixtures || []) {
      if (!isHamelnPyrmontDuel(fixture.homeTeam, fixture.awayTeam)) continue;

      const key = uniqueFixtureKey({
        groupId: team.groupId,
        date: fixture.date,
        time: fixture.time,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam
      });

      if (seen.has(key)) continue;
      seen.add(key);

      const dateObj = parseGermanDate(fixture.date);

      duels.push({
        ...fixture,
        dateObj,
        daysUntil: daysUntil(dateObj),
        ageClass: team.ageClass,
        league: team.league,
        group: team.group,
        groupId: team.groupId,
        groupUrl: team.groupUrl,
        standings: team.standings || []
      });
    }
  }

  const upcoming = duels
    .filter((item) => item.status !== "completed")
    .filter((item) => item.daysUntil === null || item.daysUntil >= 0)
    .sort(sortByDate);

  const completed = duels
    .filter((item) => item.status === "completed")
    .sort((a, b) => {
      const left = a.dateObj ? a.dateObj.getTime() : 0;
      const right = b.dateObj ? b.dateObj.getTime() : 0;
      return right - left;
    });

  const emmerthalTeams = (data.teams || []).filter(isEmmerthalTeam);
  const importantForEmmerthal: any[] = [];
  const importantSeen = new Set<string>();

  for (const team of emmerthalTeams) {
    const ownUpcoming = (team.fixtures || [])
      .filter((fixture: any) => fixture.status !== "completed")
      .filter((fixture: any) => isOwnEmmerthalFixture(fixture))
      .map((fixture: any) => {
        const dateObj = parseGermanDate(fixture.date);

        return {
          ...fixture,
          dateObj,
          daysUntil: daysUntil(dateObj),
          emmerthalAgeClass: team.ageClass,
          emmerthalLeague: team.league,
          emmerthalGroup: team.group,
          groupId: team.groupId,
          groupUrl: team.groupUrl,
          kind: "own"
        };
      })
      .filter((fixture: any) => fixture.daysUntil === null || fixture.daysUntil >= 0)
      .sort(sortByDate);

    for (const fixture of ownUpcoming) {
      const key = `own-${team.id}-${uniqueFixtureKey(fixture)}`;
      if (importantSeen.has(key)) continue;
      importantSeen.add(key);
      importantForEmmerthal.push(fixture);
    }

    const competitors = closestCompetitors(team);
    const competitorFixtures: any[] = [];

    for (const competitor of competitors) {
      const nextFixture = (team.fixtures || [])
        .filter((fixture: any) => fixture.status !== "completed")
        .filter((fixture: any) => !isOwnEmmerthalFixture(fixture))
        .filter((fixture: any) => fixtureContainsTeam(fixture, competitor.team))
        .map((fixture: any) => {
          const dateObj = parseGermanDate(fixture.date);

          return {
            ...fixture,
            dateObj,
            daysUntil: daysUntil(dateObj),
            emmerthalAgeClass: team.ageClass,
            emmerthalLeague: team.league,
            emmerthalGroup: team.group,
            groupId: team.groupId,
            groupUrl: team.groupUrl,
            kind: "competitor",
            competitor: competitor.team
          };
        })
        .filter((fixture: any) => fixture.daysUntil === null || fixture.daysUntil >= 0)
        .sort(sortByDate)[0];

      if (nextFixture) competitorFixtures.push(nextFixture);
    }

    for (const fixture of competitorFixtures.slice(0, 2)) {
      const key = `competitor-${team.id}-${uniqueFixtureKey(fixture)}`;
      if (importantSeen.has(key)) continue;
      importantSeen.add(key);
      importantForEmmerthal.push(fixture);
    }
  }

  importantForEmmerthal.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "own" ? -1 : 1;
    return sortByDate(a, b);
  });

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">Hameln Pyrmont Duelle</div>
          <h1 className="title">Lokale Tennisduelle im TNB Herrenbereich</h1>
          <p className="subtitle">
            Fokus auf Begegnungen, bei denen beide Mannschaften einen klaren Bezug zur Region Hameln Pyrmont haben.
            Dazu zählen unter anderem Hameln, Emmerthal, Aerzen, Bad Pyrmont, Hessisch Oldendorf, Fischbeck,
            Fuhlen, Grohnde, Tündern, Klein Berkel, Salzhemmendorf und Coppenbrügge.
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
          <div className="metricLabel">Hameln Pyrmont Duelle</div>
          <div className="metricValue">{duels.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Anstehende</div>
          <div className="metricValue">{upcoming.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Beendet</div>
          <div className="metricValue">{completed.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Wichtig für Emmerthal</div>
          <div className="metricValue">{importantForEmmerthal.length}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Wichtige Spiele für TSG Emmerthal</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Zuerst werden alle anstehenden eigenen Spiele der Herren 30 und Herren 50 angezeigt.
          Danach folgen wenige Beobachtungsspiele direkter Tabellennachbarn.
        </p>

        {importantForEmmerthal.length === 0 ? (
          <p className="subtitle">Aktuell wurden keine relevanten Spiele gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {importantForEmmerthal.slice(0, 10).map((item) => (
              <article className="fixture" key={`emmerthal-${item.kind}-${uniqueFixtureKey(item)}`}>
                <div>
                  <strong>{formatDate(item.dateObj)}</strong>
                  <br />
                  <span style={{ color: "#66746c" }}>{item.time || "Zeit offen"}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{item.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {item.awayTeam}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">{item.kind === "own" ? "Eigenes Emmerthal Spiel" : "Beobachtungsspiel"}</span>
                    <span className="badge">{item.emmerthalAgeClass}</span>
                    <span className="badge">{item.emmerthalGroup}</span>
                  </div>
                  <div style={{ marginTop: 8, color: "#66746c", fontSize: 14 }}>
                    {relevanceText(item)}
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

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Anstehende Hameln Pyrmont Duelle</h2>

        {upcoming.length === 0 ? (
          <p className="subtitle">Aktuell wurden keine anstehenden Hameln Pyrmont Duelle gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {upcoming.slice(0, 40).map((item) => (
              <article className="fixture" key={`upcoming-${uniqueFixtureKey(item)}`}>
                <div>
                  <strong>{formatDate(item.dateObj)}</strong>
                  <br />
                  <span style={{ color: "#66746c" }}>{item.time || "Zeit offen"}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{item.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {item.awayTeam}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">Hameln Pyrmont Duell</span>
                    <span className="badge">{item.ageClass}</span>
                    <span className="badge">{item.group}</span>
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

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Beendete Hameln Pyrmont Duelle</h2>

        {completed.length === 0 ? (
          <p className="subtitle">Noch keine beendeten Hameln Pyrmont Duelle gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {completed.slice(0, 30).map((item) => (
              <article className="fixture" key={`completed-${uniqueFixtureKey(item)}`}>
                <div>
                  <strong>{formatDate(item.dateObj)}</strong>
                  <br />
                  <span style={{ color: "#66746c" }}>{item.time || "Zeit offen"}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{item.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {item.awayTeam}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">Hameln Pyrmont Duell</span>
                    <span className="badge">{item.ageClass}</span>
                    <span className="badge">{item.group}</span>
                  </div>
                </div>

                <div style={{ textAlign: "right", fontWeight: 900 }}>
                  {safeScore(item.matchPoints)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

