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

function formatScore(value: number) {
  return Number(value || 0).toFixed(1);
}

function scoreNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function scorePercent(record: { won: number; lost: number; total: number }) {
  return record.total > 0 ? (record.won / record.total) * 100 : 0;
}

function calculateSovereigntyScore(row: any) {
  const played = scoreNumber(row.played);
  const rank = scoreNumber(row.rank, 999);
  const matchPoints = row.matchPoints || splitRecord(row.matchPointsRaw);
  const sets = row.sets || splitRecord(row.setsRaw);

  const matchWinRate = scorePercent(matchPoints);
  const setWinRate = scorePercent(sets);
  const playedScore = Math.min(played, 4) * 5;
  const rankBonus = rank === 1 ? 10 : rank === 2 ? 5 : 0;

  return matchWinRate * 0.5 + setWinRate * 0.25 + playedScore + rankBonus;
}

function calculatePressureScore(row: any) {
  const played = scoreNumber(row.played);
  const losses = scoreNumber(row.losses);
  const rank = scoreNumber(row.rank, 999);
  const matchPoints = row.matchPoints || splitRecord(row.matchPointsRaw);
  const sets = row.sets || splitRecord(row.setsRaw);

  const matchLossRate = matchPoints.total > 0 ? (matchPoints.lost / matchPoints.total) * 100 : 0;
  const setLossRate = sets.total > 0 ? (sets.lost / sets.total) * 100 : 0;

  return (
    matchLossRate * 0.45 +
    setLossRate * 0.15 +
    Math.min(played, 4) * 6 +
    losses * 8 +
    matchPoints.lost * 0.8 +
    (rank >= 4 && rank < 999 ? 8 : 0)
  );
}

