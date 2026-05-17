import { MainNav } from "@/components/MainNav";
import { loadData } from "@/lib/storage";

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

function norm(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
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

export default async function ErgebnissePage() {
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
          groupUrl: fixture.reportUrl || fixture.url || team.groupUrl || team.sourceUrl
        }))
        .filter((row: any) => row.result)
        .filter((row: any) => isWithinLastSevenDays(row.date))
    );

  const uniqueRows = Array.from(
    new Map(rows.map((row: any) => [uniqueKey(row), row])).values()
  ).sort((a: any, b: any) => parseDate(b.date) - parseDate(a.date));

  return (
    <main className="container">
      <MainNav />

      <section className="header">
        <div>
          <div className="badge">Ergebnisse</div>
          <h1 className="title">Aktuelle Ergebnisse</h1>
          <p className="subtitle">
            Diese Seite zeigt aktuell beendete Begegnungen der letzten 7 Tage bzw. den Stand der letzten Ergebniserfassung.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 240 }}>
          <div className="metricLabel">Ergebnisse</div>
          <div className="metricValue">{uniqueRows.length}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Ergebnisliste</h2>

        {uniqueRows.length === 0 ? (
          <p className="subtitle">Aktuell wurden keine plausiblen Ergebnisse der letzten 7 Tage gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {uniqueRows.map((row: any, index: number) => (
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
