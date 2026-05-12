import { loadData } from "@/lib/storage";

const HM_PLACES = [
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
  "afferde",
  "afferede",
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

function isHmClubName(value: string | null | undefined) {
  const text = normalize(value);

  return HM_PLACES.some((place) => {
    return text.includes(normalize(place));
  });
}

function isHmFixture(homeTeam: string, awayTeam: string) {
  return isHmClubName(homeTeam) || isHmClubName(awayTeam);
}

function isHmDuel(homeTeam: string, awayTeam: string) {
  return isHmClubName(homeTeam) && isHmClubName(awayTeam);
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

export default async function RadarPage() {
  const data = await loadData();

  const seen = new Set<string>();
  const fixtures: any[] = [];

  for (const team of data.teams || []) {
    for (const fixture of team.fixtures || []) {
      if (!isHmFixture(fixture.homeTeam, fixture.awayTeam)) continue;

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

      fixtures.push({
        ...fixture,
        dateObj,
        daysUntil: daysUntil(dateObj),
        isHmDuel: isHmDuel(fixture.homeTeam, fixture.awayTeam),
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
  const hmDuels = upcoming.filter((fixture) => fixture.isHmDuel);
  const completedHmFixtures = fixtures.filter((fixture) => fixture.status === "completed");

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">Spieltagsradar</div>
          <h1 className="title">Die nächsten Begegnungen für HM Clubs</h1>
          <p className="subtitle">
            Überblick über anstehende Begegnungen mit Beteiligung von Vereinen aus dem Landkreis Hameln Pyrmont.
            Die Liga wird mit Gruppennummer in Klammern angezeigt.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 260 }}>
          <div className="metricLabel">Letzter Datenabruf</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {new Date(data.generatedAt).toLocaleString("de-DE")}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="/" style={{ fontWeight: 900 }}>Zurück zur App</a>
            <a href="/duelle" style={{ fontWeight: 900 }}>HM Duelle</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card">
          <div className="metricLabel">HM Begegnungen</div>
          <div className="metricValue">{fixtures.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Anstehende</div>
          <div className="metricValue">{upcoming.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Nächste 7 Tage</div>
          <div className="metricValue">{nextSevenDays.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">HM Duelle</div>
          <div className="metricValue">{hmDuels.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Beendet</div>
          <div className="metricValue">{completedHmFixtures.length}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Anstehende Begegnungen für HM Clubs</h2>

        {upcoming.length === 0 ? (
          <p className="subtitle">Aktuell wurden keine anstehenden Begegnungen für HM Clubs gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {upcoming.slice(0, 50).map((fixture) => (
              <article className="fixture" key={`hm-${uniqueFixtureKey(fixture)}`}>
                <div>
                  <strong>{formatDate(fixture.dateObj)}</strong>
                  <br />
                  <span style={{ color: "#66746c" }}>{fixture.time || "Zeit offen"}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{fixture.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {fixture.awayTeam}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">{fixture.isHmDuel ? "HM Duell" : "HM Club beteiligt"}</span>
                    <span className="badge">{fixture.ageClass}</span>
                    <span className="badge">{leagueWithGroup(fixture.league, fixture.group)}</span>
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
        )}
      </section>
    </main>
  );
}
