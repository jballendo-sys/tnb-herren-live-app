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
      const played = Number(standing.played ?? 0);
      const setLossesPerPointspiel = played > 0 ? Number((sets.lost / played).toFixed(2)) : 0;

      rows.push({
        team: standing.team,
        rank: standing.rank,
        played,
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
        setLossesPerPointspiel,
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


function formatNumber(value: number) {
  return String(value).replace(".", ",");
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
  const isAverageMetric = valueLabel.includes("Ø");

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
                    <strong>{formatNumber(value(row))}</strong>
                    {isAverageMetric ? (
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

  const mostSetLosses = [...filteredRows]
    .filter((row) => Number(row.played) > 0)
    .sort((a, b) => {
      if (b.setLossesPerPointspiel !== a.setLossesPerPointspiel) return b.setLossesPerPointspiel - a.setLossesPerPointspiel;
      if (b.sets.lost !== a.sets.lost) return b.sets.lost - a.sets.lost;
      return Number(b.played || 0) - Number(a.played || 0);
    })
    .slice(0, 10);

  const maxUndefeated = Math.max(1, ...undefeatedNoMatchLoss.map((row) => row.matchPoints.won));
  const maxSetLosses = Math.max(1, ...mostSetLosses.map((row) => row.setLossesPerPointspiel));

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">TNB Analyse Center</div>
          <h1 className="title">TNB Analyse Center</h1>
          <p className="subtitle">
            Diese Seite zeigt auffällige Mannschaften über alle TNB Herren Ligen hinweg. Du kannst nach Altersklasse filtern und erkennst auf einen Blick dominante Teams, offensivstarke Mannschaften und Teams mit auffällig vielen Satzverlusten.
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
          <div className="metricLabel">Dominante Teams</div>
          <div className="metricValue">{undefeatedNoMatchLoss.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Satzverluste</div>
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
        title="Dominante Teams"
        subtitle="Teams, die bislang keine Begegnung verloren und keinen einzelnen Matchpunkt abgegeben haben. Das ist der strengste Dominanzindikator."
        rows={undefeatedNoMatchLoss}
        valueLabel="Gewonnene Matchpunkte"
        value={(row) => row.matchPoints.won}
        maxValue={maxUndefeated}
      />

      <RankingTable
        title="Ø Satzverluste je Punktspiel"
        subtitle="Diese Analyse zeigt, wie viele Sätze eine Mannschaft durchschnittlich pro gespieltem Punktspiel verliert. Zusätzlich wird der absolute Satzverlust angezeigt."
        rows={mostSetLosses}
        valueLabel="Ø Satzverluste je Punktspiel"
        value={(row) => row.setLossesPerPointspiel}
        maxValue={maxSetLosses}
      />
    </main>
  );
}




