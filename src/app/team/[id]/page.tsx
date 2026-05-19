import { MainNav } from "@/components/MainNav";
import { loadData } from "@/lib/storage";
import Link from "next/link";

function resultValue(fixture: any) {
  return String(fixture.matchPoints || fixture.score || fixture.result || "").trim();
}

function fixtureTeamName(value: string | null | undefined) {
  return String(value || "").trim();
}

function sameTeamName(a: string | null | undefined, b: string | null | undefined) {
  return String(a || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim() === String(b || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fixtureBelongsToTeam(fixture: any, team: any) {
  const ownName = (team as any).team || (team as any).club;
  const homeTeam = fixture.homeTeam || fixture.home;
  const awayTeam = fixture.awayTeam || fixture.away;

  return sameTeamName(homeTeam, ownName) || sameTeamName(awayTeam, ownName);
}

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

function statusLabel(status: string) {
  if (status === "completed") return "Beendet";
  if (status === "live") return "Live";
  return "Offen";
}

function record(value: string | null | undefined) {
  const [a, b] = String(value || "0:0").split(":").map(Number);

  return {
    won: Number.isFinite(a) ? a : 0,
    lost: Number.isFinite(b) ? b : 0
  };
}

function percent(value: string | null | undefined) {
  const parsed = record(value);
  const total = parsed.won + parsed.lost;

  if (!total) return 0;

  return Math.round((parsed.won / total) * 100);
}

function FixtureCard({ fixture }: { fixture: any }) {
  const homeTeam = fixtureTeamName(fixture.homeTeam || fixture.home);
  const awayTeam = fixtureTeamName(fixture.awayTeam || fixture.away);
  const result = resultValue(fixture);

  return (
    <article
      className="fixture"
      key={`${fixture.date}-${fixture.time}-${homeTeam}-${awayTeam}`}
    >
      <div>
        <strong>{fixture.date}</strong>
        <br />
        <span style={{ color: "#66746c" }}>{fixture.time || "Zeit offen"}</span>
      </div>

      <div>
        <div style={{ fontWeight: 900 }}>{homeTeam}</div>
        <div style={{ color: "#66746c" }}>gegen {awayTeam}</div>
        <div style={{ marginTop: 6 }}>
          <span className="badge">{statusLabel(fixture.status)}</span>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>
          {result || "Noch kein Ergebnis"}
        </div>
      </div>
    </article>
  );
}

export default async function TeamPage({
  params
}: {
  params: { id: string };
}) {
  const data = await loadData();
  const team = (data.teams || []).find((item: any) => item.id === params.id);

  if (!team) {
    return (
      <main className="container">
        <MainNav />

        <section className="card" style={{ padding: 28, marginTop: 24 }}>
          <h1 style={{ marginTop: 0 }}>Team nicht gefunden</h1>
          <p className="subtitle">Für diese Team ID wurde kein Eintrag gefunden.</p>
          <Link href="/" className="badge" style={{ textDecoration: "none", fontWeight: 900 }}>
            Zurück zur Startseite
          </Link>
        </section>
      </main>
    );
  }

  const standing =
    ((team as any).standings || []).find((row: any) => row.team === (team as any).team || row.team === (team as any).club) ||
    ((team as any).standings || [])[0];

  const ownFixtures = ((team as any).fixtures || []).filter((fixture: any) => fixtureBelongsToTeam(fixture, team));

  const completedFixtures = ownFixtures
    .filter((fixture: any) => fixture.status === "completed")
    .sort((a: any, b: any) => parseDate(b.date) - parseDate(a.date));

  const upcomingFixtures = ownFixtures
    .filter((fixture: any) => fixture.status !== "completed")
    .sort((a: any, b: any) => parseDate(a.date) - parseDate(b.date));

  return (
    <main className="container">
      <MainNav />

      <section className="header">
        <div>
          <div className="badge">Team Detail</div>
          <h1 className="title">{(team as any).team || (team as any).club}</h1>
          <p className="subtitle">
            {[(team as any).ageClass, (team as any).league, (team as any).group].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 240 }}>
          <div className="metricLabel">Aktueller Rang</div>
          <div className="metricValue">{standing?.rank || "–"}</div>
          {(team as any).groupUrl || (team as any).sourceUrl ? (
            <a
              href={(team as any).groupUrl || (team as any).sourceUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#245638", fontWeight: 900 }}
            >
              nuLiga öffnen
            </a>
          ) : null}
        </div>
      </section>

      <section className="metrics" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="metricLabel">Punkte</div>
          <div className="metricValue">{standing?.points || standing?.tablePoints || "–"}</div>
        </div>

        <div className="card">
          <div className="metricLabel">Matchquote</div>
          <div className="metricValue">{percent(standing?.matches)}%</div>
        </div>

        <div className="card">
          <div className="metricLabel">Satzquote</div>
          <div className="metricValue">{percent(standing?.sets)}%</div>
        </div>

        <div className="card">
          <div className="metricLabel">Offene Spiele</div>
          <div className="metricValue">{upcomingFixtures.length}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Letzte Ergebnisse</h2>

        {completedFixtures.length === 0 ? (
          <p className="subtitle">Für dieses Team wurden noch keine beendeten Begegnungen gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {completedFixtures.map((fixture: any) => (
              <FixtureCard key={`${fixture.date}-${fixture.time}-${fixture.homeTeam || fixture.home}-${fixture.awayTeam || fixture.away}`} fixture={fixture} />
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Kommende Begegnungen</h2>

        {upcomingFixtures.length === 0 ? (
          <p className="subtitle">Für dieses Team wurden keine offenen Begegnungen gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {upcomingFixtures.map((fixture: any) => (
              <FixtureCard key={`${fixture.date}-${fixture.time}-${fixture.homeTeam || fixture.home}-${fixture.awayTeam || fixture.away}`} fixture={fixture} />
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Tabelle</h2>

        {((team as any).standings || []).length === 0 ? (
          <p className="subtitle">Für dieses Team wurde keine Tabelle gefunden.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Rang</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Team</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Spiele</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Punkte</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Matches</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Sätze</th>
                </tr>
              </thead>
              <tbody>
                {((team as any).standings || []).map((row: any) => (
                  <tr
                    key={row.team}
                    style={{
                      borderTop: "1px solid #e5ece8",
                      background: row.team === (team as any).team || row.team === (team as any).club ? "#f4faf6" : undefined
                    }}
                  >
                    <td style={{ padding: 10, fontWeight: 900 }}>{row.rank}</td>
                    <td style={{ padding: 10 }}>{row.team}</td>
                    <td style={{ padding: 10 }}>{row.played}</td>
                    <td style={{ padding: 10 }}>{row.points || row.tablePoints}</td>
                    <td style={{ padding: 10 }}>{row.matches}</td>
                    <td style={{ padding: 10 }}>{row.sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
