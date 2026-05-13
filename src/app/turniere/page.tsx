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

type SearchParams = {
  verband?: string;
  altersklasse?: string;
};

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
}

function selected(value: string | undefined, fallback: string) {
  return value && value.length > 0 ? value : fallback;
}

function sourceHref(verband: string, altersklasse: string) {
  const params = new URLSearchParams();

  if (verband !== "all") params.set("verband", verband);
  if (altersklasse !== "all") params.set("altersklasse", altersklasse);

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
  const datePattern = /(\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.|\d{2}\.\d{2}\.\s*bis\s*\d{2}\.\d{2}\.\d{4}|\d{2}\.\d{2}\.\d{4}\s*bis\s*\d{2}\.\d{2}\.\d{4})/g;
  const matches = Array.from(text.matchAll(datePattern));

  if (matches.length === 0) return [];

  return matches.map((match, index) => {
    const start = match.index || 0;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    return text.slice(start, end).trim();
  });
}

function extractDate(block: string) {
  const match = block.match(/(\d{2}\.\d{2}\.(?:\d{4})?\s*bis\s*\d{2}\.\d{2}\.(?:\d{4})?)/);
  return match ? match[1].replace(/\s+/g, " ") : "Datum offen";
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
      const ageClasses = extractAgeClasses(block);

      return {
        id: `${source.association}-${index}`,
        association: source.association,
        sourceLabel: source.label,
        name: extractName(block),
        date: extractDate(block),
        ageClasses,
        text: block,
        url: source.url
      };
    })
    .filter((item) => item.ageClasses.length > 0)
    .slice(0, 80);
}

export default async function TurnierePage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const activeAssociation = selected(searchParams?.verband, "all");
  const activeAge = selected(searchParams?.altersklasse, "all");

  const sourceResults = await Promise.all(SOURCES.map(fetchSource));
  const tournaments = sourceResults.flatMap(parseTournaments);

  const filtered = tournaments
    .filter((item) => activeAssociation === "all" || item.association === activeAssociation)
    .filter((item) => activeAge === "all" || item.ageClasses.includes(activeAge));

  return (
    <main className="container">
      <section className="header">
        <div>
          <div className="badge">Turnierfinder</div>
          <h1 className="title">TNB und Westfalen Turniersuche</h1>
          <p className="subtitle">
            Diese Seite bündelt Turniere aus den öffentlichen nuLiga Turnierkalendern für TNB und Westfalen.
            In dieser ersten Version kannst du nach Verband und Altersklasse filtern. Die Umkreissuche ergänzen wir als nächsten Schritt.
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
      </section>

      <section className="card" style={{ padding: 22, marginTop: 24 }}>
        <div className="metricLabel" style={{ marginBottom: 12 }}>Verband filtern</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            ["all", "Alle"],
            ["TNB", "TNB"],
            ["WTV", "Westfalen"]
          ].map(([value, label]) => (
            <a
              key={value}
              className="badge"
              href={sourceHref(value, activeAge)}
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
            href={sourceHref(activeAssociation, "all")}
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
              href={sourceHref(activeAssociation, age)}
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
        <h2 style={{ marginTop: 0 }}>Passende Turniere</h2>

        {filtered.length === 0 ? (
          <p className="subtitle">Für diese Auswahl wurden aktuell keine Turniere gefunden.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filtered.slice(0, 40).map((item) => (
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
