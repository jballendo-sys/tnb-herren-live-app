# TNB Herren Live App

Diese Version nutzt echte öffentliche nuLiga Daten aus dem TNB System.

## Umfang

Die App entdeckt automatisch die TNB Sommer 2026 Gruppen für aktive Herren sowie Herren 30, 40, 50, 55, 60, 65, 70, 75 und 80. Danach ruft sie jede Gruppen Seite ab, extrahiert Tabellen und Begegnungen und macht alle Mannschaften nach Verein, Ortsschätzung, Altersklasse, Liga und Gruppe durchsuchbar.

## Start

```bash
npm install
npm run refresh
npm run dev
```

Dann öffnen:

```bash
http://localhost:3000
```

## Schneller Test

```bash
npm run refresh:quick
npm run dev
```

`refresh:quick` lädt nur die ersten 20 Gruppen. Für alle Herren Gruppen verwende `npm run refresh`.

## Datenquellen

Aktive Herren:
https://tnb.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/leaguePage?championship=TNB+Sommer+2026&tab=2

Herren Altersklassen:
https://tnb.liga.nu/cgi-bin/WebObjects/nuLigaTENDE.woa/wa/leaguePage?championship=TNB+Sommer+2026&tab=3

## Hinweis

Die App nutzt öffentliche nuLiga Seiten. Bitte beachte Nutzungsbedingungen und vermeide zu häufige Abrufe. Für produktiven Betrieb empfehle ich ein Refresh Intervall von 30 bis 60 Minuten.

Die Ortssuche nutzt eine Heuristik aus Vereinsnamen, weil nuLiga auf Gruppen Seiten den Ort nicht immer als separates Feld liefert.