function calculateTensionScore(row: any) {
  const gapPoints = scoreNumber(row.gapPoints ?? row.gapTop1ToTop3);
  const gapMatches = scoreNumber(row.gapMatches);
  const openFixtures = scoreNumber(row.openFixtures);
  const completedFixtures = scoreNumber(row.completedFixtures);

  return (
    Math.max(0, 40 - gapPoints * 12) +
    Math.max(0, 25 - gapMatches * 2) +
    Math.min(openFixtures, 6) * 4 +
    Math.min(completedFixtures, 6) * 3
  );
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

function ScoreExplanation() {
  return (
    <section className="card" style={{ padding: 28, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Wie werden die Scores berechnet?</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Die Top 10 werden nicht nach einem einzelnen Wert gebildet. Jeder Bereich nutzt einen kombinierten Score. Je höher der Score, desto auffälliger ist das Team oder die Gruppe in diesem Analysebereich.
      </p>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 18 }}>
        <div style={{ border: "1px solid #dfe9e2", borderRadius: 18, padding: 18, background: "#ffffff" }}>
          <h3 style={{ marginTop: 0 }}>Souveränitäts Score</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Bewertet Teams, die nicht nur gewinnen, sondern dies möglichst klar und über mehrere Begegnungen tun.
          </p>
          <p style={{ marginBottom: 0, color: "#66746c" }}>
            Matchquote zählt am stärksten. Zusätzlich fließen Satzquote, Anzahl gespielter Punktspiele und ein Bonus für Rang 1 oder Rang 2 ein.
          </p>
        </div>

        <div style={{ border: "1px solid #dfe9e2", borderRadius: 18, padding: 18, background: "#ffffff" }}>
          <h3 style={{ marginTop: 0 }}>Spannungs Score</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Bewertet Gruppen, in denen die Tabellenspitze besonders eng ist.
          </p>
          <p style={{ marginBottom: 0, color: "#66746c" }}>
            Entscheidend sind der Punkteabstand zwischen Rang 1 und Rang 3, der Matchabstand der Spitzenteams, bereits gespielte Begegnungen und noch ausstehende Begegnungen.
          </p>
        </div>

        <div style={{ border: "1px solid #dfe9e2", borderRadius: 18, padding: 18, background: "#ffffff" }}>
          <h3 style={{ marginTop: 0 }}>Ergebnisdruck Score</h3>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Bewertet Teams, deren bisherige Ergebnisse besonders belastet sind.
          </p>
          <p style={{ marginBottom: 0, color: "#66746c" }}>
            Berücksichtigt werden Matchverlustquote, Satzverlustquote, verlorene Punktspiele, Anzahl gespielter Punktspiele, verlorene Matches und eine schwache Tabellenposition.
          </p>
        </div>
      </div>

      <p className="subtitle" style={{ marginTop: 18, marginBottom: 0 }}>
        Die Scores sind bewusst als Vergleichswerte gedacht. Sie ersetzen nicht die offizielle Tabelle, helfen aber dabei, aus vielen Mannschaften und Gruppen die auffälligsten Fälle schneller zu erkennen.
      </p>
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
        Angezeigt werden die Top 10 nach Spannungs Score. Der Score kombiniert den Punkteabstand zwischen Rang 1 und Rang 3, den Matchabstand, bereits gespielte Begegnungen und noch ausstehende Begegnungen. Je höher der Wert, desto relevanter ist die Tabellenlage an der Spitze.
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
                  {row.completedFixtures} gespielt · {row.openFixtures} ausstehend · Abstand Rang 1 zu 3: {row.gapPoints} Punkte
                </div>
                <div style={{ marginTop: 6 }}>
                  <a href={row.groupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800 }}>
                    nuLiga öffnen
                  </a>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="metricLabel">Spannungs Score</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{formatScore(row.displayScore ?? calculateTensionScore(row))}</div>
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
    .map((row) => ({ ...row, displayScore: calculateSovereigntyScore(row) }))
    .sort((a, b) => {
      if (b.displayScore !== a.displayScore) return b.displayScore - a.displayScore;
      if (b.played !== a.played) return b.played - a.played;
      return a.rank - b.rank;
    })
    .slice(0, 10);

  const tightTables = filteredGroupRows
    .filter((row) => row.completedFixtures > 0)
    .map((row) => ({ ...row, displayScore: calculateTensionScore(row) }))
    .sort((a, b) => {
      if (b.displayScore !== a.displayScore) return b.displayScore - a.displayScore;
      const aGap = a.gapPoints ?? a.gapTop1ToTop3 ?? 999;
      const bGap = b.gapPoints ?? b.gapTop1ToTop3 ?? 999;
      if (aGap !== bGap) return aGap - bGap;
      return b.openFixtures - a.openFixtures;
    })
    .slice(0, 10);

  const teamsUnderPressure = filteredTeamRows
    .filter((row) => row.played > 0)
    .filter((row) => row.losses > 0 || row.matchLossRate >= 50)
    .map((row) => ({ ...row, displayScore: calculatePressureScore(row) }))
    .sort((a, b) => {
      if (b.displayScore !== a.displayScore) return b.displayScore - a.displayScore;
      if (b.losses !== a.losses) return b.losses - a.losses;
      return b.matchPoints.lost - a.matchPoints.lost;
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

      <ScoreExplanation />

      <TeamInsightList
        title="Souveräne Teams"
        subtitle={`${sovereignTeams.length} Teams erfüllen aktuell die Kriterien. Angezeigt werden die Top 10 nach Souveränitäts Score. Der Score kombiniert Matchquote, Satzquote, Anzahl gespielter Punktspiele und Tabellenrang. Dadurch werden Teams bevorzugt, die nicht nur gewinnen, sondern dies auch klar und über mehrere Begegnungen bestätigen.`}
        rows={sovereignTeams}
        valueLabel="Souveränitäts Score"
        value={(row) => formatScore(row.displayScore ?? calculateSovereigntyScore(row))}
        detail={(row) => `Score ${formatScore(row.displayScore ?? calculateSovereigntyScore(row))} · Satzquote ${formatPercent(row.setWinRate)} · ${row.matchPointsRaw} Matches · Rang ${row.rank}`}
      />

      <GroupInsightList rows={tightTables} />
<TeamInsightList
        title="Teams unter Ergebnisdruck"
        subtitle="Angezeigt werden die Top 10 nach Ergebnisdruck Score. Der Score kombiniert Matchverlustquote, Satzverlustquote, verlorene Punktspiele, verlorene Matches und Tabellenrang. Je höher der Wert, desto stärker ist die bisherige Ergebnisschwäche."
        rows={teamsUnderPressure}
        valueLabel="Ergebnisdruck Score"
        value={(row) => formatScore(row.displayScore ?? calculatePressureScore(row))}
        detail={(row) => `Score ${formatScore(row.displayScore ?? calculatePressureScore(row))} · ${row.matchPointsRaw} Matches · ${row.tablePointsRaw} Mannschaftspunkte · ${row.losses} verlorene Punktspiele`}
      />
    </main>
  );
}
