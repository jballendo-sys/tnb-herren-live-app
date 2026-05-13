const SOURCES = [
  {
    association: "TNB",
    label: "Tennisverband Niedersachsen Bremen",
    url: "https://tnb.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/tournamentCalendar?federation=TNB"
  },
  {
    association: "WTV",
    label: "Westfälischer Tennis Verband",
    url: "https://wtv.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/tournamentCalendar?federation=WTV"
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

const MONTHS_2026 = [
  ["all", "Alle Monate"],
  ["01", "Januar 2026"],
  ["02", "Februar 2026"],
  ["03", "März 2026"],
  ["04", "April 2026"],
  ["05", "Mai 2026"],
  ["06", "Juni 2026"],
  ["07", "Juli 2026"],
  ["08", "August 2026"],
  ["09", "September 2026"],
  ["10", "Oktober 2026"],
  ["11", "November 2026"],
  ["12", "Dezember 2026"]
];

type SearchParams = {
  verband?: string;
  altersklasse?: string;
  monat?: string;
};

function selected(value: string | undefined, fallback: string) {
  return value && value.length > 0 ? value : fallback;
}

function sourceHref(verband: string, altersklasse: string, monat: string) {
  const params = new URLSearchParams();

  if (verband !== "all") params.set("verband", verband);
  if (altersklasse !== "all") params.set("altersklasse", altersklasse);
  if (monat !== "all") params.set("monat", monat);

  const query = params.toString();
  return query ? `/turniere?${query}` : "/turniere";
}

async function fetchSource(source: typeof SOURCES[number]) {
  const response = await fetch(source.url, {
    next: { revalidate: 60 * 60 * 6 }
  });

  const html = await response.text();

  return {
    ...source,
    html
  };
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTournamentBlocks(text: string) {
  const datePattern = /(\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.|\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\d{4}\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\d{4})/g;
  const matches = Array.from(text.matchAll(datePattern));

  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index || 0;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    return text.slice(start, end).trim();
  });
}

function extractDate(block: string) {
  const match = block.match(/(\d{2}\.\d{2}\.(?:\d{4})?\s*bis\s*\d{2}\.\d{2}\.(?:\d{4})?|\d{2}\.\d{2}\.\d{4})/);
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

function extractAgeClasses(block: string) {
  return AGE_CLASSES.filter((age) => {
    const pattern = new RegExp(`\\b${age.replace(" ", "\\s+")}\\b`, "i");
    return pattern.test(block);
  });
}

function extractName(block: string) {
  const date = extractDate(block);
  const afterDate = block.replace(date, "").trim();
  const markerIndex = afterDate.search(/\b(Herren|Damen|Junior|Senior|LK|DTB|Veranstalter|Austragungsort)\b/i);
  const candidate = markerIndex > 0 ? afterDate.slice(0, markerIndex).trim() : afterDate.slice(0, 140).trim();

  return candidate || "Turnier";
}

function parseTournaments(source: Awaited<ReturnType<typeof fetchSource>>) {
  const text = stripHtml(source.html);
  const blocks = splitTournamentBlocks(text);

  return blocks
    .map((block, index) => {
      const date = extractDate(block);
      const month = extractMonth(date);
      const year = extractYear(date);
      const ageClasses = extractAgeClasses(block);

      return {
        id: `${source.association}-${index}`,
        association: source.association,
        sourceLabel: source.label,
        name: extractName(block),
        date,
        month,
        year,
        ageClasses,
        text: block,
        url: source.url
      };
    })
    .filter((item) => item.ageClasses.length > 0)
    .filter((item) => item.year === "2026")
    .slice(0, 240);
}

export default async function TurnierePage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const activeAssociation = selected(searchParams?.verband, "all");
  const activeAge = selected(searchParams?.altersklasse, "all");
  const activeMonth = selected(searchParams?.monat, "all");

  const sourceResults = await Promise.all(SOURCES.map(fetchSource));
  const tournaments = sourceResults.flatMap(parseTournaments);

  const filtered = tournaments
    .filter((item) => activeAssociation === "all" || item.association === activeAssociation)
    .filter((item) => activeAge === "all" || item.ageClasses.includes(activeAge))
    .filter((item) => activeMonth === "all" || item.month === activeMonth);

  const monthlyCounts = MONTHS_2026
    .filter(([value]) => value !== "all")
    .map(([value, label]) => ({
      value,
      label,
      count: tournaments.filter((item) => item.month === value).length
    }));

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">Turnierfinder</div>
          <h1 className="title">TNB und Westfalen Turniersuche</h1>
          <p className="subtitle">
            Diese Seite bündelt Turniere aus den öffentlichen nuLiga Turnierkalendern für das Jahr 2026.
            Du kannst nach Verband, Altersklasse und Monat filtern. Die Umkreissuche ergänzen wir im nächsten Schritt.
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
          <div className="metricLabel">Ausgewählter Monat</div>
          <div className="metricValue" style={{ fontSize: 22 }}>
            {MONTHS_2026.find(([value]) => value === activeMonth)?.[1] || "Alle Monate"}
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <div className="metricLabel" style={{ marginBottom: 12 }}>Monat 2026</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          {MONTHS_2026.map(([value, label]) => (
            <a
              key={value}
              className="badge"
              href={sourceHref(activeAssociation, activeAge, value)}
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
              href={sourceHref(value, activeAge, activeMonth)}
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
            href={sourceHref(activeAssociation, "all", activeMonth)}
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
              href={sourceHref(activeAssociation, age, activeMonth)}
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
              href={sourceHref(activeAssociation, activeAge, item.value)}
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
            {filtered.slice(0, 80).map((item) => (
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
