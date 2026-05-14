import { MainNav } from "@/components/MainNav";
﻿export const dynamic = "force-dynamic";

type SearchParams = {
  verband?: string;
  altersklasse?: string;
  monat?: string;
  ort?: string;
  radius?: string;
};

type Tournament = {
  id: string;
  association: string;
  sourceLabel: string;
  name: string;
  date: string;
  month: string;
  year: string;
  ageClasses: string[];
  location: string;
  distanceKm: number | null;
  text: string;
  url: string;
};

const SOURCES = [
  {
    association: "TNB",
    label: "Tennisverband Niedersachsen Bremen",
    federation: "TNB",
    host: "https://tnb.liga.nu"
  },
  {
    association: "WTV",
    label: "Westfälischer Tennis Verband",
    federation: "WTV",
    host: "https://wtv.liga.nu"
  }
];

const AGE_CLASSES = [
  "Herren",
  "Herren 30",
  "Herren 35",
  "Herren 40",
  "Herren 45",
  "Herren 50",
  "Herren 55",
  "Herren 60",
  "Herren 65",
  "Herren 70",
  "Herren 75",
  "Herren 80"
];

const MONTHS_2026: [string, string][] = [
  ["all", "Alle Monate"],
  ["05", "Mai 2026"],
  ["06", "Juni 2026"],
  ["07", "Juli 2026"],
  ["08", "August 2026"],
  ["09", "September 2026"],
  ["10", "Oktober 2026"],
  ["11", "November 2026"],
  ["12", "Dezember 2026"]
];

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  hameln: { lat: 52.1031, lon: 9.3560 },
  emmerthal: { lat: 52.0500, lon: 9.3833 },
  hannover: { lat: 52.3759, lon: 9.7320 },
  hildesheim: { lat: 52.1548, lon: 9.9579 },
  braunschweig: { lat: 52.2689, lon: 10.5268 },
  wolfsburg: { lat: 52.4227, lon: 10.7865 },
  salzgitter: { lat: 52.1379, lon: 10.3899 },
  celle: { lat: 52.6226, lon: 10.0805 },
  göttingen: { lat: 51.5413, lon: 9.9158 },
  lüneburg: { lat: 53.2464, lon: 10.4115 },
  oldenburg: { lat: 53.1435, lon: 8.2146 },
  osnabrück: { lat: 52.2799, lon: 8.0472 },
  bremen: { lat: 53.0793, lon: 8.8017 },
  bremerhaven: { lat: 53.5396, lon: 8.5809 },
  bielefeld: { lat: 52.0302, lon: 8.5325 },
  paderborn: { lat: 51.7189, lon: 8.7575 },
  münster: { lat: 51.9607, lon: 7.6261 },
  dortmund: { lat: 51.5136, lon: 7.4653 },
  bochum: { lat: 51.4818, lon: 7.2162 },
  essen: { lat: 51.4556, lon: 7.0116 },
  gütersloh: { lat: 51.9069, lon: 8.3785 },
  herford: { lat: 52.1146, lon: 8.6734 },
  minden: { lat: 52.2895, lon: 8.9146 },
  detmold: { lat: 51.9385, lon: 8.8732 },
  hamm: { lat: 51.6739, lon: 7.8159 },
  soest: { lat: 51.5710, lon: 8.1058 },
  arnsberg: { lat: 51.3967, lon: 8.0644 },
  siegen: { lat: 50.8838, lon: 8.0200 },
  hagen: { lat: 51.3671, lon: 7.4633 },
  iserlohn: { lat: 51.3755, lon: 7.7028 },
  warendorf: { lat: 51.9511, lon: 7.9874 }
};

function selected(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function hrefFor(params: Record<string, string>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") search.set(key, value);
  });

  const query = search.toString();
  return query ? `/turniere?${query}` : "/turniere";
}

function formatDateForUrl(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeeklyDates2026() {
  const dates: string[] = [];
  const start = new Date(2026, 4, 1);
  const end = new Date(2026, 11, 31);

  for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 7)) {
    dates.push(formatDateForUrl(current));
  }

  return dates;
}

function buildSourceUrls() {
  const dates = buildWeeklyDates2026();

  return SOURCES.flatMap((source) =>
    dates.map((date) => ({
      association: source.association,
      sourceLabel: source.label,
      url: `${source.host}/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/tournamentCalendar?date=${date}&federation=${source.federation}`,
      date
    }))
  );
}

