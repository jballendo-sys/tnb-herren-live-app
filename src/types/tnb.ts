export type FixtureStatus = "completed" | "open" | "live" | "unknown";

export type GroupLink = {
  groupId: string;
  ageClass: string;
  leagueSection: "Damen/Herren" | "Altersklassen";
  sourceUrl: string;
  groupUrl: string;
};

export type StandingRow = {
  rank: number | null;
  team: string;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  tablePoints: string | null;
  matchPoints: string | null;
  sets: string | null;
  games: string | null;
};

export type Fixture = {
  date: string | null;
  time: string | null;
  homeTeam: string;
  awayTeam: string;
  matchPoints: string | null;
  sets: string | null;
  games: string | null;
  status: FixtureStatus;
  reportUrl: string | null;
};

export type TeamEntry = {
  id: string;
  club: string;
  cityGuess: string;
  gender: "Herren";
  ageClass: string;
  league: string;
  group: string;
  groupId: string;
  groupUrl: string;
  fetchedAt: string;
  standings: StandingRow[];
  fixtures: Fixture[];
  warnings: string[];
};

export type AppData = {
  generatedAt: string;
  championship: string;
  sourcePages: string[];
  groupCount: number;
  teamCount: number;
  teams: TeamEntry[];
  warnings: string[];
};
