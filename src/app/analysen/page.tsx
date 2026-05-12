import { loadData } from "@/lib/storage";

type SearchParams = {
  age?: string;
};

function splitRecord(value: string | null | undefined) {
  if (!value) return { won: 0, lost: 0, total: 0 };

  const [wonRaw, lostRaw] = String(value).split(":").map(Number);
  const won = Number.isFinite(wonRaw) ? wonRaw : 0;
  const lost = Number.isFinite(lostRaw) ? lostRaw : 0;

  return {
    won,
    lost,
    total: won + lost
  };
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
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

function barWidth(value: number, max: number) {
  if (!max) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function ageHref(age: string) {
  if (age === "all") return "/analysen";
  return `/analysen?age=${encodeURIComponent(age)}`;
}

function isActiveAge(current: string, age: string) {
  return current === age;
}

function makeRows(data: any) {
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

      rows.push({
        team: standing.team,
        rank: standing.rank,
        played: standing.played ?? 0,
        wins: standing.wins ?? 0,
        draws: standing.draws ?? 0,
        losses: standing.losses ?? 0,
        tablePointsRaw: standing.tablePoints,
        matchPointsRaw: standing.matchPoints,
        setsRaw: standing.sets,
        gamesRaw: standing.games,
        tablePoints,
        matchPoints,
        sets,
        games,
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

function DataBar({ value, max }: { value: number; max: number }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ height: 9, borderRadius: 999, background: "#eef4f0", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: barWidth(value, max),
            borderRadius: 999,
            background: "linear-gradient(135deg, #2f6f45 0%, #245638 100%)"
          }}
        />
      </div>
    </div>
  );
}

function RankingTable({
  title,
  subtitle,
  rows,
  valueLabel,
  value,
  maxValue
}: {
  title: string;
  subtitle: string;
  rows: any[];
  valueLabel: string;
  value: (row: any) => number;
  maxValue: number;
}) {
  return (
    <section className="card" style={{ padding: 28, marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>{subtitle}</p>

      {rows.length === 0 ? (
        <p className="subtitle">Für diese Auswahl wurden keine passenden Teams gefunden.</p>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Mannschaft</th>
                <th>Altersklasse</th>
                <th>Liga</th>
                <th>Bilanz</th>
                <th>{valueLabel}</th>
                <th>Visual</th>
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
                  <td>
                    {row.tablePointsRaw || "0:0"} Punkte
                    <br />
                    <span style={{ color: "#66746c" }}>{row.matchPointsRaw || "0:0"} Matches</span>
                  </td>
                  <td><strong>{value(row)}</strong></td>
                  <td><DataBar value={value(row)} max={maxValue} /></td>
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
  const allRows = makeRows(data);

  const ageClasses = Array.from(new Set(allRows.map((row) => row.ageClass)))
    .sort((a, b) => ageSortValue(a) - ageSortValue(b));

  const activeAge = searchParams?.age || "all";

  const filteredRows = activeAge === "all"
    ? allRows
    : allRows.filter((row) => row.ageClass === activeAge);

  const undefeatedNoMatchLoss = filteredRows
    .filter((row) => Number(row.played) > 0)
    .filter((row) => Number(row.losses) === 0)
    .filter((row) => row.matchPoints.lost === 0)
    .sort((a, b) => {
      if (b.matchPoints.won !== a.matchPoints.won) return b.matchPoints.won - a.matchPoints.won;
      if (b.played !== a.played) return b.played - a.played;
      return Number(a.rank || 999) - Number(b.rank || 999);
    })
    .slice(0, 10);

  const topMatchPoints = [...filteredRows]
    .filter((row) => Number(row.played) > 0)
    .sort((a, b) => {
      if (b.matchPoints.won !== a.matchPoints.won) return b.matchPoints.won - a.matchPoints.won;
      if (a.matchPoints.lost !== b.matchPoints.lost) return a.matchPoints.lost - b.matchPoints.lost;
      return Number(a.rank || 999) - Number(b.rank || 999);
    })
    .slice(0, 10);

  const mostSetLosses = [...filteredRows]
    .filter((row) => Number(row.played) > 0)
    .sort((a, b) => {
      if (b.sets.lost !== a.sets.lost) return b.sets.lost - a.sets.lost;
      if (b.matchPoints.lost !== a.matchPoints.lost) return b.matchPoints.lost - a.matchPoints.lost;
      return Number(b.played || 0) - Number(a.played || 0);
    })
    .slice(0, 10);

  const maxUndefeated = Math.max(1, ...undefeatedNoMatchLoss.map((row) => row.matchPoints.won));
  const maxMatchPoints = Math.max(1, ...topMatchPoints.map((row) => row.matchPoints.won));
  const maxSetLosses = Math.max(1, ...mostSetLosses.map((row) => row.sets.lost));

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">TNB Analyse Center</div>
          <h1 className="title">Übergreifende Team Analysen</h1>
          <p className="subtitle">
            Diese Seite verdichtet die Tabellenstände über alle TNB Herren Ligen hinweg.
            Du kannst nach Altersklasse filtern und siehst, welche Teams besonders dominant sind
            oder auffällig viele Sätze abgeben.
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
          <div className="metricLabel">Teams in Auswahl</div>
          <div className="metricValue">{filteredRows.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Ohne Matchverlust</div>
          <div className="metricValue">{undefeatedNoMatchLoss.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Beste Matchpunkte</div>
          <div className="metricValue">{topMatchPoints[0]?.matchPoints.won ?? 0}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Höchste Satzverluste</div>
          <div className="metricValue">{mostSetLosses[0]?.sets.lost ?? 0}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <div className="metricLabel" style={{ marginBottom: 12 }}>Altersklasse filtern</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="badge" href="/analysen" style={{
            textDecoration: "none",
            background: isActiveAge(activeAge, "all") ? "#245638" : undefined,
            color: isActiveAge(activeAge, "all") ? "#ffffff" : undefined
          }}>
            Alle
          </a>

          {ageClasses.map((age) => (
            <a
              key={age}
              className="badge"
              href={ageHref(age)}
              style={{
                textDecoration: "none",
                background: isActiveAge(activeAge, age) ? "#245638" : undefined,
                color: isActiveAge(activeAge, age) ? "#ffffff" : undefined
              }}
            >
              {age}
            </a>
          ))}
        </div>
      </section>

      <RankingTable
        title="Top 10 ungeschlagen und ohne Matchverlust"
        subtitle="Teams, die noch keine Begegnung verloren haben und laut Tabelle auch keinen einzelnen Matchpunkt abgegeben haben."
        rows={undefeatedNoMatchLoss}
        valueLabel="Gewonnene Matches"
        value={(row) => row.matchPoints.won}
        maxValue={maxUndefeated}
      />

      <RankingTable
        title="Top 10 Team Matchpunkte"
        subtitle="Teams mit den meisten gewonnenen Matchpunkten insgesamt. Beispiel: 6:0 plus 6:0 ergibt 12 gewonnene Matchpunkte."
        rows={topMatchPoints}
        valueLabel="Gewonnene Matches"
        value={(row) => row.matchPoints.won}
        maxValue={maxMatchPoints}
      />

      <RankingTable
        title="Top 10 Teams mit den meisten Satzverlusten"
        subtitle="Teams mit den meisten verlorenen Sätzen laut offizieller Gruppentabelle. Das kann auf viele gespielte Begegnungen oder enge Spielverläufe hindeuten."
        rows={mostSetLosses}
        valueLabel="Verlorene Sätze"
        value={(row) => row.sets.lost}
        maxValue={maxSetLosses}
      />
    </main>
  );
}