async function fetchSource(source: ReturnType<typeof buildSourceUrls>[number]) {
  try {
    const response = await fetch(source.url, {
      next: { revalidate: 60 * 60 * 6 }
    });

    const html = await response.text();

    return {
      ...source,
      html
    };
  } catch {
    return {
      ...source,
      html: ""
    };
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTournamentBlocks(text: string) {
  const datePattern = /(\d{2}\.\d{2}\.\d{4}\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.|\d{2}\.\d{2}\.\d{4})/g;
  const matches = Array.from(text.matchAll(datePattern));

  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index || 0;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    return text.slice(start, end).trim();
  });
}

function extractDate(block: string) {
  const match = block.match(/(\d{2}\.\d{2}\.\d{4}\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.|\d{2}\.\d{2}\.\d{4})/);
  return match ? match[1].replace(/\s+/g, " ") : "Datum offen";
}

function extractMonth(dateText: string) {
  const match = dateText.match(/\d{2}\.(\d{2})\./);
  return match ? match[1] : "unknown";
}

function extractYear(dateText: string) {
  const match = dateText.match(/(20\d{2})/);
  return match ? match[1] : "2026";
}

function getBerlinTodayStart() {
  const berlinDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );

  return new Date(
    berlinDate.getFullYear(),
    berlinDate.getMonth(),
    berlinDate.getDate()
  );
}

function parseGermanDate(value: string, fallbackYear = 2026) {
  const match = value.match(/(\d{2})\.(\d{2})\.(20\d{2})?/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3]) : fallbackYear;

  return new Date(year, month - 1, day);
}

function getTournamentEndDate(dateText: string) {
  const year = Number(extractYear(dateText));
  const matches = Array.from(dateText.matchAll(/(\d{2})\.(\d{2})\.(20\d{2})?/g));

  if (matches.length === 0) return null;

  const last = matches[matches.length - 1];
  const day = Number(last[1]);
  const month = Number(last[2]);
  const dateYear = last[3] ? Number(last[3]) : year || 2026;

  return new Date(dateYear, month - 1, day);
}

function isCurrentOrFutureTournament(dateText: string) {
  const endDate = getTournamentEndDate(dateText);

  if (!endDate) return true;

  return endDate >= getBerlinTodayStart();
}

function extractAgeClasses(block: string) {
  return AGE_CLASSES.filter((age) => {
    const pattern = new RegExp(`\\b${age.replace(" ", "\\s+")}\\b`, "i");
    return pattern.test(block);
  });
}

function extractLocation(block: string) {
  const lower = block.toLowerCase();

  const match = Object.keys(CITY_COORDS).find((city) => lower.includes(city));

  if (!match) return "Ort nicht erkannt";

  return match.charAt(0).toUpperCase() + match.slice(1);
}

function extractName(block: string) {
  const date = extractDate(block);
  const afterDate = block.replace(date, "").trim();
  const markerIndex = afterDate.search(/\b(Herren|Damen|Junior|LK|DTB|Veranstalter|Austragungsort|Meldeschluss|Nenngeld|Nebenrunde)\b/i);
  const candidate = markerIndex > 4 ? afterDate.slice(0, markerIndex).trim() : afterDate.slice(0, 120).trim();

  return candidate || "Turnier";
}

function normalizeCity(value: string) {
  return value.trim().toLowerCase();
}

function distanceKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const radius = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function parseTournaments(source: Awaited<ReturnType<typeof fetchSource>>) {
  const text = stripHtml(source.html);
  const blocks = splitTournamentBlocks(text);

  return blocks
    .map((block, index): Tournament => {
      const date = extractDate(block);
      const month = extractMonth(date);
      const year = extractYear(date);
      const ageClasses = extractAgeClasses(block);
      const location = extractLocation(block);

      return {
        id: `${source.association}-${source.date}-${index}`,
        association: source.association,
        sourceLabel: source.sourceLabel,
        name: extractName(block),
        date,
        month,
        year,
        ageClasses,
        location,
        distanceKm: null,
        text: block,
        url: source.url
      };
    })
    .filter((item) => item.year === "2026")
    .filter((item) => ["05", "06", "07", "08", "09", "10", "11", "12"].includes(item.month))
    .filter((item) => isCurrentOrFutureTournament(item.date))
    .filter((item) => item.ageClasses.length > 0);
}

