const data = require("../data/tnb-herren.json");

function splitRecord(value) {
  if (!value) return { won: 0, lost: 0, total: 0 };
  const [wonRaw, lostRaw] = String(value).split(":").map(Number);
  const won = Number.isFinite(wonRaw) ? wonRaw : 0;
  const lost = Number.isFinite(lostRaw) ? lostRaw : 0;
  return { won, lost, total: won + lost };
}

function pct(won, total) {
  return total > 0 ? (won / total) * 100 : 0;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function teamKey(groupId, team) {
  return `${groupId || "?"}|${String(team || "").toLowerCase().trim()}`;
}

const teamRows = [];
const groupRows = [];

const seenTeams = new Set();
const seenGroups = new Set();

for (const groupTeam of data.teams || []) {
  const groupId = groupTeam.groupId || `${groupTeam.ageClass}|${groupTeam.league}|${groupTeam.group}`;

  if (!seenGroups.has(groupId)) {
    seenGroups.add(groupId);

    const standings = (groupTeam.standings || [])
      .map((row) => ({
        ...row,
        rank: safeNumber(row.rank, 999),
        tablePoints: splitRecord(row.tablePoints),
        matchPoints: splitRecord(row.matchPoints)
      }))
      .filter((row) => row.rank > 0 && row.rank < 999)
      .sort((a, b) => a.rank - b.rank);

    if (standings.length >= 3) {
      const top1 = standings[0];
      const top3 = standings[2];

      const gapPoints = Math.max(0, top1.tablePoints.won - top3.tablePoints.won);
      const gapMatches = Math.abs(top1.matchPoints.won - top3.matchPoints.won);
      const fixtures = groupTeam.fixtures || [];
      const openFixtures = fixtures.filter((fixture) => fixture.status === "open").length;
      const completedFixtures = fixtures.filter((fixture) => fixture.status === "completed").length;

      const tensionScore =
        Math.max(0, 40 - gapPoints * 12) +
        Math.max(0, 25 - gapMatches * 2) +
        Math.min(openFixtures, 6) * 4 +
        Math.min(completedFixtures, 6) * 3;

      groupRows.push({
        ageClass: groupTeam.ageClass,
        league: groupTeam.league,
        group: groupTeam.group,
        groupId,
        gapPoints,
        gapMatches,
        openFixtures,
        completedFixtures,
        top1: top1.team,
        top2: standings[1].team,
        top3: standings[2].team,
        tensionScore
      });
    }
  }

  for (const standing of groupTeam.standings || []) {
    const key = teamKey(groupId, standing.team);
    if (seenTeams.has(key)) continue;
    seenTeams.add(key);

    const played = safeNumber(standing.played);
    const wins = safeNumber(standing.wins);
    const losses = safeNumber(standing.losses);
    const rank = safeNumber(standing.rank, 999);
    const tablePoints = splitRecord(standing.tablePoints);
    const matchPoints = splitRecord(standing.matchPoints);
    const sets = splitRecord(standing.sets);

    const matchWinRate = pct(matchPoints.won, matchPoints.total);
    const matchLossRate = pct(matchPoints.lost, matchPoints.total);
    const setWinRate = pct(sets.won, sets.total);
    const setLossRate = pct(sets.lost, sets.total);

    const playedScore = Math.min(played, 4) * 5;
    const rankBonus = rank === 1 ? 10 : rank === 2 ? 5 : 0;

    const sovereigntyScore =
      matchWinRate * 0.5 +
      setWinRate * 0.25 +
      playedScore +
      rankBonus;

    const pressureScore =
      matchLossRate * 0.45 +
      setLossRate * 0.15 +
      Math.min(played, 4) * 6 +
      losses * 8 +
      matchPoints.lost * 0.8 +
      (rank >= 4 && rank < 999 ? 8 : 0);

    teamRows.push({
      team: standing.team,
      ageClass: groupTeam.ageClass,
      league: groupTeam.league,
      group: groupTeam.group,
      groupId,
      rank,
      played,
      wins,
      losses,
      tablePoints: standing.tablePoints,
      matchPoints: standing.matchPoints,
      sets: standing.sets,
      matchWinRate,
      matchLossRate,
      setWinRate,
      setLossRate,
      sovereigntyScore,
      pressureScore
    });
  }
}

function show(title, rows, mapper) {
  console.log("");
  console.log(title);
  console.log("=".repeat(title.length));
  console.table(rows.slice(0, 25).map(mapper));

  const place10 = rows[9];
  const place20 = rows[19];
  const place21 = rows[20];

  console.log("Anzahl Kandidaten:", rows.length);
  if (place10) console.log("Score Platz 10:", mapper(place10).score);
  if (place20) console.log("Score Platz 20:", mapper(place20).score);
  if (place21) console.log("Score Platz 21:", mapper(place21).score);
}

const sovereign = teamRows
  .filter((row) => row.played > 0)
  .filter((row) => row.matchWinRate >= 90)
  .sort((a, b) => {
    if (b.sovereigntyScore !== a.sovereigntyScore) return b.sovereigntyScore - a.sovereigntyScore;
    if (b.played !== a.played) return b.played - a.played;
    return a.rank - b.rank;
  });

const tight = groupRows
  .filter((row) => row.completedFixtures > 0)
  .sort((a, b) => {
    if (b.tensionScore !== a.tensionScore) return b.tensionScore - a.tensionScore;
    if (a.gapPoints !== b.gapPoints) return a.gapPoints - b.gapPoints;
    return b.openFixtures - a.openFixtures;
  });

const pressure = teamRows
  .filter((row) => row.played > 0)
  .filter((row) => row.matchLossRate >= 80 || row.losses > 0)
  .sort((a, b) => {
    if (b.pressureScore !== a.pressureScore) return b.pressureScore - a.pressureScore;
    if (b.played !== a.played) return b.played - a.played;
    return b.losses - a.losses;
  });

show("Souveräne Teams nach Score", sovereign, (row) => ({
  team: row.team,
  age: row.ageClass,
  liga: row.league,
  gruppe: row.group,
  rang: row.rank,
  spiele: row.played,
  matches: row.matchPoints,
  saetze: row.sets,
  score: row.sovereigntyScore.toFixed(1)
}));

show("Enge Tabellenlagen nach Score", tight, (row) => ({
  age: row.ageClass,
  liga: row.league,
  gruppe: row.group,
  abstandPunkte: row.gapPoints,
  abstandMatches: row.gapMatches,
  ausstehend: row.openFixtures,
  gespielt: row.completedFixtures,
  score: row.tensionScore.toFixed(1)
}));

show("Teams unter Ergebnisdruck nach Score", pressure, (row) => ({
  team: row.team,
  age: row.ageClass,
  liga: row.league,
  gruppe: row.group,
  rang: row.rank,
  spiele: row.played,
  matches: row.matchPoints,
  saetze: row.sets,
  score: row.pressureScore.toFixed(1)
}));
