import { MainNav } from "@/components/MainNav";
import { loadData } from "@/lib/storage";

type SearchParams = {
  altersklasse?: string;
  liga?: string;
  top?: string;
  sort?: string;
};

function parseDate(value: string | null | undefined) {
  const [dayRaw, monthRaw, yearRaw] = String(value || "").split(".");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return 0;
  }

  return new Date(year, month - 1, day).getTime();
}

function isWithinLastSevenDays(dateText: string | null | undefined) {
  const timestamp = parseDate(dateText);

  if (!timestamp) {
    return false;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  return timestamp >= sevenDaysAgo.getTime() && timestamp <= today.getTime();
}

function resultValue(fixture: any) {
  const raw = String(fixture.matchPoints || fixture.score || fixture.result || "").trim();
  const match = raw.match(/^(\d+)\s*:\s*(\d+)$/);

  if (!match) return "";

  const home = Number(match[1]);
  const away = Number(match[2]);
  const total = home + away;

  if (total !== 6 && total !== 9) return "";

  return `${home}:${away}`;
}

function resultDifference(result: string) {
  const [homeRaw, awayRaw] = result.split(":").map(Number);
  const home = Number.isFinite(homeRaw) ? homeRaw : 0;
  const away = Number.isFinite(awayRaw) ? awayRaw : 0;

  return Math.abs(home - away);
}

function norm(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function record(value: string | null | undefined) {
  const [a, b] = String(value || "0:0").split(":").map(Number);

  return {
    home: Number.isFinite(a) ? a : 0,
    away: Number.isFinite(b) ? b : 0
  };
}

function uniqueKey(row: any) {
  return [
    row.groupId || row.group || "",
    row.date || "",
    row.time || "",
    norm(row.homeTeam),
    norm(row.awayTeam)
  ].join("|");
}

function ageSortValue(ageClass: string) {
  if (ageClass === "Herren") return 0;
  const value = Number(String(ageClass).replace(/\D/g, ""));
  return Number.isFinite(value) ? value : 999;
}

function rankOf(standings: any[], teamName: string) {
  const row = standings.find((item) => norm(item.team) === norm(teamName));
  return Number(row?.rank ?? 0);
}

function standingOf(standings: any[], teamName: string) {
  return standings.find((item) => norm(item.team) === norm(teamName));
}

function isUnbeaten(row: any) {
  if (!row) return false;

  const played = Number(row.played ?? 0);
  const losses = Number(row.losses ?? 0);
  const points = record(row.tablePoints || row.points);

  return played > 0 && losses === 0 && points.away === 0;
}

function topMatchLabel(row: any) {
  const standings = row.standings || [];

  const homeRank = rankOf(standings, row.homeTeam);
  const awayRank = rankOf(standings, row.awayTeam);

  const homeStanding = standingOf(standings, row.homeTeam);
  const awayStanding = standingOf(standings, row.awayTeam);

  const ranks = standings
    .map((item: any) => Number(item.rank))
    .filter(Number.isFinite)
    .filter((rank: number) => rank > 0);

  const lastRank = ranks.length ? Math.max(...ranks) : 0;
  const secondLastRank = lastRank > 1 ? lastRank - 1 : 0;

  if ((homeRank === 1 && awayRank === 2) || (homeRank === 2 && awayRank === 1)) {
    return "Rang 1 gegen 2";
  }

  if (isUnbeaten(homeStanding) && isUnbeaten(awayStanding)) {
    return "Ungeschlagenes Duell";
  }

  if ((homeRank === 1 && awayRank === 3) || (homeRank === 3 && awayRank === 1)) {
    return "Rang 1 gegen 3";
  }

  if (
    lastRank &&
    secondLastRank &&
    ((homeRank === lastRank && awayRank === secondLastRank) ||
      (homeRank === secondLastRank && awayRank === lastRank))
  ) {
    return "Kellerduell";
  }

  return "";
}

export default async function ErgebnissePage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const data = await loadData();

  const rows = (data.teams || [])
    .flatMap((team: any) =>
      (team.fixtures || [])
        .filter((fixture: any) => fixture.status === "completed")
        .map((fixture: any) => ({
          date: fixture.date,
          time: fixture.time,
          homeTeam: fixture.homeTeam || fixture.home,
          awayTeam: fixture.awayTeam || fixture.away,
          result: resultValue(fixture),
          ageClass: team.ageClass,
          league: team.league,
          group: team.group,
          groupId: team.groupId,
          groupUrl: fixture.reportUrl || fixture.url || team.groupUrl || team.sourceUrl,
          standings: team.standings || []
        }))
        .filter((row: any) => row.result)
        .filter((row: any) => isWithinLastSevenDays(row.date))
    );

  const uniqueRows = Array.from(
    new Map(rows.map((row: any) => [uniqueKey(row), row])).values()
  ).map((row: any) => ({
    ...row,
    topMatchLabel: topMatchLabel(row)
  }));

  const ageClasses = Array.from(
    new Set(uniqueRows.map((row: any) => row.ageClass).filter(Boolean))
  ).sort((a: any, b: any) => ageSortValue(a) - ageSortValue(b));

  const leagues = Array.from(
    new Set(uniqueRows.map((row: any) => row.league).filter(Boolean))
  ).sort((a: any, b: any) => String(a).localeCompare(String(b), "de"));

  const activeAge = searchParams?.altersklasse || "alle";
  const activeLeague = searchParams?.liga || "alle";
  const topOnly = searchParams?.top === "1";
  const sortMode = searchParams?.sort || "datum_neu";

  const filteredRows = uniqueRows
    .filter((row: any) => activeAge === "alle" || row.ageClass === activeAge)
    .filter((row: any) => activeLeague === "alle" || row.league === activeLeague)
    .filter((row: any) => !topOnly || row.topMatchLabel)
    .sort((a: any, b: any) => {
      if (sortMode === "datum_alt") return parseDate(a.date) - parseDate(b.date);
      if (sortMode === "liga") return String(a.league || "").localeCompare(String(b.league || ""), "de");
      if (sortMode === "heimteam") return String(a.homeTeam || "").localeCompare(String(b.homeTeam || ""), "de");
      if (sortMode === "ergebnis") return resultDifference(b.result) - resultDifference(a.result);
      return parseDate(b.date) - parseDate(a.date);
    });

  return (
    <main className="container">
      <MainNav />

      <section className="header">
        <div>
          <div className="badge">Aktuelle Ergebnisse</div>
          <h1 className="title">Aktuelle Ergebnisse</h1>
          <p className="subtitle">
            Diese Seite zeigt aktuell beendete Begegnungen der letzten 7 Tage bzw. den Stand der letzten Ergebniserfassung.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 240 }}>
          <div className="metricLabel">Ergebnisse</div>
          <div className="metricValue">{filteredRows.length}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <div className="metricLabel" style={{ marginBottom: 12 }}>Filtern und sortieren</div>

        <form method="get" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="metricLabel">Altersklasse</span>
              <select name="altersklasse" defaultValue={activeAge} style={{ padding: 12, borderRadius: 14, border: "1px solid #d7dfda" }}>
                <option value="alle">Alle Altersklassen</option>
                {ageClasses.map((age: any) => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="metricLabel">Liga</span>
              <select name="liga" defaultValue={activeLeague} style={{ padding: 12, borderRadius: 14, border: "1px solid #d7dfda" }}>
                <option value="alle">Alle Ligen</option>
                {leagues.map((league: any) => (
                  <option key={league} value={league}>{league}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="metricLabel">Typ</span>
              <select name="top" defaultValue={topOnly ? "1" : "0"} style={{ padding: 12, borderRadius: 14, border: "1px solid #d7dfda" }}>
                <option value="0">Alle Ergebnisse</option>
                <option value="1">Nur Top Begegnungen</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="metricLabel">Sortierung</span>
              <select name="sort" defaultValue={sortMode} style={{ padding: 12, borderRadius: 14, border: "1px solid #d7dfda" }}>
                <option value="datum_neu">Neueste zuerst</option>
                <option value="datum_alt">Älteste zuerst</option>
                <option value="liga">Nach Liga</option>
                <option value="heimteam">Nach Heimteam</option>
                <option value="ergebnis">Nach Ergebnisdifferenz</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="badge" style={{ fontWeight: 900, cursor: "pointer" }}>
              Anwenden
            </button>
            <a className="badge" href="/ergebnisse" style={{ textDecoration: "none", fontWeight: 900 }}>
              Zurücksetzen
            </a>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Ergebnisliste</h2>

        {filteredRows.length === 0 ? (
          <p className="subtitle">Aktuell wurden keine plausiblen Ergebnisse der letzten 7 Tage gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredRows.map((row: any, index: number) => (
              <article
                className="fixture"
                key={`${row.date}-${row.time}-${row.homeTeam}-${row.awayTeam}-${index}`}
              >
                <div>
                  <strong>{row.date}</strong>
                  <br />
                  <span style={{ color: "#66746c" }}>{row.time || "Zeit offen"}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{row.homeTeam}</div>
                  <div style={{ color: "#66746c" }}>gegen {row.awayTeam}</div>

                  {row.topMatchLabel ? (
                    <div style={{ marginTop: 6 }}>
                      <span className="badge">Top Begegnung · {row.topMatchLabel}</span>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 6, color: "#66746c", fontSize: 14 }}>
                    {[row.ageClass, row.league, row.group].filter(Boolean).join(" · ")}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{row.result}</div>
                  {row.groupUrl ? (
                    <a href={row.groupUrl} target="_blank" rel="noreferrer" style={{ color: "#245638", fontWeight: 900 }}>
                      nuLiga öffnen
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
