"use client";

import { useMemo, useState } from "react";
import type { AppData, Fixture, FixtureStatus, StandingRow, TeamEntry } from "@/types/tnb";

function AppLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.22)"
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #fef08a, #facc15)",
            border: "2px solid rgba(255,255,255,0.75)",
            position: "relative"
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 7,
              top: 2,
              width: 2,
              height: 24,
              background: "rgba(15,23,42,0.35)",
              transform: "rotate(25deg)",
              borderRadius: 999
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 7,
              top: 2,
              width: 2,
              height: 24,
              background: "rgba(15,23,42,0.35)",
              transform: "rotate(25deg)",
              borderRadius: 999
            }}
          />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>
          MatchRadar TNB
        </div>
        <div style={{ color: "#64748b", fontSize: 14, fontWeight: 600 }}>
          Herren Ligen · Ergebnisse · Tabellen · Analyse
        </div>
      </div>
    </div>
  );
}
function splitRecord(value: string | null) {
  if (!value) return { a: 0, b: 0 };
  const [a, b] = value.split(":").map(Number);
  return {
    a: Number.isFinite(a) ? a : 0,
    b: Number.isFinite(b) ? b : 0
  };
}

function normalizeName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTeamFixture(team: TeamEntry, fixture: Fixture) {
  const club = normalizeName(team.club);
  return normalizeName(fixture.homeTeam) === club || normalizeName(fixture.awayTeam) === club;
}

function fixturesForTeam(team: TeamEntry) {
  return team.fixtures.filter((fixture) => isTeamFixture(team, fixture));
}

function ownStanding(team: TeamEntry) {
  return team.standings.find((row) => normalizeName(row.team) === normalizeName(team.club)) || team.standings[0];
}

function tablePointsValue(value: string | null) {
  const record = splitRecord(value);
  return record.a;
}

function analyticsFor(team: TeamEntry) {
  const own = ownStanding(team);
  const leader = team.standings[0];
  const ownFixtures = fixturesForTeam(team);

  const matchRecord = splitRecord(own?.matchPoints ?? null);
  const setRecord = splitRecord(own?.sets ?? null);
  const tableRecord = splitRecord(own?.tablePoints ?? null);
  const leaderRecord = splitRecord(leader?.tablePoints ?? null);

  const matchTotal = matchRecord.a + matchRecord.b;
  const setTotal = setRecord.a + setRecord.b;

  const completedFixtures = ownFixtures.filter((fixture) => fixture.status === "completed");
  const openFixtures = ownFixtures.filter((fixture) => fixture.status === "open");
  const liveFixtures = ownFixtures.filter((fixture) => fixture.status === "live");

  const nextFixture = openFixtures[0] || liveFixtures[0] || null;
  const distanceToLeader = Math.max(0, leaderRecord.a - tableRecord.a);

  const previousRow = own?.rank && own.rank > 1
    ? team.standings.find((row) => row.rank === own.rank! - 1)
    : null;

  const distanceToNextRank = previousRow
    ? Math.max(0, tablePointsValue(previousRow.tablePoints) - tableRecord.a)
    : 0;

  const matchRate = matchTotal ? Math.round((matchRecord.a / matchTotal) * 100) : 0;
  const setRate = setTotal ? Math.round((setRecord.a / setTotal) * 100) : 0;

  let trend = "kritisch";
  if (matchRate >= 65 && tableRecord.a > 0) trend = "stark";
  else if (matchRate >= 50 || tableRecord.a > 0) trend = "stabil";

  return {
    rank: own?.rank ?? null,
    points: own?.tablePoints ?? "0:0",
    matchPoints: own?.matchPoints ?? "0:0",
    sets: own?.sets ?? "0:0",
    games: own?.games ?? "0:0",
    matchRate,
    setRate,
    completedFixtures: completedFixtures.length,
    openFixtures: openFixtures.length,
    liveFixtures: liveFixtures.length,
    nextFixture,
    distanceToLeader,
    distanceToNextRank,
    leader: leader?.team ?? null,
    trend,
    ownFixtures
  };
}

function statusLabel(status: FixtureStatus) {
  if (status === "completed") return "Beendet";
  if (status === "open") return "Offen";
  if (status === "live") return "Live";
  return "Unklar";
}

function statusClass(status: FixtureStatus) {
  if (status === "live") return "badge badgeLive";
  if (status === "open") return "badge badgeOpen";
  return "badge";
}

function fixtureScore(fixture: Fixture) {
  return fixture.matchPoints ?? "Noch kein Ergebnis";
}