function dedupeTournaments(items: Tournament[]) {
  const map = new Map<string, Tournament>();

  for (const item of items) {
    const key = `${item.association}|${item.date}|${item.name}`;
    if (!map.has(key)) map.set(key, item);
  }

  return Array.from(map.values());
}

function enrichDistances(items: Tournament[], origin: string) {
  const originCoords = CITY_COORDS[normalizeCity(origin)];

  if (!originCoords) return items;

  return items.map((item) => {
    const locationCoords = CITY_COORDS[normalizeCity(item.location)];

    if (!locationCoords) return item;

    return {
      ...item,
      distanceKm: distanceKm(originCoords, locationCoords)
    };
  });
}

export default async function TurnierePage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const activeAssociation = selected(searchParams?.verband, "all");
  const activeAge = selected(searchParams?.altersklasse, "all");
  const activeMonth = selected(searchParams?.monat, "all");
  const activeLocation = selected(searchParams?.ort, "");
  const activeRadius = Number(selected(searchParams?.radius, "100"));

  const sourceResults = await Promise.all(buildSourceUrls().map(fetchSource));
  const allTournaments = dedupeTournaments(sourceResults.flatMap(parseTournaments));
  const withDistances = enrichDistances(allTournaments, activeLocation);

  const filtered = withDistances
    .filter((item) => activeAssociation === "all" || item.association === activeAssociation)
    .filter((item) => activeAge === "all" || item.ageClasses.includes(activeAge))
    .filter((item) => activeMonth === "all" || item.month === activeMonth)
    .filter((item) => {
      if (!activeLocation) return true;

      const knownDistanceMatch = item.distanceKm !== null && item.distanceKm <= activeRadius;
      const textMatch = item.text.toLowerCase().includes(activeLocation.toLowerCase());

      return knownDistanceMatch || textMatch;
    })
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return a.date.localeCompare(b.date, "de");
    });

  const monthlyCounts = MONTHS_2026
    .filter(([value]) => value !== "all")
    .map(([value, label]) => ({
      value,
      label,
      count: withDistances.filter((item) => item.month === value).length
    }));

  const baseParams = {
    verband: activeAssociation,
    altersklasse: activeAge,
    monat: activeMonth,
    ort: activeLocation,
    radius: String(activeRadius)
  };

  return (
    <main className="container">
      <MainNav />
      <section className="header">
        <div>
          <div className="badge">Turnierfinder</div>
          <h1 className="title">TNB und Westfalen Turniersuche</h1>
          <p className="subtitle">
            Diese Seite lädt aktuelle und kommende Turniere aus den öffentlichen nuLiga Kalendern für Mai bis Dezember 2026. Vergangene Turniere werden automatisch ausgeblendet.
            Du kannst nach Verband, Altersklasse, Monat und Ort filtern. Die Umkreissuche nutzt bekannte Ortskoordinaten,
            zum Beispiel Hameln, Hannover, Bremen, Osnabrück, Bielefeld, Münster oder Dortmund.
          </p>
        </div>

        <div className="card" style={{ padding: 24, minWidth: 280 }}>
          <div className="metricLabel">Datenquellen</div>
          <div className="metricValue" style={{ fontSize: 22 }}>TNB · WTV</div>
          <div style={{ marginTop: 14 }}>
            <a href="/" style={{ fontWeight: 900 }}>Zurück zur App</a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="card">
          <div className="metricLabel">Gefundene Turniere</div>
          <div className="metricValue">{filtered.length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">TNB</div>
          <div className="metricValue">{filtered.filter((item) => item.association === "TNB").length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Westfalen</div>
          <div className="metricValue">{filtered.filter((item) => item.association === "WTV").length}</div>
        </div>
        <div className="card">
          <div className="metricLabel">Monat</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {MONTHS_2026.find(([value]) => value === activeMonth)?.[1] || "Alle Monate"}
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <form action="/turniere" style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(240px, 1fr) 180px 160px auto", alignItems: "end" }}>
          <div>
            <div className="metricLabel" style={{ marginBottom: 8 }}>Ort oder Stadt</div>
            <input
              name="ort"
              defaultValue={activeLocation}
              placeholder="zum Beispiel Hameln"
              style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: "1px solid #dfe9e2", fontSize: 16 }}
            />
          </div>

          <div>
            <div className="metricLabel" style={{ marginBottom: 8 }}>Umkreis</div>
            <select name="radius" defaultValue={String(activeRadius)} style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: "1px solid #dfe9e2", fontSize: 16 }}>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
              <option value="100">100 km</option>
              <option value="150">150 km</option>
              <option value="250">250 km</option>
            </select>
          </div>

          <input type="hidden" name="verband" value={activeAssociation === "all" ? "" : activeAssociation} />
          <input type="hidden" name="altersklasse" value={activeAge === "all" ? "" : activeAge} />
          <input type="hidden" name="monat" value={activeMonth === "all" ? "" : activeMonth} />

          <button className="button" type="submit">Umkreis suchen</button>
        </form>

        <div className="metricLabel" style={{ marginTop: 24, marginBottom: 12 }}>Monat 2026</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          {MONTHS_2026.map(([value, label]) => (
            <a
              key={value}
              className="badge"
              href={hrefFor({ ...baseParams, monat: value })}
              style={{
                textDecoration: "none",
                background: activeMonth === value ? "#245638" : undefined,
                color: activeMonth === value ? "#ffffff" : undefined
              }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="metricLabel" style={{ marginBottom: 12 }}>Verband filtern</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          {[
            ["all", "Alle"],
            ["TNB", "TNB"],
            ["WTV", "Westfalen"]
          ].map(([value, label]) => (
            <a
              key={value}
              className="badge"
              href={hrefFor({ ...baseParams, verband: value })}
              style={{
                textDecoration: "none",
                background: activeAssociation === value ? "#245638" : undefined,
                color: activeAssociation === value ? "#ffffff" : undefined
              }}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="metricLabel" style={{ marginBottom: 12 }}>Altersklasse filtern</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            className="badge"
            href={hrefFor({ ...baseParams, altersklasse: "all" })}
            style={{
              textDecoration: "none",
              background: activeAge === "all" ? "#245638" : undefined,
              color: activeAge === "all" ? "#ffffff" : undefined
            }}
          >
            Alle
          </a>

          {AGE_CLASSES.map((age) => (
            <a
              key={age}
              className="badge"
              href={hrefFor({ ...baseParams, altersklasse: age })}
              style={{
                textDecoration: "none",
                background: activeAge === age ? "#245638" : undefined,
                color: activeAge === age ? "#ffffff" : undefined
              }}
            >
              {age}
            </a>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Monatsübersicht 2026</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {monthlyCounts.map((item) => (
            <a
              key={item.value}
              href={hrefFor({ ...baseParams, monat: item.value })}
              className="card"
              style={{
                padding: 16,
                textDecoration: "none",
                borderColor: activeMonth === item.value ? "#245638" : undefined
              }}
            >
              <div className="metricLabel">{item.label}</div>
              <div className="metricValue" style={{ fontSize: 24 }}>{item.count}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Passende Turniere</h2>

        {filtered.length === 0 ? (
          <p className="subtitle">Für diese Auswahl wurden aktuell keine Turniere gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filtered.slice(0, 120).map((item) => (
              <article
                key={item.id}
                style={{
                  border: "1px solid #dfe9e2",
                  borderRadius: 18,
                  padding: 18,
                  background: "#ffffff",
                  display: "grid",
                  gridTemplateColumns: "130px 1fr auto",
                  gap: 18,
                  alignItems: "center"
                }}
              >
                <div>
                  <strong>{item.date}</strong>
                  <br />
                  <span style={{ color: "#66746c", fontSize: 14 }}>{item.association}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 900 }}>{item.name}</div>
                  <div style={{ color: "#66746c", fontSize: 14, marginTop: 6 }}>
                    {item.ageClasses.join(" · ")}
                  </div>
                  <div style={{ color: "#66746c", fontSize: 13, marginTop: 6 }}>
                    Ort: {item.location}
                    {item.distanceKm !== null ? ` · ca. ${item.distanceKm} km` : ""}
                  </div>
                  <div style={{ color: "#66746c", fontSize: 13, marginTop: 6 }}>
                    Quelle: {item.sourceLabel}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 900 }}>
                    Quelle öffnen
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
