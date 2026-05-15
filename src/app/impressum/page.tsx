import { MainNav } from "@/components/MainNav";

export default function ImpressumPage() {
  return (
    <main className="container">
      <MainNav />

      <section className="card" style={{ maxWidth: 900, margin: "40px auto", padding: 32 }}>
        <h1 className="title">Impressum</h1>

        <p className="subtitle">
          Angaben gemäß § 5 Digitale Dienste Gesetz.
        </p>

        <h2>Angaben zum Anbieter</h2>
        <p>
          Dr. Jens Ballendowitsch<br />
          31860 Emmerthal<br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          E Mail: jballendo@googlemail.com
        </p>

        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          Dr. Jens Ballendowitsch<br />
          31860 Emmerthal<br />
          Deutschland
        </p>

        <h2>Hinweis zur App</h2>
        <p>
          Der TNB Herren Kompass ist eine inoffizielle Auswertung öffentlich zugänglicher nuLiga Daten.
          Die App steht in keiner offiziellen Verbindung zum Tennisverband Niedersachsen Bremen, zum
          Westfälischen Tennis Verband, zum Deutschen Tennis Bund, zu nuLiga oder zu einem anderen
          Tennisverband. Für verbindliche Ergebnisse, Tabellen, Spielpläne und Turnierinformationen sind
          ausschließlich die jeweiligen offiziellen Seiten maßgeblich.
        </p>

        <h2>Datenquellen</h2>
        <p>
          Die dargestellten Informationen werden aus öffentlich zugänglichen nuLiga Seiten abgerufen und
          automatisiert aufbereitet. Die Darstellung kann unvollständig, verzögert oder fehlerhaft sein.
        </p>

        <h2>Haftung für Inhalte</h2>
        <p>
          Die Inhalte dieser App wurden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität der dargestellten Daten wird keine Gewähr übernommen.
        </p>

        <h2>Lokale Speicherung</h2>
        <p>
          Die Funktion „Mein Verein“ speichert die ausgewählte Mannschaft ausschließlich lokal im Browser
          des Nutzers. Es erfolgt keine serverseitige Speicherung dieses Favoriten durch den Anbieter.
        </p>

        <p style={{ marginTop: 32 }}>
          <a href="/" style={{ fontWeight: 800 }}>Zurück zur App</a>
        </p>
      </section>
    </main>
  );
}
