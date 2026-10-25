# Notenblick

Eine kleine, responsive Web-App zum Erfassen und Auswerten von Schulnoten im Oberstufensystem.

## Starten

1. Im Repository die Datei `index.html` im Browser öffnen.
2. Alternativ mit einem lokalen Webserver:

   ```bash
   python -m http.server 8000
   ```

   Dann im Browser `http://localhost:8000` aufrufen.

## Funktionen

- Fächer anlegen, umbenennen und löschen
- Noten erfassen und bearbeiten
- Gesamtübersicht und Fachdurchschnitte
- Gewichtete Berechnung mit Kursarbeiten- und sonstigen Leistungen
- Zielnoten-Rechner
- Lokale Speicherung im Browser
- JSON-Export und -Import

## Hinweis

Die App speichert Daten nur lokal im Browser und bleibt nach einem Neuladen erhalten.
