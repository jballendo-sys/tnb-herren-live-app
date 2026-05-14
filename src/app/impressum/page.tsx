import { MainNav } from "@/components/MainNav";
﻿export default function ImpressumPage() {
  return (
    <main className="container">
      <MainNav />
      <section className="card" style={{ maxWidth: 900, margin: "40px auto" }}>
        <h1 className="title">Impressum</h1>

        <p className="subtitle">
          Angaben gemäß § 5 Digitale Dienste Gesetz.
        </p>

        <h2>Angaben zum Anbieter</h2>
        <p>
          Dr. Jens Ballendowitsch<br />
          Emmerthal<br />
          31860<br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          E Mail: jballendo@googlemail.com
        </p>

        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          Dr. Jens Ballendowitsch<br />
          Emmerthal<br />
          31860<br />
          Deutschland
        </p>

        <h2>Hinweis zur App</h2>
        <p>
          MatchRadar TNB ist eine inoffizielle Auswertung öffentlich zugänglicher nuLiga Daten.
          Die App steht in keiner offiziellen Verbindung zum Tennisverband Niedersachsen Bremen
          oder zu nuLiga. Für die verbindlichen Ergebnisse, Tabellen und Spielberichte sind die
          jeweiligen offiziellen nuLiga Seiten maßgeblich.
        </p>

        <h2>Datenquelle</h2>
        <p>
          Die dargestellten Informationen werden aus öffentlich zugänglichen nuLiga Seiten des TNB
          abgerufen und automatisiert aufbereitet.
        </p>

        <h2>Haftung für Inhalte</h2>
        <p>
          Die Inhalte dieser App wurden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit
          und Aktualität der dargestellten Daten wird keine Gewähr übernommen.
        </p>

        <p style={{ marginTop: 32 }}>
          <a href="/" style={{ fontWeight: 800 }}>Zurück zur App</a>
        </p>
      </section>
    </main>
  );
}
