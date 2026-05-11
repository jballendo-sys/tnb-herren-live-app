import { loadData } from "@/lib/storage";

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

function localLabel(homeTeam: string, awayTeam: string) {
  const text = `${homeTeam} ${awayTeam}`.toLowerCase();

  const localPlaces = [
    "emmerthal",
    "hameln",
    "aerzen",
    "bad pyrmont",
    "hessisch oldendorf",
    "coppenbrügge",
    "coppenbruegge",
    "rinteln",
    "springe"
  ];

  const hits = localPlaces.filter((place) => text.includes(place));

  if (hits.length >= 2) return "Lokales Duell";
  if (hits.length === 1) return "Regionaler Fokus";
  return null;
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

export default async function RadarPage() {
  const data = await loadData();

  const seen = new Set<string>();
  const fixtures: any[] = [];

  for (const team of data.teams || []) {
    for (const fixture of team.fixtures || []) {
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
      const distance = daysUntil(dateObj);
      const local = localLabel(fixture.homeTeam, fixture.awayTeam);

      fixtures.push({
        ...fixture,
        dateObj,
        daysUntil: distance,
        localLabel: local,
        ageClass: team.ageClass,
        league: team.league,
        group: team.group,
        groupId: team.groupId,
        groupUrl: team.groupUrl
      });
    }
  }

  const upcoming = fixtures
    .filter((fixture) => fixture.status !== "completed")
    .filter((fixture) => fixture.daysUntil === null || fixture.daysUntil >= 0)
    .sort((a, b) => {
      const left = a.dateObj ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dateObj ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    });

  const nextSevenDays = upcoming.filter((fixture) => fixture.daysUntil !== null && fixture.daysUntil <= 7);
  const localMatches = upcoming.filter((fixture) => fixture.localLabel).slice(0, 12);
  const liveMatches = fixtures.filter((fixture) => fixture.status === "live");

  const displayFixtures = upcoming.slice(0, 30);

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">Spieltagsradar</div>
          <h1 className="title">Nächste Spiele im TNB Herrenbereich</h1>
          <p className="subtitle">
            Überblick über kommende Begegnungen, lokale Duelle und Spiele mit regionalem Fokus.
            Ergebnisse werden nur angezeigt, wenn sie als echtes Mannschaftsergebnis plausibel sind.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 260 }}>
          <div className="metricLabel">Letzter Datenabruf</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {new Date(data.generatedAt).toLocaleString("de-DE")}
          </div>
          <div style={{ marginTop: 14 }}>
            <a href="/" style={{ fontWeight: 900 }}>Zurück zur App</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card">
          <div className="metricLabel">Kommende Spiele</div>
          <div className="metricValue">{upcoming.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Nächste 7 Tage</div>
          <div className="metricValue">{nextSevenDays.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Lokale Duelle</div>
          <div className="metricValue">{localMatches.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Live</div>
          <div className="metricValue">{liveMatches.length}</div>
        </div>
      </section>

      {localMatches.length > 0 && (
        <section className="card" style={{ padding: 28, marginTop: 24 }}>
          <h2 style={{ marginTop: 0 }}>Lokale Duelle und regionaler Fokus</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {localMatches.map((fixture) => (
              <article className="fixture" key={`local-${uniqueFixtureKey(fixture)}`}>
                <div>
                  <strong>{formatDate(fixture.dateObj)}</strong>
                  <br />
                  <span style={{ color: "#66746c" }}>{fixture.time || "Zeit offen"}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 900 }}>{fixture.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {fixture.awayTeam}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">{fixture.localLabel}</span>
                    <span className="badge">{fixture.ageClass}</span>
                    <span className="badge">{fixture.group}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 900 }}>
                  {safeScore(fixture.matchPoints)}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Nächste Begegnungen</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {displayFixtures.map((fixture) => (
            <article className="fixture" key={`all-${uniqueFixtureKey(fixture)}`}>
              <div>
                <strong>{formatDate(fixture.dateObj)}</strong>
                <br />
                <span style={{ color: "#66746c" }}>{fixture.time || "Zeit offen"}</span>
              </div>
              <div>
                <div style={{ fontWeight: 900 }}>{fixture.homeTeam}</div>
                <div style={{ color: "#66746c" }}>gegen {fixture.awayTeam}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge">{fixture.ageClass}</span>
                  <span className="badge">{fixture.league}</span>
                  <span className="badge">{fixture.group}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900 }}>{safeScore(fixture.matchPoints)}</div>
                {fixture.groupUrl && (
                  <a href={fixture.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                    nuLiga öffnen
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
