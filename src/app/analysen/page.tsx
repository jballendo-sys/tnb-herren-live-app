import { MainNav } from "@/components/MainNav";
import { loadData } from "@/lib/storage";

type SearchParams = {
  age?: string;
};

function splitRecord(value: string | null | undefined) {
  if (!value) return { won: 0, lost: 0, total: 0 };

  const [wonRaw, lostRaw] = String(value).split(":").map(Number);
  const won = Number.isFinite(wonRaw) ? wonRaw : 0;
  const lost = Number.isFinite(lostRaw) ? lostRaw : 0;

  return { won, lost, total: won + lost };
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function ageSortValue(ageClass: string) {
  if (ageClass === "Herren") return 0;
  const value = Number(ageClass.replace(/\D/g, ""));
  return Number.isFinite(value) ? value : 999;
}

function leagueWithGroup(league: string | null | undefined, group: string | null | undefined) {
  const cleanLeague = String(league || "Liga unbekannt").trim();
  const cleanGroup = String(group || "").trim();

  if (!cleanGroup) return cleanLeague;

  return `${cleanLeague} (${cleanGroup})`;
}

function resultOf(fixture: any) {
  return fixture.matchPoints || fixture.score || fixture.result || "";
}

function isCompleted(fixture: any) {
  return normalize(fixture.status) === "completed";
}

function isTeamFixture(fixture: any, teamName: string) {
  const home = normalize(fixture.homeTeam || fixture.home);
  const away = normalize(fixture.awayTeam || fixture.away);
  const name = normalize(teamName);

  return home === name || away === name;
}

function isCloseResult(result: string) {
  const record = splitRecord(result);

  if (record.total === 0) return false;

  return Math.abs(record.won - record.lost) <= 1;
}

function makeTeamRows(data: any) {
  const seen = new Set<string>();
  const rows: any[] = [];

  for (const groupTeam of data.teams || []) {
    for (const standing of groupTeam.standings || []) {
      const key = `${groupTeam.groupId}|${standing.team}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const tablePoints = splitRecord(standing.tablePoints);
      const matchPoints = splitRecord(standing.matchPoints);
      const sets = splitRecord(standing.sets);
      const played = Number(standing.played ?? 0);
      const wins = Number(standing.wins ?? 0);
      const losses = Number(standing.losses ?? 0);
      const rank = Number(standing.rank ?? 999);

      const fixtures = (groupTeam.fixtures || [])
        .filter((fixture: any) => isTeamFixture(fixture, standing.team))
        .filter(isCompleted);

      const closeFixtures = fixtures.filter((fixture: any) => isCloseResult(resultOf(fixture)));
      const recentCloseResults = closeFixtures
        .slice(0, 3)
        .map((fixture: any) => `${fixture.date}: ${fixture.homeTeam || fixture.home} ${resultOf(fixture)} ${fixture.awayTeam || fixture.away}`);

      const matchWinRate = matchPoints.total > 0 ? (matchPoints.won / matchPoints.total) * 100 : 0;
      const matchLossRate = matchPoints.total > 0 ? (matchPoints.lost / matchPoints.total) * 100 : 0;
      const setWinRate = sets.total > 0 ? (sets.won / sets.total) * 100 : 0;

      rows.push({
        team: standing.team,
        ageClass: groupTeam.ageClass,
        league: groupTeam.league,
        group: groupTeam.group,
        groupId: groupTeam.groupId,
        groupUrl: groupTeam.groupUrl,
        rank,
        played,
        wins,
        losses,
        tablePointsRaw: standing.tablePoints || "0:0",
        matchPointsRaw: standing.matchPoints || "0:0",
        setsRaw: standing.sets || "0:0",
        tablePoints,
        matchPoints,
        sets,
        matchWinRate,
        matchLossRate,
        setWinRate,
        closeFixtureCount: closeFixtures.length,
        recentCloseResults
      });
    }
  }

  return rows;
}

function makeGroupRows(data: any) {
  const seen = new Set<string>();
  const groups: any[] = [];

  for (const groupTeam of data.teams || []) {
    if (seen.has(groupTeam.groupId)) continue;
    seen.add(groupTeam.groupId);

    const standings = (groupTeam.standings || [])
      .map((row: any) => ({
        ...row,
        rank: Number(row.rank ?? 999),
        tablePoints: splitRecord(row.tablePoints)
      }))
      .filter((row: any) => Number.isFinite(row.rank) && row.rank > 0)
      .sort((a: any, b: any) => a.rank - b.rank);

    if (standings.length < 3) continue;

    const top1 = standings[0];
    const top2 = standings[1];
    const top3 = standings[2];

    const gapTop1ToTop3 = Math.max(0, top1.tablePoints.won - top3.tablePoints.won);
    const openFixtures = (groupTeam.fixtures || []).filter((fixture: any) => fixture.status === "open").length;
    const completedFixtures = (groupTeam.fixtures || []).filter((fixture: any) => fixture.status === "completed").length;

    groups.push({
      ageClass: groupTeam.ageClass,
      league: groupTeam.league,
      group: groupTeam.group,
      groupId: groupTeam.groupId,
      groupUrl: groupTeam.groupUrl,
      top1,
      top2,
      top3,
      gapTop1ToTop3,
      openFixtures,
      completedFixtures
    });
  }

  return groups;
}

function AgeFilter({ activeAge, ageClasses }: { activeAge: string; ageClasses: string[] }) {
  return (
    <section className="card" style={{ padding: 22, marginTop: 24 }}>
      <div className="metricLabel" style={{ marginBottom: 12 }}>Altersklasse filtern</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          className="badge"
          href="/analysen"
          style={{
            textDecoration: "none",
            background: activeAge === "all" ? "#245638" : undefined,
            color: activeAge === "all" ? "#ffffff" : undefined
          }}
        >
          Alle
        </a>

        {ageClasses.map((age) => (
          <a
            key={age}
            className="badge"
            href={`/analysen?age=${encodeURIComponent(age)}`}
            style={{
              textDecoration: "none",
              background: activeAge === age ? "#245638" : undefined,
              color: activeAge === age ? "#ffffff" : undefined
            }}
          >
            {age}
          </a>
        ))}
      </div>
    </section>
  );
}

function TeamInsightList({
  title,
  subtitle,
  rows,
  valueLabel,
  value,
  detail
}: {
  title: string;
  subtitle: string;
  rows: any[];
  valueLabel: string;
  value: (row: any) => string;
  detail: (row: any) => string;
}) {
  return (
    <section className="card" style={{ padding: 28, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>{subtitle}</p>

      {rows.length === 0 ? (
        <p className="subtitle">Für diese Auswahl wurden keine passenden Mannschaften gefunden.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row, index) => (
            <article
              key={`${title}-${row.groupId}-${row.team}`}
              style={{
                border: "1px solid #dfe9e2",
                borderRadius: 18,
                padding: 18,
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "56px 1fr auto",
                gap: 16,
                alignItems: "center"
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900 }}>#{index + 1}</div>

              <div>
                <div style={{ fontWeight: 900 }}>{row.team}</div>
                <div style={{ color: "#66746c", fontSize: 14, marginTop: 4 }}>
                  {row.ageClass} · {leagueWithGroup(row.league, row.group)}
                </div>
                <div style={{ color: "#66746c", fontSize: 14, marginTop: 6 }}>
                  {detail(row)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <a href={row.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                    nuLiga öffnen
                  </a>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="metricLabel">{valueLabel}</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{value(row)}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupInsightList({ rows }: { rows: any[] }) {
  return (
    <section className="card" style={{ padding: 28, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Enge Tabellenlagen</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Gruppen, in denen Rang 1 bis Rang 3 nah beieinanderliegen. Die Kennzahl zeigt den Abstand in Mannschaftspunkten zwischen Rang 1 und Rang 3. Je kleiner der Abstand, desto enger ist das Rennen an der Spitze.
      </p>

      {rows.length === 0 ? (
        <p className="subtitle">Für diese Auswahl wurden keine engen Tabellenlagen gefunden.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row, index) => (
            <article
              key={`${row.groupId}-${index}`}
              style={{
                border: "1px solid #dfe9e2",
                borderRadius: 18,
                padding: 18,
                background: "#ffffff",
                display: "grid",
                gridTemplateColumns: "56px 1fr auto",
                gap: 16,
                alignItems: "center"
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900 }}>#{index + 1}</div>

              <div>
                <div style={{ fontWeight: 900 }}>{row.ageClass} · {leagueWithGroup(row.league, row.group)}</div>
                <div style={{ color: "#66746c", fontSize: 14, marginTop: 6 }}>
                  Rang 1: {row.top1.team} · Rang 2: {row.top2.team} · Rang 3: {row.top3.team}
                </div>
                <div style={{ color: "#66746c", fontSize: 14, marginTop: 6 }}>
                  Noch {row.openFixtures} enge Begegnungen
                </div>
                <div style={{ marginTop: 6 }}>
                  <a href={row.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                    nuLiga öffnen
                  </a>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="metricLabel">Abstand Rang 1 zu Rang 3</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{row.gapTop1ToTop3}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AnalysenPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const data = await loadData();

  const allTeamRows = makeTeamRows(data);
  const allGroupRows = makeGroupRows(data);

  const ageClasses = Array.from(new Set(allTeamRows.map((row) => row.ageClass)))
    .sort((a, b) => ageSortValue(a) - ageSortValue(b));

  const activeAge = searchParams?.age || "all";

  const filteredTeamRows = activeAge === "all"
    ? allTeamRows
    : allTeamRows.filter((row) => row.ageClass === activeAge);

  const filteredGroupRows = activeAge === "all"
    ? allGroupRows
    : allGroupRows.filter((row) => row.ageClass === activeAge);

  const sovereignTeams = filteredTeamRows
    .filter((row) => row.played > 0)
    .filter((row) => row.matchPoints.total > 0)
    .sort((a, b) => {
      if (b.matchWinRate !== a.matchWinRate) return b.matchWinRate - a.matchWinRate;
      if (b.played !== a.played) return b.played - a.played;
      if (b.setWinRate !== a.setWinRate) return b.setWinRate - a.setWinRate;
      return a.rank - b.rank;
    })
    .slice(0, 10);

  const tightTables = filteredGroupRows
    .filter((row) => row.completedFixtures > 0)
    .sort((a, b) => {
      if (a.gapTop1ToTop3 !== b.gapTop1ToTop3) return a.gapTop1ToTop3 - b.gapTop1ToTop3;
      if (b.openFixtures !== a.openFixtures) return b.openFixtures - a.openFixtures;
      return 0;
    })
    .slice(0, 10);

  const teamsUnderPressure = filteredTeamRows
    .filter((row) => row.played > 0)
    .filter((row) => row.losses > 0 || row.matchLossRate >= 50)
    .sort((a, b) => {
      if (b.losses !== a.losses) return b.losses - a.losses;
      if (b.matchLossRate !== a.matchLossRate) return b.matchLossRate - a.matchLossRate;
      if (b.matchPoints.lost !== a.matchPoints.lost) return b.matchPoints.lost - a.matchPoints.lost;
      return b.rank - a.rank;
    })
    .slice(0, 10);

  return (
    <main className="container">
      <MainNav />

      <section className="header">
        <div>
          <div className="badge">Analyse Center</div>
          <h1 className="title">TNB Analyse Center</h1>
          <p className="subtitle">
            Diese Seite zeigt auffällige Entwicklungen im TNB Herrenbereich: souveräne Teams, enge Tabellenlagen und Teams unter Ergebnisdruck.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 280 }}>
          <div className="metricLabel">Letzter Datenabruf</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {new Date(data.generatedAt).toLocaleString("de-DE")}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="/" style={{ fontWeight: 900 }}>Zurück zur App</a>
            <a href="/duelle" style={{ fontWeight: 900 }}>TNB Top Begegnungen</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card">
          <div className="metricLabel">Mannschaften</div>
          <div className="metricValue">{filteredTeamRows.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Souveräne Teams</div>
          <div className="metricValue">{sovereignTeams.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Enge Tabellenlagen</div>
          <div className="metricValue">{tightTables.length}</div>
        </div>
      </section>

      <AgeFilter activeAge={activeAge} ageClasses={ageClasses} />

      <TeamInsightList
        title="Souveräne Teams"
        subtitle="Teams mit besonders hoher Matchquote. Die Matchquote zeigt den Anteil gewonnener Einzel und Doppel an allen bisher gespielten Matches."
        rows={sovereignTeams}
        valueLabel="Matchquote"
        value={(row) => formatPercent(row.matchWinRate)}
        detail={(row) => `${row.matchPointsRaw} Matches · ${row.tablePointsRaw} Mannschaftspunkte · ${row.played} Punktspiel${Number(row.played) === 1 ? "" : "e"}`}
      />

      <GroupInsightList rows={tightTables} />
<TeamInsightList
        title="Teams unter Ergebnisdruck"
        subtitle="Teams, deren bisherige Ergebnisse bereits deutlich belastet sind. Im Unterschied zu Satzstatistiken geht es hier um verlorene Matches, verlorene Punktspiele und Tabellenlage."
        rows={teamsUnderPressure}
        valueLabel="Verlorene Matches"
        value={(row) => formatPercent(row.matchLossRate)}
        detail={(row) => `${row.matchPointsRaw} Matches · ${row.tablePointsRaw} Mannschaftspunkte · ${row.losses} verlorene Punktspiel${Number(row.losses) === 1 ? "" : "e"}`}
      />
    </main>
  );
}