function FixtureRow({ fixture, highlight }: { fixture: Fixture; highlight?: string }) {
  const homeActive = highlight && normalizeName(fixture.homeTeam) === normalizeName(highlight);
  const awayActive = highlight && normalizeName(fixture.awayTeam) === normalizeName(highlight);

  return (
    <div className="fixture">
      <div className="metricLabel">
        {fixture.date ?? ""}
        <br />
        {fixture.time ?? ""}
      </div>

      <div>
        <strong style={{ color: homeActive ? "#0f172a" : undefined }}>
          {fixture.homeTeam}
        </strong>
        <div className="subtitle" style={{ margin: 0 }}>
          gegen <strong style={{ color: awayActive ? "#0f172a" : undefined }}>{fixture.awayTeam}</strong>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong>{fixtureScore(fixture)}</strong>
        <span className={statusClass(fixture.status)}>{statusLabel(fixture.status)}</span>
      </div>
    </div>
  );
}

function DataCheck({ team }: { team: TeamEntry }) {
  const own = ownStanding(team);
  const teamFixtures = fixturesForTeam(team).filter((fixture) => fixture.status === "completed");
  const calculated = teamFixtures.reduce(
    (sum, fixture) => {
      const result = splitRecord(fixture.matchPoints);
      if (normalizeName(fixture.homeTeam) === normalizeName(team.club)) {
        return { won: sum.won + result.a, lost: sum.lost + result.b };
      }
      return { won: sum.won + result.b, lost: sum.lost + result.a };
    },
    { won: 0, lost: 0 }
  );

  const official = splitRecord(own?.matchPoints ?? null);
  const isComplete = calculated.won === official.a && calculated.lost === official.b;

  return (
    <div className={isComplete ? "card" : "warning"}>
      <strong>Datenprüfung</strong>
      <p className="subtitle" style={{ marginBottom: 0 }}>
        Aus den angezeigten abgeschlossenen Mannschaftsspielen ergeben sich {calculated.won}:{calculated.lost} Matches.
        Die offizielle Tabelle zeigt {official.a}:{official.b}. {isComplete ? "Die Anzeige ist plausibel." : "Die Anzeige ist noch nicht vollständig oder eine Spielzeile wurde nicht erkannt."}
      </p>
    </div>
  );
}

