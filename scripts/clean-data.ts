import fs from "node:fs";

const file = "data/tnb-herren.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const timePattern = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
const validTeamScorePattern = /^[0-9]:[0-9]$/;

let cleaned = 0;

for (const team of data.teams || []) {
  for (const fixture of team.fixtures || []) {
    const value = fixture.matchPoints == null ? "" : String(fixture.matchPoints).trim();

    if (!value) {
      fixture.matchPoints = null;
      continue;
    }

    const isTime = timePattern.test(value);
    const isValidTeamScore = validTeamScorePattern.test(value);

    if (isTime || !isValidTeamScore) {
      fixture.matchPoints = null;

      if (fixture.status === "completed") {
        fixture.status = "open";
      }

      cleaned++;
    }
  }
}

data.generatedAt = new Date().toISOString();

fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

console.log(`Bereinigt: ${cleaned} ungültige Ergebniswerte entfernt.`);
