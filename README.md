# Obsidian Lean Integration

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/rouvenjahnke/obsidian-lean-integration/release.yml?branch=main)
![License](https://img.shields.io/github/license/rouvenjahnke/obsidian-lean-integration)

Vollständige [Lean 4](https://lean-lang.org/) Integration für [Obsidian](https://obsidian.md) mit Syntax-Highlighting, Language-Server-Anbindung, Goal-Visualisierung und fortschrittlichen Beweisassistenten.

## Features

### Syntax-Highlighting & Fehler-Linting
- Unterstützung für Lean-Codeblöcke mit ```lean im Live-Preview-Modus
- Fehler- und Warnungsvisualisierung im Editor
- CodeMirror-Integration für optimales Highlighting

### Language-Server-Integration
- Vollständige Anbindung an den Lean 4 Language Server
- Code-Vervollständigung mit Typ-Informationen
- Hover-Informationen und Fehlerdiagnostik 
- WebAssembly-Fallback mit umfangreicher Funktionalität

### Beweisassistenz & Goal-Visualisierung
- Seitenpanel mit aktuellen Beweiszielen
- Taktik-Vorschläge basierend auf dem aktuellen Goal
- Ein-Klick-Anwendung von Taktiken
- Interaktive Navigation zu Goal-Positionen im Dokument

### Lean-Interpreter
- Direktes Ausführen von Lean-Code in einem eigenen Panel
- Ausführungshistorie und vordefinierte Beispiele
- Integration mit dem aktuellen Dokument

### Debugging-Unterstützung
- Breakpoints setzen und verwalten
- Schrittweise Programmausführung
- Variablenanzeige und -überwachung
- Debugkonsole für detaillierte Ausgaben

### Lean-Projekt-Integration
- Befehl zum Initialisieren eines neuen Lean-Projekts
- Automatische Einrichtung von Toolchain und Lake-Dateien
- Überwachung und Aktualisierung von Lake-Packages
- Vollständige Mathlib-Integration mit automatischen Updates
- Mathlib-Import-Assistent für bestehende Dateien

## Installation

1. Plugin aus dem Obsidian Community Plugins Browser installieren
2. Plugin in den Obsidian-Einstellungen aktivieren
3. Plugin-Einstellungen konfigurieren (optional)

## Anforderungen

- Obsidian v1.5.0 oder höher
- Für vollständige Funktionalität: Lean 4 (≥ 4.5.0) auf dem System installiert
- Mathlib wird automatisch integriert (WebAssembly-Modus) oder über Lake verwaltet (Nativ-Modus)

## Verwendung

### Syntax-Highlighting

Erstellen Sie einen Codeblock mit dem "lean"-Sprachbezeichner:

```lean
def hello : String := "Hello, Lean!"

theorem simple_example : ∀ p : Prop, p → p := by
  intro p h
  exact h
```

### Goal-Panel & Taktik-Vorschläge

- Öffnen Sie das Lean Goal-Panel über das Ribbon-Icon oder den Befehlspalette
- Ziele werden automatisch aktualisiert, wenn Sie Lean-Code bearbeiten
- Klicken Sie auf ein Ziel, um zu seiner Position im Dokument zu navigieren
- Verwenden Sie vorgeschlagene Taktiken aus dem Taktik-Panel, um bei Beweisen Fortschritte zu erzielen

### Interpreter

- Öffnen Sie den Lean-Interpreter aus der Befehlspalette
- Geben Sie Lean-Code ein und führen Sie ihn aus
- Interaktive Beispiele und Hilfe erleichtern die Arbeit
- Die Ausführungshistorie ermöglicht das Nachverfolgen und Wiederverwenden von Code

### Debugging

- Setzen Sie Breakpoints in Ihrem Lean-Code
- Führen Sie den Code schrittweise aus
- Überwachen Sie Variablen während der Ausführung
- Nutzen Sie die Debug-Konsole für detaillierte Informationen

### Projekt-Initialisierung

- Führen Sie den Befehl "Lean-Projekt initialisieren" aus der Befehlspalette aus
- Für mathlib-Integration nutzen Sie "Lean-Projekt mit Mathlib initialisieren"
- Folgen Sie den Aufforderungen, um eine neue Lean-Projektstruktur zu erstellen
- Führen Sie optional lake init oder lake new aus, um ein Lake-Projekt einzurichten
- Das Plugin überwacht und aktualisiert automatisch Ihre Lake-Pakete und Mathlib

## Einstellungen

- **Lean-Pfad**: Pfad zur Lean-Executable (optional)
- **WebAssembly-Fallback**: Verwenden der WebAssembly-Version, wenn die native Binärdatei nicht verfügbar ist
- **Standard-Toolchain**: Angabe der Lean-Toolchain für neue Projekte
- **Editor-Integration**: Konfiguration der Tiefe der Editor-Integration
- **Automatische Update-Prüfung**: Automatische Überprüfung auf Lake-Paket-Updates
- **Mathlib-Integration**: Ein-/Ausschalten der Mathlib-Unterstützung
- **Mathlib-Updates**: Automatische Prüfung auf Mathlib-Updates

## Entwicklung

### Voraussetzungen

- Node.js
- pnpm

### Setup

```bash
git clone https://github.com/rouvenjahnke/obsidian-lean-integration.git
cd obsidian-lean-integration
pnpm install
```

### Entwicklungs-Workflow

- `pnpm run dev`: Entwicklungsserver mit Hot-Reload starten
- `pnpm run build`: Plugin bauen
- `pnpm run test`: Tests ausführen
- `pnpm run lint`: Linter ausführen
- `pnpm run format`: Code formatieren

## Lizenz

[MIT](LICENSE)