export function TnbDashboard({ data }: { data: AppData }) {
  const [query, setQuery] = useState("");
  const [ageClass, setAgeClass] = useState("all");
  const [selectedTeamId, setSelectedTeamId] = useState(data.teams[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState("overview");

  const ageClasses = useMemo(() => {
    return Array.from(new Set(data.teams.map((team) => team.ageClass))).sort((a, b) => {
      return Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""));
    });
  }, [data.teams]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.teams.filter((team) => {
      const search = `${team.club} ${team.cityGuess} ${team.ageClass} ${team.league} ${team.group}`.toLowerCase();
      return search.includes(q) && (ageClass === "all" || team.ageClass === ageClass);
    });
  }, [data.teams, query, ageClass]);

  const selectedTeam = filteredTeams.find((team) => team.id === selectedTeamId) || filteredTeams[0] || null;
  const selectedAnalytics = selectedTeam ? analyticsFor(selectedTeam) : null;

  const grouped = useMemo(() => {
    const map = new Map<string, TeamEntry[]>();

    for (const team of filteredTeams) {
      const key = team.club;
      map.set(key, [...(map.get(key) || []), team]);
    }

    return Array.from(map.entries()).map(([clubName, teams]) => ({ clubName, teams }));
  }, [filteredTeams]);

  const clubs = new Set(filteredTeams.map((team) => team.club)).size;
  const cities = new Set(filteredTeams.map((team) => team.cityGuess)).size;
  const allFixtures = filteredTeams.flatMap((team) => fixturesForTeam(team));
  const completed = allFixtures.filter((fixture) => fixture.status === "completed").length; const openFixtures = allFixtures.filter((fixture) => fixture.status === "open").length; const fixtureBase = openFixtures + completed; const seasonProgress = fixtureBase ? Math.round((completed / fixtureBase) * 100) : 0;

  return (
    <main className="container">
      <section className="header">
        <div>
          <AppLogo />
<div className="badge" style={{ marginTop: 18 }}>Inoffizielle Auswertung öffentlicher nuLiga Daten</div>
<h1 className="title" style={{ marginTop: 18 }}>TNB Herren Vereinsfinder</h1>
<p className="subtitle">
  Suche nach Verein, Ort, Altersklasse, Liga oder Gruppe. Öffne jede Mannschaft und sieh Ergebnisse, Tabellen, Restprogramm und Analysen auf Basis öffentlicher nuLiga Daten.
</p>
        </div>

        <div className="card">
          <div className="metricLabel">Letzter Datenabruf</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>
            {new Date(data.generatedAt).toLocaleString("de-DE")}
          </div>
          <div className="metricLabel" style={{ marginTop: 8 }}>
            {data.groupCount} Gruppen · {data.teamCount} Mannschaften
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card"><div className="metricLabel">Mannschaften</div><div className="metricValue">{filteredTeams.length}</div></div>
        <div className="card"><div className="metricLabel">Vereine</div><div className="metricValue">{clubs}</div></div>
        <div className="card"><div className="metricLabel">Orte</div><div className="metricValue">{cities}</div></div>
        <div className="card"><div className="metricLabel">Gruppen</div><div className="metricValue">{data.groupCount}</div></div>
        <div className="card"><div className="metricLabel">Saisonfortschritt</div><div className="metricValue">{seasonProgress}%</div><div style={{ marginTop: 8, color: "#66746c", fontSize: 14, fontWeight: 700 }}>{openFixtures} offene Spiele</div></div>
        <div className="card"><div className="metricLabel">Beendet</div><div className="metricValue">{completed}</div></div>
      </section>

      {data.warnings.length > 0 && (
        <div className="warning">
          {data.warnings.slice(0, 3).join(" · ")}
          {data.warnings.length > 3 ? ` · plus ${data.warnings.length - 3} weitere Hinweise` : ""}
        </div>
      )}

      <section className="card controls">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Verein oder Ort suchen, zum Beispiel Hameln, Hannover, Emmerthal, TC, TV"
        />

        <select className="select" value={ageClass} onChange={(event) => setAgeClass(event.target.value)}>
          <option value="all">Alle Herren Klassen</option>
          {ageClasses.map((age) => (
            <option key={age} value={age}>{age}</option>
          ))}
        </select>

        <button className="button" onClick={() => { setQuery(""); setAgeClass("all"); }}>
          Filter zurücksetzen
        </button>
      </section>

      <section className="layout">
        <aside className="card">
          <strong>Gefundene Vereine und Mannschaften</strong>

          <div className="sidebarList">
            {grouped.map((group) => (
              <div key={group.clubName} style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{group.clubName}</div>

                {group.teams.map((team) => {
                  const a = analyticsFor(team);
                  const active = selectedTeam?.id === team.id;

                  return (
                    <button
                      key={team.id}
                      className={`teamButton ${active ? "teamButtonActive" : ""}`}
                      onClick={() => { setSelectedTeamId(team.id); setActiveTab("overview"); }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong>{team.ageClass}</strong>
                        <span className="badge">Rang {a.rank ?? "?"}</span>
                      </div>

                      <div style={{ marginTop: 5, color: active ? "#cbd5e1" : "#64748b", fontSize: 13 }}>
                        {team.league} · {team.group}
                      </div>

                      <div style={{ marginTop: 5, color: active ? "#cbd5e1" : "#64748b", fontSize: 13 }}>
                        {a.points} Punkte · {a.completedFixtures} gespielt · {a.openFixtures} offen
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <section>
          {selectedTeam && selectedAnalytics ? (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">{selectedTeam.gender}</span>
                    <span className="badge">{selectedTeam.ageClass}</span>
                    <span className="badge">Gruppe {selectedTeam.groupId}</span>
                  </div>

                  <h2 style={{ fontSize: 28, marginBottom: 4 }}>{selectedTeam.club}</h2>
                  <div className="subtitle">
                    {selectedTeam.cityGuess} · {selectedTeam.league} · {selectedTeam.group}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div className="metricLabel">Rang</div>
                  <div className="metricValue">{selectedAnalytics.rank ?? "?"}</div>
                </div>
              </div>

              <div className="metrics" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 16 }}>
                <div className="card"><div className="metricLabel">Punkte</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.points}</div></div>
                <div className="card"><div className="metricLabel">Match Quote</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.matchRate}%</div></div>
                <div className="card"><div className="metricLabel">Satz Quote</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.setRate}%</div></div>
                <div className="card"><div className="metricLabel">Quelle</div><a href={selectedTeam.groupUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>nuLiga öffnen</a></div>
              </div>

              <div className="tabs">
                {[
                  ["overview", "Überblick"],
                  ["fixtures", "Ergebnisse"],
                  ["standings", "Tabelle"],
                  ["analysis", "Analyse"]
                ].map(([id, label]) => (
                  <button key={id} className={`tab ${activeTab === id ? "tabActive" : ""}`} onClick={() => setActiveTab(id)}>
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="card">
                  <strong>Kurzprofil</strong>
                  <p className="subtitle">
                    {selectedTeam.club} spielt in der Klasse {selectedTeam.ageClass}, Liga {selectedTeam.league}, {selectedTeam.group}.
                    Die Daten stammen direkt aus der TNB nuLiga Gruppen Seite und wurden am {new Date(selectedTeam.fetchedAt).toLocaleString("de-DE")} abgerufen.
                  </p>
                </div>
              )}

              {activeTab === "fixtures" && (
                <div>
                  <h3>Spiele dieser Mannschaft</h3>
                  {selectedAnalytics.ownFixtures.length > 0 ? (
                    selectedAnalytics.ownFixtures.map((fixture, index) => (
                      <FixtureRow key={`own-${fixture.date}-${fixture.homeTeam}-${fixture.awayTeam}-${index}`} fixture={fixture} highlight={selectedTeam.club} />
                    ))
                  ) : (
                    <div className="warning">Für diese Mannschaft wurden keine eigenen Spiele erkannt.</div>
                  )}

                  <h3 style={{ marginTop: 26 }}>Alle Gruppenspiele</h3>
                  {selectedTeam.fixtures.map((fixture, index) => (
                    <FixtureRow key={`group-${fixture.date}-${fixture.homeTeam}-${fixture.awayTeam}-${index}`} fixture={fixture} highlight={selectedTeam.club} />
                  ))}
                </div>
              )}

              {activeTab === "standings" && (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rang</th>
                        <th>Mannschaft</th>
                        <th>Beg.</th>
                        <th>S</th>
                        <th>U</th>
                        <th>N</th>
                        <th>Tab.</th>
                        <th>Matches</th>
                        <th>Sätze</th>
                        <th>Spiele</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeam.standings.map((row: StandingRow) => (
                        <tr key={row.team} style={{ background: normalizeName(row.team) === normalizeName(selectedTeam.club) ? "#f8fafc" : "white" }}>
                          <td>{row.rank}</td>
                          <td><strong>{row.team}</strong></td>
                          <td>{row.played}</td>
                          <td>{row.wins}</td>
                          <td>{row.draws}</td>
                          <td>{row.losses}</td>
                          <td>{row.tablePoints}</td>
                          <td>{row.matchPoints}</td>
                          <td>{row.sets}</td>
                          <td>{row.games}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "analysis" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div className="metrics" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    <div className="card"><div className="metricLabel">Tabellenführer</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.leader ?? "?"}</div></div>
                    <div className="card"><div className="metricLabel">Abstand zur Spitze</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.distanceToLeader} Punkte</div></div>
                    <div className="card"><div className="metricLabel">Abstand zum nächsten Rang</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.distanceToNextRank} Punkte</div></div>
                    <div className="card"><div className="metricLabel">Trend</div><div style={{ fontWeight: 800 }}>{selectedAnalytics.trend}</div></div>
                  </div>

                  <div className="card">
                    <strong>Automatische Einschätzung</strong>
                    <p className="subtitle">
                      {selectedTeam.club} steht aktuell auf Rang {selectedAnalytics.rank ?? "?"} mit {selectedAnalytics.points} Tabellenpunkten.
                      Die Match Quote liegt bei {selectedAnalytics.matchRate} Prozent, die Satz Quote bei {selectedAnalytics.setRate} Prozent.
                      Bisher wurden {selectedAnalytics.completedFixtures} Mannschaftsspiele abgeschlossen, {selectedAnalytics.openFixtures} sind offen.
                    </p>
                    {selectedAnalytics.nextFixture && (
                      <p className="subtitle">
                        Nächstes offenes Spiel: {selectedAnalytics.nextFixture.date ?? ""} gegen{" "}
                        {normalizeName(selectedAnalytics.nextFixture.homeTeam) === normalizeName(selectedTeam.club)
                          ? selectedAnalytics.nextFixture.awayTeam
                          : selectedAnalytics.nextFixture.homeTeam}
                        .
                      </p>
                    )}
                  </div>

                  <DataCheck team={selectedTeam} />
                </div>
              )}

              {selectedTeam.warnings.length > 0 && (
                <div className="warning">{selectedTeam.warnings.join(" · ")}</div>
              )}
            </div>
          ) : (
            <div className="card">Keine Mannschaft gefunden. Bitte Suche oder Altersklasse ändern.</div>
          )}
        </section>
      </section>
          <footer style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span>MatchRadar TNB · Inoffizielle Auswertung öffentlicher nuLiga Daten</span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
  <a href="/radar" style={{ fontWeight: 800 }}>Spieltagsradar</a>
<a href="/duelle" style={{ fontWeight: 800 }}>TNB Top 10</a>
<a href="/analysen" style={{ fontWeight: 800 }}>Analysen</a>
  <a href="/impressum" style={{ fontWeight: 800 }}>Impressum</a>
</div>
        </div>
      </footer>
    </main>
  );
}















