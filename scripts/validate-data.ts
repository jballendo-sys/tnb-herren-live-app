import fs from "node:fs";

const file = "data/tnb-herren.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const timePattern = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
const validScorePattern = /^[0-9]:[0-9]$/;

let problems = 0;
const seen = new Set<string>();

for (const team of data.teams || []) {
  for (const fixture of team.fixtures || []) {
    const value = fixture.matchPoints == null ? "" : String(fixture.matchPoints).trim();

    if (!value) continue;

    const key = [
      team.groupId,
      fixture.date,
      fixture.time,
      fixture.homeTeam,
      fixture.awayTeam,
      value
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);

    if (timePattern.test(value)) {
      problems++;
      console.log("UHRZEIT ALS ERGEBNIS:");
      console.log(`${team.club} | ${team.ageClass} | Gruppe ${team.groupId}`);
      console.log(`${fixture.date} ${fixture.time} | ${fixture.homeTeam} gegen ${fixture.awayTeam} | Ergebnis: ${value}`);
      console.log("");
      continue;
    }

    if (!validScorePattern.test(value)) {
      problems++;
      console.log("UNPLAUSIBLES ERGEBNISFORMAT:");
      console.log(`${team.club} | ${team.ageClass} | Gruppe ${team.groupId}`);
      console.log(`${fixture.date} ${fixture.time} | ${fixture.homeTeam} gegen ${fixture.awayTeam} | Ergebnis: ${value}`);
      console.log("");
    }
  }
}

if (problems === 0) {
  console.log("OK: Keine Uhrzeiten oder unplausiblen Werte im Ergebnisfeld gefunden.");
} else {
  console.log(`Gefundene Probleme: ${problems}`);
  process.exit(1);
}
