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

function formatNumber(value: number) {
  return String(value).replace(".", ",");
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

function makeTeamRows(data: any) {
  const seen = new Set<string>();
  const rows: any[] = [];

  for (const team of data.teams || []) {
    for (const standing of team.standings || []) {
      const key = `${team.groupId}|${standing.team}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const tablePoints = splitRecord(standing.tablePoints);
      const matchPoints = splitRecord(standing.matchPoints);
      const sets = splitRecord(standing.sets);
      const games = splitRecord(standing.games);
      const played = Number(standing.played ?? 0);
      const rank = Number(standing.rank ?? 999);
      const wins = Number(standing.wins ?? 0);
      const losses = Number(standing.losses ?? 0);

      const setLossesPerPointspiel = played > 0 ? Number((sets.lost / played).toFixed(1)) : 0;
      const matchLossRate = matchPoints.total > 0 ? Math.round((matchPoints.lost / matchPoints.total) * 100) : 0;
      const setLossRate = sets.total > 0 ? Math.round((sets.lost / sets.total) * 100) : 0;

      rows.push({
        team: standing.team,
        rank,
        played,
        wins,
        losses,
        tablePointsRaw: standing.tablePoints,
        matchPointsRaw: standing.matchPoints,
        setsRaw: standing.sets,
        gamesRaw: standing.games,
        tablePoints,
        matchPoints,
        sets,
        games,
        setLossesPerPointspiel,
        matchLossRate,
        setLossRate,
        ageClass: team.ageClass,
        league: team.league,
        group: team.group,
        groupId: team.groupId,
        groupUrl: team.groupUrl
      });
    }
  }

  return rows;
}

function makeGroupRows(data: any) {
  const seen = new Set<string>();
  const groups: any[] = [];

  for (const team of data.teams || []) {
    if (seen.has(team.groupId)) continue;
    seen.add(team.groupId);

    const standings = (team.standings || [])
      .map((row: any) => ({
        ...row,
        rank: Number(row.rank ?? 999),
        tablePoints: splitRecord(row.tablePoints),
        matchPoints: splitRecord(row.matchPoints),
        sets: splitRecord(row.sets),
        played: Number(row.played ?? 0)
      }))
      .sort((a: any, b: any) => a.rank - b.rank);

    if (standings.length < 3) continue;

    const top1 = standings[0];
    const top2 = standings[1];
    const top3 = standings[2];

    const gapTop1ToTop3 = top1.tablePoints.won - top3.tablePoints.won;
    const gapTop1ToTop2 = top1.tablePoints.won - top2.tablePoints.won;

    const fixtures = team.fixtures || [];
    const openFixtures = fixtures.filter((fixture: any) => fixture.status === "open").length;
    const completedFixtures = fixtures.filter((fixture: any) => fixture.status === "completed").length;

    groups.push({
      ageClass: team.ageClass,
      league: team.league,
      group: team.group,
      groupId: team.groupId,
      groupUrl: team.groupUrl,
      top1,
      top2,
      top3,
      gapTop1ToTop2,
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

function TeamTable({
  title,
  subtitle,
  rows,
  valueLabel,
  value,
  averageMetric = false
}: {
  title: string;
  subtitle: string;
  rows: any[];
  valueLabel: string;
  value: (row: any) => number | string;
  averageMetric?: boolean;
}) {
  return (
    <section className="card" style={{ padding: 28, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>{subtitle}</p>

      {rows.length === 0 ? (
        <p className="subtitle">Für diese Auswahl wurden keine passenden Mannschaften gefunden.</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Mannschaft</th>
                <th>Altersklasse</th>
                <th>Liga</th>
                <th>Mannschaftspunkte</th>
                <th>Matchpunkte</th>
                <th>{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${row.groupId}-${row.team}`}>
                  <td><strong>{index + 1}</strong></td>
                  <td>
                    <strong>{row.team}</strong>
                    <div style={{ marginTop: 4 }}>
                      <a href={row.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                        nuLiga öffnen
                      </a>
                    </div>
                  </td>
                  <td>{row.ageClass}</td>
                  <td>{leagueWithGroup(row.league, row.group)}</td>
                  <td><strong>{row.tablePointsRaw || "0:0"}</strong></td>
                  <td><strong>{row.matchPointsRaw || "0:0"}</strong></td>
                  <td>
                    <strong>{typeof value(row) === "number" ? formatNumber(value(row) as number) : value(row)}</strong>
                    {averageMetric ? (
                      <div style={{ color: "#66746c", fontSize: 13 }}>
                        {row.sets.lost} Satzverluste gesamt · {row.played} Punktspiel{Number(row.played) === 1 ? "" : "e"}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GroupTable({ rows }: { rows: any[] }) {
  return (
    <section className="card" style={{ padding: 28, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Engste Gruppen</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Diese Analyse zeigt Gruppen, in denen Platz 1 bis Platz 3 besonders nah beieinanderliegen. Je kleiner der Abstand, desto offener ist die Spitze der Gruppe.
      </p>

      {rows.length === 0 ? (
        <p className="subtitle">Für diese Auswahl wurden keine engen Gruppen gefunden.</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Altersklasse</th>
                <th>Liga</th>
                <th>Platz 1</th>
                <th>Platz 2</th>
                <th>Platz 3</th>
                <th>Abstand Platz 1 zu 3</th>
                <th>Offen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.groupId}-${index}`}>
                  <td><strong>{index + 1}</strong></td>
                  <td>{row.ageClass}</td>
                  <td>
                    <strong>{leagueWithGroup(row.league, row.group)}</strong>
                    <div style={{ marginTop: 4 }}>
                      <a href={row.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                        nuLiga öffnen
                      </a>
                    </div>
                  </td>
                  <td>{row.top1.team}<br /><span style={{ color: "#66746c" }}>{row.top1.tablePoints.won}:{row.top1.tablePoints.lost}</span></td>
                  <td>{row.top2.team}<br /><span style={{ color: "#66746c" }}>{row.top2.tablePoints.won}:{row.top2.tablePoints.lost}</span></td>
                  <td>{row.top3.team}<br /><span style={{ color: "#66746c" }}>{row.top3.tablePoints.won}:{row.top3.tablePoints.lost}</span></td>
                  <td><strong>{row.gapTop1ToTop3}</strong> Punkte</td>
                  <td>{row.openFixtures}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

  const dominantTeams = filteredTeamRows
    .filter((row) => row.played > 0)
    .filter((row) => row.losses === 0)
    .filter((row) => row.matchPoints.lost === 0)
    .sort((a, b) => {
      if (b.matchPoints.won !== a.matchPoints.won) return b.matchPoints.won - a.matchPoints.won;
      if (b.played !== a.played) return b.played - a.played;
      return a.rank - b.rank;
    })
    .slice(0, 10);

  const setLossesPerPointspiel = filteredTeamRows
    .filter((row) => row.played > 0)
    .sort((a, b) => {
      if (b.setLossesPerPointspiel !== a.setLossesPerPointspiel) return b.setLossesPerPointspiel - a.setLossesPerPointspiel;
      if (b.sets.lost !== a.sets.lost) return b.sets.lost - a.sets.lost;
      return b.played - a.played;
    })
    .slice(0, 10);

  const tightestGroups = filteredGroupRows
    .filter((row) => row.completedFixtures > 0)
    .sort((a, b) => {
      if (a.gapTop1ToTop3 !== b.gapTop1ToTop3) return a.gapTop1ToTop3 - b.gapTop1ToTop3;
      if (b.openFixtures !== a.openFixtures) return b.openFixtures - a.openFixtures;
      return a.gapTop1ToTop2 - b.gapTop1ToTop2;
    })
    .slice(0, 10);

  const teamsUnderPressure = filteredTeamRows
    .filter((row) => row.played > 0)
    .filter((row) => row.losses > 0 || row.matchLossRate >= 55 || row.setLossRate >= 55)
    .sort((a, b) => {
      if (b.matchLossRate !== a.matchLossRate) return b.matchLossRate - a.matchLossRate;
      if (b.setLossRate !== a.setLossRate) return b.setLossRate - a.setLossRate;
      if (b.setLossesPerPointspiel !== a.setLossesPerPointspiel) return b.setLossesPerPointspiel - a.setLossesPerPointspiel;
      return b.losses - a.losses;
    })
    .slice(0, 10);

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">Analyse Center</div>
          <h1 className="title">TNB Analyse Center</h1>
          <p className="subtitle">
            Diese Seite verdichtet öffentliche nuLiga Tabellenstände über alle TNB Herren Ligen hinweg. Die Analysen zeigen dominante Mannschaften, hohe Satzbelastung, enge Gruppen und Mannschaften unter sportlichem Druck.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 280 }}>
          <div className="metricLabel">Letzter Datenabruf</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {new Date(data.generatedAt).toLocaleString("de-DE")}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="/" style={{ fontWeight: 900 }}>Zurück zur App</a>
            <a href="/duelle" style={{ fontWeight: 900 }}>TNB Top 10</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card">
          <div className="metricLabel">Mannschaften</div>
          <div className="metricValue">{filteredTeamRows.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Dominante Mannschaften</div>
          <div className="metricValue">{dominantTeams.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Engste Gruppen</div>
          <div className="metricValue">{tightestGroups.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Unter Druck</div>
          <div className="metricValue">{teamsUnderPressure.length}</div>
        </div>
      </section>

      <AgeFilter activeAge={activeAge} ageClasses={ageClasses} />

      <TeamTable
        title="Dominante Mannschaften"
        subtitle="Mannschaften, die bislang kein Punktspiel verloren und keinen einzelnen Matchpunkt abgegeben haben."
        rows={dominantTeams}
        valueLabel="Gewonnene Matchpunkte"
        value={(row) => row.matchPoints.won}
      />

      <TeamTable
        title="Ø Satzverluste je Punktspiel"
        subtitle="Diese Analyse zeigt, wie viele Sätze eine Mannschaft durchschnittlich pro gespieltem Punktspiel verliert. Zusätzlich wird der absolute Satzverlust angezeigt."
        rows={setLossesPerPointspiel}
        valueLabel="Ø Satzverluste je Punktspiel"
        value={(row) => row.setLossesPerPointspiel}
        averageMetric
      />

      <GroupTable rows={tightestGroups} />

      <TeamTable
        title="Mannschaften unter Druck"
        subtitle="Mannschaften mit vielen verlorenen Matchpunkten, hoher Satzverlustquote oder bereits verlorenen Punktspielen. Die Kennzahl zeigt den Anteil verlorener Matchpunkte."
        rows={teamsUnderPressure}
        valueLabel="Verlorene Matchpunkte in %"
        value={(row) => `${row.matchLossRate}%`}
      />
    </main>
  );
}
