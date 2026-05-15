const fs = require("fs");

const file = "data/tnb-herren.json";
const raw = fs.readFileSync(file, "utf8");
const data = JSON.parse(raw);

const teams = Array.isArray(data.teams) ? data.teams : [];

const issues = {
  missingClub: [],
  missingAgeClass: [],
  missingLeague: [],
  missingGroup: [],
  missingGroupUrl: [],
  missingStandings: [],
  ownTeamNotInStandings: [],
  rankOpen: [],
  duplicateTeams: [],
  duplicateFixtures: [],
  invalidCompletedResults: [],
  openFixturesWithResult: [],
  completedFixturesWithoutResult: []
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isValidResult(value) {
  return /^\d{1,2}:\d{1,2}$/.test(String(value || "").trim());
}

function resultOf(fixture) {
  return fixture.matchPoints || fixture.score || fixture.result || "";
}

const teamKeys = new Map();

for (const team of teams) {
  const label = `${team.club || "?"} | ${team.ageClass || "?"} | ${team.league || "?"} | ${team.group || "?"}`;

  if (!team.club) issues.missingClub.push(label);
  if (!team.ageClass) issues.missingAgeClass.push(label);
  if (!team.league) issues.missingLeague.push(label);
  if (!team.group) issues.missingGroup.push(label);
  if (!team.groupUrl) issues.missingGroupUrl.push(label);

  if (!Array.isArray(team.standings) || team.standings.length === 0) {
    issues.missingStandings.push(label);
  } else {
    const ownFound = team.standings.some((row) => normalize(row.team) === normalize(team.club));
    if (!ownFound) issues.ownTeamNotInStandings.push(label);

    for (const row of team.standings) {
      const rank = Number(row.rank);
      if (!Number.isFinite(rank) || rank < 0) {
        issues.rankOpen.push(`${label} | ${row.team || "?"} | Rang ${row.rank}`);
      }

      if (rank === 0) {
        issues.rankOpen.push(`${label} | ${row.team || "?"} | Rang offen`);
      }
    }
  }

  const teamKey = normalize(`${team.club}|${team.ageClass}|${team.league}|${team.group}|${team.groupId || ""}`);
  if (teamKeys.has(teamKey)) {
    issues.duplicateTeams.push(label);
  } else {
    teamKeys.set(teamKey, true);
  }

  const fixtureKeys = new Map();
  const fixtures = Array.isArray(team.fixtures) ? team.fixtures : [];

  for (const fixture of fixtures) {
    const result = resultOf(fixture);
    const status = normalize(fixture.status);
    const fixtureLabel = `${label} | ${fixture.date || "?"} | ${fixture.homeTeam || fixture.home || "?"} gegen ${fixture.awayTeam || fixture.away || "?"} | ${result || ""} | ${fixture.status || ""}`;

    const fixtureKey = normalize(`${fixture.date}|${fixture.time}|${fixture.homeTeam || fixture.home}|${fixture.awayTeam || fixture.away}|${fixture.groupId || team.groupId || ""}`);
    if (fixtureKeys.has(fixtureKey)) {
      issues.duplicateFixtures.push(fixtureLabel);
    } else {
      fixtureKeys.set(fixtureKey, true);
    }

    if (status === "completed" && !isValidResult(result)) {
      issues.completedFixturesWithoutResult.push(fixtureLabel);
    }

    if ((status === "open" || status === "scheduled") && isValidResult(result)) {
      issues.openFixturesWithResult.push(fixtureLabel);
    }

    if (result && !isValidResult(result)) {
      issues.invalidCompletedResults.push(fixtureLabel);
    }
  }
}

console.log("Audit TNB Herren Daten");
console.log("=====================");
console.log(`Teams: ${teams.length}`);
console.log(`Gruppen laut Datei: ${data.groupCount ?? "unbekannt"}`);
console.log(`Mannschaften laut Datei: ${data.teamCount ?? "unbekannt"}`);
console.log(`Generiert: ${data.generatedAt ?? "unbekannt"}`);
console.log("");

for (const [key, list] of Object.entries(issues)) {
  console.log(`${key}: ${list.length}`);
  for (const item of list.slice(0, 10)) {
    console.log(`  ${item}`);
  }
  if (list.length > 10) console.log(`  plus ${list.length - 10} weitere`);
  console.log("");
}

const critical =
  issues.missingClub.length ||
  issues.missingAgeClass.length ||
  issues.missingLeague.length ||
  issues.missingGroup.length ||
  issues.missingStandings.length ||
  issues.ownTeamNotInStandings.length ||
  issues.duplicateTeams.length ||
  issues.duplicateFixtures.length ||
  issues.invalidCompletedResults.length ||
  issues.openFixturesWithResult.length ||
  issues.completedFixturesWithoutResult.length;

if (critical) {
  process.exitCode = 1;
} else {
  console.log("OK: Keine kritischen Strukturfehler gefunden.");
}
