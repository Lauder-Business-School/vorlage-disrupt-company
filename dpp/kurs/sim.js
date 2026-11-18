/* ==========================================================================
   DPP Simulation Lab — Entscheidungssimulation „Mission AlpenVolt“ (kurs/sim.js)
   Legt über die 12 Stationen eine durchgehende Entscheidungssimulation:
   Rollenwahl, 12 Entscheidungsknoten mit Zielkonflikten, verzögerte Folge-
   ereignisse, Live-KPI-HUD, Countdown bis 18.02.2027 und Debrief mit Export.
   Zustand wird deterministisch aus der Entscheidungsfolge neu berechnet.
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "dpp-sim-v1";
  var NODES = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"];
  var START = { c: 20, q: 30, v: 45, b: 480, days: 108 };
  var POS = 0.55; // positive Effekte werden gedämpft, damit Fehler sichtbar bleiben
  var SIM_START_DATE = new Date(2026, 10, 2); // 2. November 2026
  var DEADLINE = "18.02.2027";

  var ROLES = {
    lead: { name: "DPP-Projektleitung", short: "Projektleitung", bonus: {}, perk: "Ausgewogener Start ohne Bonus.",
            secretGoal: "Ganzheitlicher Erfolg: Score >= 75 und kein Folge-Incident.",
            checkSecret: function(k, r) { return score(k) >= 75 && r.events.length === 0; } },
    ceo: { name: "Geschäftsführung", short: "Geschäftsführung", bonus: { b: 60, v: 5 }, perk: "+60 T€ Budget, +5 Vertrauen",
           secretGoal: "Kapitaleffizienz & Markterfolg: Restbudget >= 180 T€ und kein Vertriebsstopp.",
           checkSecret: function(k) { return k.b >= 180 && k.days >= 0 && k.c >= 45; } },
    compliance: { name: "Compliance & Regulatory", short: "Compliance", bonus: { c: 10 }, perk: "+10 Rechtssicherheit",
                  secretGoal: "Makelloses Audit: Rechtssicherheit >= 80 und keine unbestätigten Daten.",
                  checkSecret: function(k, r) { return k.c >= 80 && !r.flags["unverified"] && !r.flags["silent_edit"]; } },
    cto: { name: "IT / CTO", short: "IT / CTO", bonus: { q: 10 }, perk: "+10 Datenqualität",
           secretGoal: "Architektur-Exzellenz: Datenqualität >= 75 und GS1/EN 18222 Standard implementiert.",
           checkSecret: function(k, r) { return k.q >= 75 && !r.flags["lockin"] && !r.flags["proprietary"]; } },
    product: { name: "Produktmanagement", short: "Produkt", bonus: { days: 7, v: 5 }, perk: "+7 Tage Puffer, +5 Vertrauen",
               secretGoal: "Pünktlicher Go-Live: Stichtag gehalten (Tage >= 10) und Vertrauen >= 75.",
               checkSecret: function(k) { return k.days >= 10 && k.v >= 75; } }
  };

  var KPI_LABEL = { c: "Rechtssicherheit", q: "Datenqualität", v: "Vertrauen", b: "Budget", days: "Tage" };

  /* ---------- Szenario-Daten: 12 Entscheidungsknoten ---------- */
  var DATA = {
    s1: {
      title: "Der Vorstandsbeschluss",
      situation: "Montag, 2. November 2026. Der Vorstand der AlpenVolt & Werkraum Gruppe entscheidet heute, wie das DPP-Programm aufgesetzt wird. Drei Batterielinien fallen ab 18.02.2027 unter Art. 77 der Batterieverordnung, die Möbelserie AlpenRegal steht unter ESPR noch ohne delegierten Rechtsakt.",
      voices: [["CFO", "Wir haben CE-Erklärungen als PDF. Ein QR-Code drauf, fertig. Wozu ein Projekt?"], ["Leitung Regulatory", "Ein PDF ist weder maschinenlesbar noch rollenbasiert. Das hält keiner Prüfung stand."]],
      lesson: "Die Batterieverordnung ist ein konkretes Fachgesetz mit festem Anhang XIII und Stichtag. ESPR ist ein Rahmen, dessen Pflichten erst per delegiertem Rechtsakt entstehen.",
      options: {
        a: { title: "QR-Code auf die bestehenden PDFs", desc: "Vorhandene Datenblätter verlinken. Schnell und billig.", t: 3, b: 5, d: { c: -15, q: -10, v: -5 }, tier: "bad", flag: "pdf",
          result: "Kurzfristig gespart, langfristig eine Altlast: Ein PDF erfüllt weder die Zugriffsstufen nach Art. 77 Abs. 2 noch die Maschinenlesbarkeit nach EN 18222/18223.",
          event: { id: "fleet", at: "s3", title: "Großkunde FleetAlp lehnt PDF-Pässe ab", text: "Der Flottenbetreiber FleetAlp (2.400 Fahrzeuge) verlangt maschinenlesbare Pässe per Schnittstelle, sonst ist AlpenVolt aus der Ausschreibung raus.", d: { v: -10 } } },
        b: { title: "DPP-Programm mit Fokus auf die drei Batterielinien", desc: "Team, Budget und Roadmap für EV, Industrie und LMT. Möbel laufen als freiwilliger ESPR-Vorlauf in Phase 2.", t: 10, b: 40, d: { c: 15, q: 5, v: 5 }, tier: "best",
          result: "Richtig priorisiert: zuerst die harte Pflicht ab 18.02.2027, der ESPR-Vorlauf dient als Lernfeld. Das Team hat Mandat und Fokus." },
        c: { title: "Big Bang: alle vier Linien gleichzeitig", desc: "Batterien und Möbel sofort im vollen Umfang ausrollen.", t: 18, b: 90, d: { c: 10, q: 0, v: 5 }, tier: "ok",
          result: "Ambitioniert, aber teuer: Für Möbel gibt es noch keinen delegierten Rechtsakt. Sie bauen auf Annahmen, und die Ressourcen fehlen dann bei den Batterien." }
      }
    },
    s2: {
      title: "Wer ist eigentlich Hersteller?",
      situation: "Der Pedelec-Akku TrailPower wird von einem Partner in Shenzhen gefertigt und unter der Marke AlpenVolt in der EU verkauft. Der Pflichtenfinder fragt nach Ihrer Rolle als Wirtschaftsakteur.",
      voices: [["Einkauf", "Der Zellhersteller produziert. Also soll der auch den Pass liefern."], ["Legal", "Wer unter eigenem Namen oder eigener Marke in Verkehr bringt, gilt als Hersteller."]],
      lesson: "Die Rolle (Hersteller, Importeur, Händler, Bevollmächtigter) bestimmt die Pflichten, nicht der Ort der physischen Fertigung.",
      options: {
        a: { title: "Wir sind nur Händler, der Fertiger ist zuständig", desc: "Die Passpflicht an den Partner in Shenzhen weiterreichen.", t: 1, b: 0, d: { c: -20, v: -10 }, tier: "bad", flag: "role_wrong",
          result: "Fehleinschätzung: Wer ein Produkt unter eigener Marke in Verkehr bringt, gilt als Hersteller und trägt die Passpflicht.",
          event: { id: "role", at: "s4", title: "Marktüberwachung fragt nach dem Verantwortlichen", text: "Eine Stichprobe im Handel ergibt: Für 1.200 TrailPower-Akkus ist kein verantwortlicher Wirtschaftsakteur mit Pass hinterlegt.", d: { c: -10, v: -5 } } },
        b: { title: "Herstellerrolle annehmen, Pflichtenfinder je Linie", desc: "Für jede Produktlinie Kategorie, Stichtag und Granularität klären.", t: 5, b: 10, d: { c: 15, q: 5 }, tier: "best",
          result: "Korrekt: Eigene Marke bedeutet Herstellerrolle. Mit dem Pflichtenfinder klären Sie pro Linie Kategorie, Stichtag und Granularität (Modell, Charge oder Einzelstück)." },
        c: { title: "Bevollmächtigten beauftragen und Haftung abwälzen", desc: "Einen EU-Bevollmächtigten einsetzen und die Verantwortung vertraglich übertragen.", t: 7, b: 30, d: { c: 5 }, tier: "ok",
          result: "Ein Bevollmächtigter kann Aufgaben übernehmen, die Verantwortung als Hersteller bleibt aber bei Ihnen. Hilfreich, aber kein Freibrief." }
      }
    },
    s3: {
      title: "31 leere Pflichtfelder",
      situation: "Die Lückenanalyse für die EV-Batterie zeigt: 71 von 102 Pflichtfeldern sind befüllbar, 31 fehlen. Darunter CO₂-Fußabdruck, Rezyklatanteile und der Sorgfaltspflichtbericht. Die Lieferanten antworten langsam.",
      voices: [["Produktion", "Nehmen wir Branchen-Durchschnittswerte. Merkt doch keiner."], ["Nachhaltigkeit", "Geschätzte Werte müssen als estimated gekennzeichnet sein und reichen für den CO₂-Fußabdruck nicht."]],
      lesson: "211 Katalogfelder aus 522 Rechtszeilen: Die eigentliche Projektarbeit sind Vollständigkeit und Datenherkunft, nicht das Layout.",
      options: {
        a: { title: "Lücken mit Branchen-Durchschnittswerten füllen", desc: "Alle 102 Felder in zwei Tagen grün.", t: 2, b: 0, d: { c: -10, q: -15 }, tier: "bad", flag: "estimated",
          result: "Schnell grün, aber falsch: Branchenwerte ersetzen keine produktspezifischen Daten. Ohne Herkunftskennzeichnung ist das ein Prüfrisiko.",
          event: { id: "estimate", at: "s5", title: "Plausibilitätsprüfung schlägt an", text: "Der CO₂-Wert ist identisch mit dem Branchenmittel von 2023. Der Prüfer verlangt die Berechnungsgrundlage nach Art. 7.", d: { c: -10, v: -5 } } },
        b: { title: "Lieferanten-Datenanfrage mit Frist, Herkunft je Wert", desc: "Strukturierte Datenanfrage an alle Lieferanten; jeder Wert erhält seinen Herkunftsstatus.", t: 14, b: 25, d: { c: 10, q: 15 }, tier: "best",
          result: "Sauber: Jeder Wert erhält seine Herkunft (verified, partner_provided, estimated). Die Lieferanten haben eine klare Frist und ein Datenformat." },
        c: { title: "Nur die öffentlichen Felder befüllen, Rest später", desc: "Was Verbraucher sehen, wird schön. Der Rest folgt nach dem Launch.", t: 4, b: 5, d: { c: -5 }, tier: "ok", flag: "partial",
          result: "Öffentlich sieht der Pass gut aus, aber er ist unvollständig: Die Pflichtfelder der höheren Stufen fehlen weiter, und Gate 1 wird später blockieren." }
      }
    },
    s4: {
      title: "Transparenz oder Geschäftsgeheimnis?",
      situation: "Der Vertrieb will die komplette Stückliste samt Zelllieferanten öffentlich zeigen. Legal will am liebsten alles sperren. Die Batterieverordnung sieht abgestufte Zugriffe für Öffentlichkeit, berechtigte Interessenten und Behörden vor.",
      voices: [["Vertrieb", "Transparenz verkauft. Alles raus!"], ["Legal", "Zelllieferanten und Rezepturen sind Geschäftsgeheimnisse."]],
      lesson: "Wer was sehen darf, ist gesetzlich geregelt. Die Rollenmatrix schützt Geschäftsgeheimnisse und erfüllt zugleich die Informationspflichten.",
      options: {
        a: { title: "Alles öffentlich machen", desc: "Maximale Transparenz als Marketingargument.", t: 2, b: 5, d: { c: -10, v: 5 }, tier: "bad", flag: "leak",
          result: "Gut gemeint, aber gefährlich: Lieferanten, Rezepturen und Prüfberichte gehören nicht in die öffentliche Stufe.",
          event: { id: "leak", at: "s6", title: "Wettbewerber kopiert die Lieferkette", text: "Ein Wettbewerber spricht gezielt Ihre zwei Zelllieferanten an. Die Zellpreise steigen um 6 Prozent.", d: { v: -5 }, b: 30 } },
        b: { title: "4-Stufen-Rollenmatrix mit API-Schlüsseln", desc: "Jede Rolle sieht genau die Felder, die ihr nach Art. 77 Abs. 2 zustehen.", t: 6, b: 20, d: { c: 15, q: 5, v: 5 }, tier: "best",
          result: "Genau richtig: Öffentlichkeit, Werkstätten und Recycler sowie Behörden erhalten jeweils ihre Sicht. Geschäftsgeheimnisse bleiben geschützt." },
        c: { title: "Alles nur für Behörden freigeben", desc: "Sicher ist sicher: alle Felder in die höchste Stufe.", t: 3, b: 5, d: { c: -15, v: -10 }, tier: "bad",
          result: "Überkorrigiert: Werkstätten, Recycler und Verbraucher haben Anspruch auf ihre Felder. Ein gesperrter Pass verletzt Art. 77 ebenso wie ein zu offener." }
      }
    },
    s5: {
      title: "Die KI hat den CO₂-Wert gelesen",
      situation: "Ein KI-Copilot hat den CO₂-Fußabdruck (64,2 kg CO₂e/kWh) aus dem PDF des Zelllieferanten extrahiert. Status: ai_extracted. Die menschliche Bestätigung fehlt, der Vertrieb will heute veröffentlichen.",
      voices: [["Vertrieb", "Die KI liegt zu 98 Prozent richtig. Raus damit."], ["Compliance", "Gate 2 ist fail-closed. Unbestätigte KI-Werte werden nicht signiert."]],
      lesson: "Fail-closed heißt: Im Zweifel wird nicht signiert. KI beschleunigt die Erfassung, die Verantwortung bleibt beim Menschen.",
      options: {
        a: { title: "Ungeprüft veröffentlichen", desc: "Den KI-Wert direkt signieren und registrieren.", t: 0, b: 0, d: { c: -20, q: -10, v: -5 }, tier: "bad", flag: "unverified",
          result: "Riskant: Ein unbestätigter KI-Wert wird rechtsverbindlich signiert. Wenn er falsch ist, haftet AlpenVolt.",
          event: { id: "registry", at: "s7", title: "EU-Register: Datensatz beanstandet", text: "Bei der Registrierung fällt auf, dass der CO₂-Wert keinen bestätigten Herkunftsnachweis hat. Die Registrierung wird ausgesetzt.", d: { c: -10, v: -10 } } },
        b: { title: "Gate 2: menschliche Freigabe, dann signieren", desc: "Eine Fachperson prüft den Wert gegen die Quelle, danach Signatur.", t: 5, b: 10, d: { c: 15, q: 15, v: 5 }, tier: "best",
          result: "Fail-closed wirkt: Der Wert wird gegen die Lieferantenquelle bestätigt und erst dann signiert. Kein Rückruf- und kein Haftungsrisiko." },
        c: { title: "Teilfreigabe: nur Basisdaten, Rest in Quarantäne", desc: "Öffentliche Basisdaten freigeben, den CO₂-Wert zurückhalten.", t: 3, b: 5, d: { c: 5 }, tier: "ok",
          result: "Vertretbarer Zwischenweg: Sie gewinnen Zeit, aber der Pass ist für EV-Batterien ohne CO₂-Wert noch nicht vollständig." }
      }
    },
    s6: {
      title: "Falsche Kapazität im veröffentlichten Pass",
      situation: "Bei 300 Industriespeichern VoltStore steht im veröffentlichten Pass 250 kWh. Nach Nachmessung sind es 245 kWh nutzbare Kapazität. Die Pässe sind signiert und registriert.",
      voices: [["IT-Betrieb", "Ich kann den Wert in der Datenbank einfach überschreiben."], ["Qualitätsmanagement", "Jede Änderung muss nachvollziehbar sein, mit Grund und Vorgängerversion."]],
      lesson: "Pässe sind append-only: Korrigieren heißt neue Version anlegen, niemals überschreiben oder löschen.",
      options: {
        a: { title: "Pässe löschen und neu anlegen", desc: "Sauberer Neustart mit korrektem Wert.", t: 3, b: 10, d: { c: -15, v: -10 }, tier: "bad", flag: "deleted",
          result: "Die Historie ist weg: Kunden mit dem alten QR-Code landen ins Leere, und niemand kann nachvollziehen, was vorher galt." },
        b: { title: "Neue Version mit Änderungsgrund", desc: "Die alte Version bleibt archiviert, die neue verweist auf ihren Hash.", t: 3, b: 5, d: { c: 10, q: 10, v: 10 }, tier: "best",
          result: "Vorbildlich: Die Korrektur ist dokumentiert, die Kette bleibt intakt, und Kunden sehen transparent, was sich geändert hat und warum." },
        c: { title: "Wert still in der Datenbank überschreiben", desc: "Geht in fünf Minuten, niemand merkt es.", t: 1, b: 0, d: { c: -10, q: -5, v: -5 }, tier: "bad", flag: "silent_edit",
          result: "Scheinbar elegant, aber der Hash der signierten Version passt nicht mehr zum Inhalt. Das fällt bei der nächsten Verifikation auf." }
      }
    },
    s7: {
      title: "Der Auditor will Beweise",
      situation: "Ein Auditor des Großkunden fragt: Wie belegen Sie, dass die Werte im Pass seit der Veröffentlichung nicht verändert wurden?",
      voices: [["Controlling", "Wir schicken die Excel-Historie."], ["IT-Security", "Genau dafür gibt es Hash-Kette und Signatur."]],
      lesson: "Kryptografische Beweiskette: Jede Version zeigt per Hash auf ihre Vorgängerin, die Signatur belegt Herkunft und Unverändertheit.",
      options: {
        a: { title: "Screenshots und Excel-Historie vorlegen", desc: "Bewährte Dokumente aus dem Controlling.", t: 2, b: 0, d: { c: -5, v: -10 }, tier: "bad",
          result: "Nicht beweiskräftig: Screenshots und Tabellen lassen sich beliebig nachbearbeiten. Der Auditor bleibt skeptisch." },
        b: { title: "Hash-Kette und Signatur live verifizieren lassen", desc: "Der Auditor prüft selbst über den öffentlichen Verify-Endpunkt.", t: 2, b: 0, d: { c: 10, v: 15 }, tier: "best",
          result: "Überzeugend: Der Auditor verifiziert selbst. Hash-Kette und Signatur sind gültig, ohne dass er Ihnen glauben muss.",
          cond: { flag: "silent_edit", d: { c: -15, v: -20 }, result: "Die Live-Verifikation schlägt fehl: Der Hash der VoltStore-Pässe passt nicht zum signierten Stand. Ihre stille Überschreibung aus Knoten 6 ist aufgeflogen. Das Verfahren war richtig, die Vorgeschichte nicht." } },
        c: { title: "Externes Gutachten beauftragen", desc: "Ein Wirtschaftsprüfer bestätigt die Integrität, Dauer ca. 3 Wochen.", t: 21, b: 40, d: { c: 5, v: 5 }, tier: "ok",
          result: "Belastbar, aber langsam und teuer, für etwas, das die Architektur in Sekunden selbst beweisen könnte." }
      }
    },
    s8: {
      title: "Was kommt auf den QR-Code?",
      situation: "Die Typenschilder gehen nächste Woche in Druck. Drei Vorschläge für den QR-Code liegen auf dem Tisch. Das Etikett muss die gesamte Lebensdauer der Batterie halten.",
      voices: [["Marketing", "Unsere Kampagnen-URL mit Tracking. 84 Zeichen, aber messbar!"], ["IT-Architektur", "GS1 Digital Link auf eigener Domain, unter 50 Zeichen, unabhängig vom Dienstleister."]],
      lesson: "Der Identifier auf dem Produkt muss Jahrzehnte halten: eigene Domain, GS1 Digital Link, kurz und druckstabil.",
      options: {
        a: { title: "Kampagnen-URL mit Tracking-Parametern", desc: "Maximale Messbarkeit für das Marketing.", t: 1, b: 0, d: { c: -10, q: -10 }, tier: "bad", flag: "qr_bad",
          result: "Kurzlebig: Kampagnen-Domains laufen aus, lange URLs ergeben dichte, schlecht lesbare QR-Codes.",
          event: { id: "qr", at: "s10", title: "Kampagnen-Domain abgelaufen", text: "Die Agentur hat die Kampagnen-Domain nicht verlängert: 2.300 gedruckte QR-Codes führen ins Leere.", d: { v: -15 }, b: 40 } },
        b: { title: "GS1 Digital Link auf eigener Domain", desc: "Zum Beispiel id.alpenvolt.eu/01/…/21/…, unter 50 Zeichen.", t: 5, b: 10, d: { c: 10, q: 10, v: 5 }, tier: "best",
          result: "Zukunftssicher: Sie behalten die Hoheit über den Resolver, der Code ist kurz und robust, und das EU-Register kann den Identifier eindeutig zuordnen." },
        c: { title: "Domain des Plattform-Dienstleisters", desc: "Funktioniert sofort, ohne eigene Infrastruktur.", t: 2, b: 0, d: { v: -5 }, tier: "ok", flag: "lockin",
          result: "Funktioniert, aber Sie binden zehn und mehr Jahre Typenschild an einen Anbieter. Ein Wechsel bedeutet neue Etiketten." }
      }
    },
    s9: {
      title: "Der Compliance-Check meldet Befunde",
      situation: "Zwei Wochen vor dem Rollout: 3 × Typ A FAIL (fehlende Pflichtwerte), 9 × Typ B FAIL (Einheiten- und Formatfehler), 4 × Typ C INDETERMINATE (Konformitätserklärung und CO₂-Studie brauchen eine menschliche bzw. benannte Prüfung).",
      voices: [["Projektleitung", "Typ C ist doch gelb, nicht rot. Einfach als bestanden markieren."], ["Qualität", "INDETERMINATE heißt: Software kann das nicht entscheiden. Das ist kein grüner Haken."]],
      lesson: "Typ A und B sind deterministisch prüfbar und blockieren. Typ C ist bewusst INDETERMINATE: Hier entscheidet der Mensch bzw. die Benannte Stelle.",
      options: {
        a: { title: "Typ C als bestanden markieren, A und B nach dem Launch", desc: "Termin halten, Befunde später abarbeiten.", t: 1, b: 0, d: { c: -20, q: -10 }, tier: "bad", flag: "findings_ignored",
          result: "Gefährlich: Sie täuschen eine Konformitätsbewertung vor, die keine Software leisten darf, und gehen mit fehlenden Pflichtwerten in den Markt.",
          event: { id: "customs", at: "s11", title: "Zoll hält 400 Speicher fest", text: "Bei der Einfuhrkontrolle fehlen Pflichtwerte (Typ A). 400 VoltStore-Speicher stehen im Hafen Koper.", d: { c: -10, v: -10 }, b: 60, t: 10 } },
        b: { title: "A und B beheben, C an Benannte Stelle und Legal", desc: "Deterministische Fehler sofort fixen, Urkundenprüfung an Menschen übergeben.", t: 8, b: 15, d: { c: 15, q: 10, v: 5 }, tier: "best",
          result: "Professionell: Die Maschine erledigt, was sie prüfen kann, und Menschen übernehmen, was nur sie verantworten dürfen." },
        c: { title: "Alles manuell durch externe Berater prüfen lassen", desc: "Jeder Befund wird von Hand gegengeprüft, Dauer ca. 4 Wochen.", t: 25, b: 50, d: { c: 10, q: 10 }, tier: "ok",
          result: "Gründlich, aber Sie verbrennen Zeit und Budget für Prüfungen, die Typ A und B in Sekunden automatisiert erledigen." }
      }
    },
    s10: {
      title: "Der Großkunde will eine Schnittstelle",
      situation: "FleetAlp will täglich 4.000 Pässe abfragen, jeweils mit dem Stand zum Kaufdatum für Garantiefälle.",
      voices: [["Vertrieb", "Ein monatlicher CSV-Export reicht doch."], ["Architektur", "EN 18222 definiert genau diese API, inklusive Abfrage zu einem Stichtag."]],
      lesson: "Standard-API nach EN 18222 statt Eigenbau: Kunden, Behörden und Recycler greifen ohne Sonderlösung zu, inklusive Zeitreise.",
      options: {
        a: { title: "Monatlicher CSV-Export per E-Mail", desc: "Einfach, ohne IT-Aufwand.", t: 2, b: 5, d: { q: -5, v: -10 }, tier: "bad",
          result: "Veraltet ab dem Versand: Der Kunde arbeitet mit Daten von gestern, und der Stand zum Kaufdatum fehlt." },
        b: { title: "EN-18222-REST-API mit Stichtagsabfrage", desc: "Standardisierte Endpunkte inklusive dppsByIdAndDate und JSON-LD.", t: 6, b: 20, d: { c: 5, q: 10, v: 15 }, tier: "best",
          result: "Ideal: FleetAlp bindet sich über den Standard an, und Garantiefälle lassen sich exakt auf den damaligen Passstand zurückführen." },
        c: { title: "Eigene proprietäre API entwickeln", desc: "Maßgeschneidert für FleetAlp.", t: 20, b: 60, d: { q: 5 }, tier: "ok", flag: "proprietary",
          result: "Teuer und isoliert: Jeder weitere Kunde braucht wieder eine Sonderlösung, und Behörden erwarten den Standard." }
      }
    },
    s11: {
      title: "Wie kommen 14.000 Seriennummern in den Pass?",
      situation: "Pro Monat entstehen 14.000 neue Batterie-Seriennummern in SAP S/4HANA, dazu drei Möbelvarianten. Drei Integrationswege stehen zur Wahl.",
      voices: [["Fachbereich", "Wir tippen das im Studio ab. Geht schon."], ["IT", "Bei diesem Volumen geht es nur per ERP-Push."]],
      lesson: "Das Volumen bestimmt den Weg: ERP-Push für Serienprodukte, Studio für Kleinserien, MCP als Assistenz und nicht als Autopilot.",
      options: {
        a: { title: "Alles manuell im Passport Studio", desc: "Kein Integrationsprojekt nötig.", t: 10, b: 5, d: { c: -5, q: -10 }, tier: "bad", flag: "manual",
          result: "Bei 14.000 Datensätzen im Monat entstehen zwangsläufig Tippfehler und Rückstau." },
        b: { title: "ERP-Push für Batterien, Studio für Möbel", desc: "POST /api/v1/ingest/passports aus SAP, Kleinserien im Studio.", t: 10, b: 35, d: { c: 5, q: 15, v: 5 }, tier: "best",
          result: "Passend skaliert: Seriendaten fließen automatisch und nachvollziehbar, Kleinserien bleiben schlank im Studio." },
        c: { title: "KI-Agent über MCP schreibt Pässe autonom", desc: "Ein Agent liest SAP und füllt die Pässe selbstständig.", t: 4, b: 15, d: { c: -15, q: -10 }, tier: "bad", flag: "ai_autonomous",
          result: "Überzogen: MCP-Tools helfen beim Onboarding und bei Abfragen. Ein Agent, der ohne Freigabe Pässe schreibt, umgeht Gate 2." }
      }
    },
    s12: {
      title: "Go oder No-Go im Vorstand",
      situation: "Finale Vorstandssitzung. Die Batteriepässe sind bereit. Offen sind noch der delegierte Rechtsakt für Möbel und die Validierung der CO₂-Studie durch eine Benannte Stelle.",
      voices: [["Marketing", "Wir launchen mit dem Claim ‚vollständig EU-zertifizierter Produktpass‘!"], ["Regulatory", "Wir kommunizieren ehrlich, was fertig ist und was nicht."]],
      lesson: "Ehrlich benannte Grenzen sind ein Vertrauensvorteil, kein Eingeständnis von Schwäche.",
      options: {
        a: { title: "Go-Live mit Claim ‚vollständig EU-zertifiziert‘", desc: "Maximale Wirkung in der Kommunikation.", t: 2, b: 10, d: { c: -10, v: -15 }, tier: "bad", flag: "overclaim",
          result: "Irreführend: Eine Zertifizierung des gesamten Passes gibt es so nicht, und die CO₂-Validierung ist offen. Das ist ein Greenwashing-Risiko." },
        b: { title: "Go-Live Batterien und ehrliche Kommunikation", desc: "Launch der Pflichtlinien, offene Punkte transparent benennen, Benannte Stelle buchen.", t: 5, b: 25, d: { c: 10, v: 15 }, tier: "best",
          result: "Souverän: Die Pflicht ist erfüllt, die offenen Punkte sind terminiert, und Kunden wie Behörden erleben Sie als verlässlich." },
        c: { title: "Launch verschieben, bis alle Rechtsakte final sind", desc: "Erst wenn wirklich alles feststeht.", t: 60, b: 20, d: { v: -10 }, tier: "bad",
          result: "Vorsicht wird zum Risiko: Die Pflicht nach der Batterieverordnung gilt ab 18.02.2027, unabhängig vom Möbel-Rechtsakt. Ohne Pass kein Inverkehrbringen." }
      }
    }
  };

  var TIER = {
    best: { label: "Starke Entscheidung", cls: "best", icon: "✓" },
    ok: { label: "Vertretbar, mit Preis", cls: "ok", icon: "◐" },
    bad: { label: "Riskante Entscheidung", cls: "bad", icon: "✕" }
  };

  /* ---------- Zustand ---------- */
  var st = { role: null, order: [], picks: {}, reasons: {}, difficulty: "standard" };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && typeof p === "object") {
        st.role = ROLES[p.role] ? p.role : null;
        st.order = Array.isArray(p.order) ? p.order.filter(function (n) { return DATA[n]; }) : [];
        st.picks = p.picks || {}; st.reasons = p.reasons || {}; st.difficulty = p.difficulty || "standard";
      }
    }
  } catch (e) { /* ignore */ }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function num(n) { return n.toLocaleString("de-DE"); }

  /* Deterministische Neuberechnung aus Rolle + Entscheidungsfolge */
  function replay(order, picks, role) {
    var k = { c: START.c, q: START.q, v: START.v, b: START.b, days: START.days };
    var bonus = (ROLES[role] || ROLES.lead).bonus;
    Object.keys(bonus).forEach(function (key) { k[key] += bonus[key]; });
    var flags = {}, steps = [], events = [];
    order.forEach(function (nid) {
      var node = DATA[nid];
      var opt = node && node.options[picks[nid]];
      if (!opt) return;
      var before = { c: k.c, q: k.q, v: k.v, b: k.b, days: k.days };
      var d = opt.d, result = opt.result, conditional = false;
      if (opt.cond && flags[opt.cond.flag]) { d = opt.cond.d; result = opt.cond.result; conditional = true; }
      ["c", "q", "v"].forEach(function (key) {
        var x = d[key] || 0;
        k[key] = clamp(k[key] + (x > 0 ? Math.round(x * POS) : x), 0, 100);
      });
      k.b -= opt.b || 0;
      k.days -= opt.t || 0;
      if (opt.flag) flags[opt.flag] = true;
      var ev = null;
      if (opt.event) {
        ev = opt.event;
        ["c", "q", "v"].forEach(function (key) { k[key] = clamp(k[key] + (ev.d[key] || 0), 0, 100); });
        k.b -= ev.b || 0;
        k.days -= ev.t || 0;
        events.push({ id: ev.id, from: nid, at: ev.at, title: ev.title, text: ev.text, d: ev.d, b: ev.b || 0, t: ev.t || 0 });
      }
      steps.push({
        node: nid, pick: picks[nid], tier: opt.tier, result: result, conditional: conditional,
        delta: { c: k.c - before.c, q: k.q - before.q, v: k.v - before.v, b: k.b - before.b, days: k.days - before.days }
      });
    });
    return { k: k, flags: flags, steps: steps, events: events };
  }

  function bestPath() {
    var picks = {};
    NODES.forEach(function (n) {
      Object.keys(DATA[n].options).forEach(function (o) { if (DATA[n].options[o].tier === "best") picks[n] = o; });
    });
    return replay(NODES.slice(), picks, st.role || "lead");
  }

  function score(k) {
    var budgetScore = clamp(k.b / START.b * 100, 0, 100);
    var s = 0.35 * k.c + 0.25 * k.q + 0.25 * k.v + 0.15 * budgetScore;
    if (k.days < 0) s -= 15;
    if (k.b < 0) s -= 10;
    return Math.round(clamp(s, 0, 100));
  }

  function ending(k) {
    if (k.days < 0) return { cls: "late", title: "Stichtag verpasst", text: "AlpenVolt erreicht den 18.02.2027 nicht rechtzeitig mit vollständigen Pässen. Die betroffenen Batterien dürfen bis zur Nachbesserung nicht in Verkehr gebracht werden; FleetAlp vergibt den Auftrag an einen Wettbewerber." };
    if (k.c < 45) return { cls: "stop", title: "Vertriebsstopp durch die Marktüberwachung", text: "Pünktlich, aber nicht belastbar: Die Marktüberwachung beanstandet Pflichtverstöße, Teile der Ware werden gestoppt. Der Imageschaden ist größer als die eingesparte Zeit." };
    var s = score(k);
    if (s >= 75) return { cls: "win", title: "Markteintritt mit Wettbewerbsvorteil", text: "AlpenVolt geht rechtssicher, pünktlich und glaubwürdig in den Markt. FleetAlp unterschreibt den Rahmenvertrag, und der DPP wird zum Verkaufsargument." };
    return { cls: "ok", title: "Knapp geschafft", text: "Die Pflicht ist erfüllt, aber mit Reibungsverlusten: Nachbesserungen, Mehrkosten und skeptische Kunden begleiten die ersten Monate nach dem Stichtag." };
  }

  function archetype(steps, k) {
    var best = 0, bad = 0, ok = 0;
    steps.forEach(function (s) { if (s.tier === "best") best++; else if (s.tier === "bad") bad++; else ok++; });
    var used = START.days + ((ROLES[st.role] || ROLES.lead).bonus.days || 0) - k.days;
    if (best >= 10) return { name: "Compliance-Architekt:in", text: "Sie verbinden Rechtssicherheit, Datenqualität und Tempo. Ihre Entscheidungen halten Prüfungen stand, ohne das Projekt auszubremsen." };
    if (bad >= 4 && used < 75) return { name: "Risiko-Sprinter:in", text: "Sie entscheiden schnell und kostenbewusst, nehmen dafür aber regulatorische Risiken in Kauf, die später teuer zurückkommen." };
    if (ok >= 4 || used > 110) return { name: "Gründliche:r Perfektionist:in", text: "Sie wollen auf Nummer sicher gehen und investieren viel Zeit und Budget. Wirkungsvoller wäre es, Prüfaufwand gezielt dort einzusetzen, wo Software nicht entscheiden kann." };
    return { name: "Pragmatiker:in", text: "Sie treffen überwiegend solide Entscheidungen, lassen sich aber an einzelnen Knoten von Zeit- oder Vertriebsdruck verleiten." };
  }

  function simDate(daysLeft) {
    var base = START.days + ((ROLES[st.role] || ROLES.lead).bonus.days || 0);
    var d = new Date(SIM_START_DATE.getTime());
    d.setDate(d.getDate() + (base - daysLeft));
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function deltaChips(delta) {
    var out = [];
    [["c", ""], ["q", ""], ["v", ""]].forEach(function (pair) {
      var x = delta[pair[0]];
      if (x) out.push('<span class="sim-chip ' + (x > 0 ? "up" : "down") + '">' + KPI_LABEL[pair[0]] + " " + (x > 0 ? "+" : "") + x + "</span>");
    });
    if (delta.b) out.push('<span class="sim-chip ' + (delta.b > 0 ? "up" : "down") + '">Budget ' + (delta.b > 0 ? "+" : "") + delta.b + " T€</span>");
    if (delta.days) out.push('<span class="sim-chip time">' + Math.abs(delta.days) + " Tage verbraucht</span>");
    return out.join("");
  }

  /* ---------- HUD (schwebendes Cockpit) ---------- */
  var hud;
  function renderHud(flash) {
    var r = replay(st.order, st.picks, st.role);
    var k = r.k;
    var active = st.order.length > 0 || st.role;
    if (!hud) {
      hud = document.createElement("aside");
      hud.className = "sim-hud";
      hud.id = "sim-hud";
      hud.setAttribute("aria-label", "Simulations-Cockpit Mission AlpenVolt");
      document.body.appendChild(hud);
      hud.addEventListener("click", function (e) {
        if (e.target.closest("[data-hud-toggle]")) {
          hud.classList.toggle("collapsed");
          try { localStorage.setItem(KEY + "-hud", hud.classList.contains("collapsed") ? "1" : "0"); } catch (err) { /* ignore */ }
        }
      });
      try { if (localStorage.getItem(KEY + "-hud") === "1") hud.classList.add("collapsed"); } catch (err) { /* ignore */ }
    }
    hud.hidden = !active;
    if (!active) return;
    function bar(key) {
      var val = k[key];
      var tone = val >= 70 ? "hi" : val >= 45 ? "mid" : "lo";
      return '<div class="sim-hud-kpi"><span>' + KPI_LABEL[key] + "</span><b>" + val + '</b><i class="' + tone + '" style="width:' + val + '%"></i></div>';
    }
    var daysTone = k.days < 0 ? "lo" : k.days < 20 ? "mid" : "hi";
    hud.innerHTML =
      '<button type="button" class="sim-hud-head" data-hud-toggle aria-label="Cockpit ein- oder ausklappen">' +
        '<span class="sim-dot"></span><span>Mission AlpenVolt</span><span class="sim-hud-count">' + st.order.length + "/12</span><span class=\"sim-hud-caret\" aria-hidden=\"true\">▾</span></button>" +
      '<div class="sim-hud-body">' +
        '<div class="sim-hud-clock ' + daysTone + '"><b>' + (k.days < 0 ? "+" + Math.abs(k.days) + " Tage Verzug" : "T-" + k.days + " Tage") + "</b><span>bis " + DEADLINE + " · Sim-Datum " + simDate(k.days) + "</span></div>" +
        bar("c") + bar("q") + bar("v") +
        '<div class="sim-hud-budget ' + (k.b < 0 ? "lo" : "") + '"><span>Budget</span><b>' + num(k.b) + " T€</b></div>" +
        '<a class="sim-hud-link" href="#debrief">Zwischenstand &amp; Debrief →</a>' +
      "</div>";
    if (flash) {
      hud.classList.remove("flash");
      void hud.offsetWidth;
      hud.classList.add("flash");
    }
  }

  function toast(html, tone) {
    var t = document.createElement("div");
    t.className = "sim-toast " + (tone || "");
    t.setAttribute("role", "status");
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3800);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4400);
  }

  /* ---------- Entscheidungsknoten in jeder Station ---------- */
  function renderNode(nid) {
    var host = $('[data-sim-node="' + nid + '"]');
    if (!host) {
      var section = $('section[data-view="' + nid + '"]');
      if (!section) return;
      var next = $(".next", section);
      host = document.createElement("section");
      host.className = "sim-node";
      host.setAttribute("data-sim-node", nid);
      host.setAttribute("aria-label", "Entscheidungsknoten " + nid.slice(1));
      if (next) next.parentNode.insertBefore(host, next);
      else $(".wrap", section).appendChild(host);
      host.addEventListener("click", onNodeClick);
    }
    var node = DATA[nid];
    var idx = NODES.indexOf(nid) + 1;
    var r = replay(st.order, st.picks, st.role);
    var picked = st.picks[nid];
    var step = r.steps.filter(function (s) { return s.node === nid; })[0];
    var incoming = r.events.filter(function (e) { return e.at === nid; });
    host.className = incoming.length ? "sim-node has-alert" : "sim-node";

    var h = "";
    if (incoming.length) {
      h += '<div class="sim-alarm-bar" role="alert"><span class="sim-alarm-bar-left"><span class="sim-alarm-dot" aria-hidden="true"></span><span>Alarm-Modus · Folgeereignis aktiv</span></span><span>Sofortige Gegensteuerung</span></div>';
    }
    h += '<span class="sim-node-watermark" aria-hidden="true">' + (idx < 10 ? "0" : "") + idx + "</span>";
    h += '<header class="sim-node-head"><div><span class="sim-kicker">✦ Entscheidungsknoten ' + (idx < 10 ? "0" : "") + idx + "/12 · Mission AlpenVolt</span>" +
      "<h2>" + esc(node.title) + "</h2></div>" +
      '<span class="sim-pill">' + (r.k.days < 0 ? "Stichtag überschritten" : "T-" + r.k.days + " Tage") + "</span></header>";

    incoming.forEach(function (e) {
      h += '<div class="sim-event" role="alert"><span class="sim-event-k">⚠ Folgeereignis aus Knoten ' + e.from.slice(1) + "</span><b>" + esc(e.title) + "</b><p>" + esc(e.text) + '</p><div class="sim-chips">' +
        deltaChips({ c: e.d.c || 0, q: e.d.q || 0, v: e.d.v || 0, b: -e.b, days: -e.t }) + "</div></div>";
    });

    h += '<p class="sim-situation">' + esc(node.situation) + "</p>";
    h += '<div class="sim-voices">' + node.voices.map(function (vc) {
      return '<blockquote><span>' + esc(vc[0]) + "</span>„" + esc(vc[1]) + "“</blockquote>";
    }).join("") + "</div>";

    h += '<div class="sim-options" role="group" aria-label="Entscheidung wählen">';
    Object.keys(node.options).forEach(function (oid) {
      var o = node.options[oid];
      var cls = "sim-opt";
      if (picked) cls += oid === picked ? " picked tier-" + o.tier : " dim";
      h += '<button type="button" class="' + cls + '" data-sim-pick="' + oid + '"' + (picked ? " disabled" : "") + ' aria-pressed="' + (oid === picked) + '">' +
        '<span class="sim-opt-letter">' + oid.toUpperCase() + "</span>" +
        "<strong>" + esc(o.title) + "</strong><small>" + esc(o.desc) + "</small>" +
        '<span class="sim-opt-cost"><span>⏱ ' + (o.t ? o.t + " Tage" : "sofort") + "</span><span>€ " + (o.b ? o.b + " T€" : "keine Kosten") + "</span></span>" +
        (picked && picked !== oid ? '<span class="sim-opt-tier tier-' + o.tier + '">' + TIER[o.tier].icon + " " + TIER[o.tier].label + "</span>" : "") +
        "</button>";
    });
    h += "</div>";

    if (step) {
      var tier = TIER[step.tier];
      var shown = step.conditional ? "bad" : step.tier;
      h += '<div class="sim-result tier-' + shown + '" aria-live="polite">' +
        '<span class="sim-verdict">' + TIER[shown].icon + " " + (step.conditional ? "Richtiges Verfahren, aber die Vorgeschichte holt Sie ein" : tier.label) + "</span>" +
        "<p>" + esc(step.result) + "</p>" +
        '<div class="sim-chips">' + deltaChips(step.delta) + "</div>" +
        (DATA[nid].options[picked].event ? '<p class="sim-foreshadow">⏳ Diese Entscheidung hat eine Folgewirkung, die Sie in Knoten ' + DATA[nid].options[picked].event.at.slice(1) + " erreicht.</p>" : "") +
        '<div class="sim-reason-box"><label for="sim-reason-' + nid + '"><span>✦ Ihre Begründung (für Debrief & Team-Reflexion):</span></label>' +
        '<input type="text" id="sim-reason-' + nid + '" class="sim-reason-input" data-sim-reason="' + nid + '" placeholder="z. B. Schnelligkeit war hier wichtiger als externe Validierung..." value="' + esc(st.reasons[nid] || '') + '"></div>' +
        '<div class="sim-lesson"><span>Was diese Station lehrt</span>' + esc(node.lesson) + "</div>" +
        '<div class="sim-result-actions">' +
          (idx < 12 ? '<a class="btn sm" href="#' + NODES[idx] + '">Weiter zu Knoten ' + (idx + 1) + " →</a>" : '<a class="btn sm" href="#debrief">Zum Debrief →</a>') +
          '<button type="button" class="btn sm ghost" data-sim-undo>Entscheidung zurücknehmen</button>' +
        "</div></div>";
    } else {
      h += '<p class="sim-hint">Tipp: Lesen Sie die Station und lösen Sie die Übung, bevor Sie entscheiden. Kosten und Zeit sind bekannt, die Folgen nicht.</p>';
    }
    host.innerHTML = h;
  }

  function onNodeClick(e) {
    var host = e.currentTarget;
    var nid = host.getAttribute("data-sim-node");
    var pickBtn = e.target.closest("[data-sim-pick]");
    if (pickBtn && !st.picks[nid]) {
      if (!st.role) st.role = "lead";
      st.picks[nid] = pickBtn.getAttribute("data-sim-pick");
      st.order = st.order.filter(function (n) { return n !== nid; }).concat([nid]);
      save();
      var r = replay(st.order, st.picks, st.role);
      var step = r.steps[r.steps.length - 1];
      var tone = step.conditional ? "bad" : step.tier;
      toast("<b>" + TIER[tone].icon + " Knoten " + nid.slice(1) + ": " + TIER[tone].label + "</b><div class=\"sim-chips\">" + deltaChips(step.delta) + "</div>", tone);
      refreshAll(true);
      var res = $(".sim-result", host);
      if (res) res.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (e.target.closest("[data-sim-undo]")) {
      var pos = st.order.indexOf(nid);
      var later = st.order.slice(pos + 1);
      if (later.length && !window.confirm("Wenn Sie diese Entscheidung zurücknehmen, werden auch die " + later.length + " späteren Entscheidungen zurückgesetzt, weil Folgeereignisse davon abhängen können. Fortfahren?")) return;
      st.order.slice(pos).forEach(function (n) { delete st.picks[n]; });
      st.order = st.order.slice(0, pos);
      save();
      refreshAll(false);
    }
  }

  /* ---------- Missions-Briefing auf der Startseite ---------- */
  function renderMission() {
    var host = $("#sim-mission");
    if (!host) return;
    var r = replay(st.order, st.picks, st.role);
    var started = st.order.length > 0;
    var nextNode = NODES.filter(function (n) { return !st.picks[n]; })[0];
    var roleKey = st.role || "lead";

    var h = '<div class="sim-mission-grid"><div class="sim-mission-story">' +
      '<span class="sim-kicker">✦ Mission AlpenVolt · Entscheidungssimulation</span>' +
      "<h2>108 Tage. 480.000 €. 12 Entscheidungen.</h2>" +
      "<p>Es ist der <b>2. November 2026</b>. Sie übernehmen die DPP-Verantwortung bei der <b>AlpenVolt &amp; Werkraum Gruppe</b>. Bis zum Stichtag <b>18.02.2027</b> müssen drei Batterielinien einen rechtskonformen Produktpass haben. In jeder Station wartet ein Dilemma mit echten Zielkonflikten: Vertrieb gegen Compliance, Tempo gegen Datenqualität, Transparenz gegen Geschäftsgeheimnis.</p>" +
      '<ul class="sim-rules"><li><b>Kosten und Zeit</b> jeder Option sind bekannt, die <b>Folgen</b> nicht.</li><li>Manche Entscheidungen lösen <b>Folgeereignisse</b> aus, die Sie Stationen später einholen.</li><li>Am Ende steht ein <b>Debrief</b> mit Szenario-Ausgang, Profil, Bestpfad-Vergleich und Export.</li></ul>' +
      "</div>" +
      '<div class="sim-mission-panel"><span class="sim-panel-k">' + (started ? "Ihre Rolle" : "1 · Wählen Sie Ihre Rolle") + "</span>" +
      '<div class="sim-roles" role="radiogroup" aria-label="Rolle wählen">';
    Object.keys(ROLES).forEach(function (rk) {
      var ro = ROLES[rk];
      h += '<button type="button" role="radio" class="sim-role' + (rk === roleKey ? " active" : "") + '" data-sim-role="' + rk + '" aria-checked="' + (rk === roleKey) + '"' + (started ? " disabled" : "") + ">" +
        "<b>" + esc(ro.name) + "</b><small>" + esc(ro.perk) + "</small></button>";
    });
    h += "</div>";
    h += '<div class="sim-track" aria-label="Fortschritt der Entscheidungen">' + NODES.map(function (n, i) {
      var s = r.steps.filter(function (x) { return x.node === n; })[0];
      var cls = s ? "tier-" + (s.conditional ? "bad" : s.tier) : (n === nextNode ? "next" : "");
      return '<a href="#' + n + '" class="' + cls + '" title="Knoten ' + (i + 1) + ": " + esc(DATA[n].title) + '">' + (i + 1) + "</a>";
    }).join("") + "</div>";
    h += '<div class="sim-mission-kpis">' +
      '<div><span>Rechtssicherheit</span><b>' + r.k.c + "</b></div>" +
      '<div><span>Datenqualität</span><b>' + r.k.q + "</b></div>" +
      '<div><span>Vertrauen</span><b>' + r.k.v + "</b></div>" +
      '<div><span>Budget</span><b>' + num(r.k.b) + " T€</b></div>" +
      '<div><span>Zeit</span><b>' + (r.k.days < 0 ? "+" + Math.abs(r.k.days) + " Verzug" : "T-" + r.k.days) + "</b></div></div>";
    h += '<div class="sim-mission-actions">' +
      (nextNode ? '<a class="btn" href="#' + nextNode + '">' + (started ? "Weiter mit Knoten " + nextNode.slice(1) : "Mission starten: Knoten 1") + " →</a>" : '<a class="btn" href="#debrief">Mission abgeschlossen: Zum Debrief →</a>') +
      (started ? '<a class="btn ghost" href="#debrief">Zwischenstand</a><button type="button" class="btn ghost" data-sim-reset>Neu starten</button>' : "") +
      "</div></div></div>";
    host.innerHTML = h;
  }

  /* ---------- Debrief ---------- */
  function radar(k, best) {
    var axes = [
      ["Rechtssicherheit", k.c, best.c],
      ["Datenqualität", k.q, best.q],
      ["Vertrauen", k.v, best.v],
      ["Budget", clamp(k.b / START.b * 100, 0, 100), clamp(best.b / START.b * 100, 0, 100)],
      ["Zeitpuffer", clamp(k.days / 40 * 100, 0, 100), clamp(best.days / 40 * 100, 0, 100)]
    ];
    var cx = 170, cy = 150, R = 110, n = axes.length;
    function pt(i, val) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * R * val / 100, cy + Math.sin(a) * R * val / 100];
    }
    var grid = "";
    [25, 50, 75, 100].forEach(function (g) {
      grid += '<polygon points="' + axes.map(function (_, i) { return pt(i, g).join(","); }).join(" ") + '" class="rg"/>';
    });
    var spokes = axes.map(function (ax, i) {
      var e = pt(i, 100), l = pt(i, 122);
      return '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '" class="rs"/>' +
        '<text x="' + l[0] + '" y="' + l[1] + '" text-anchor="middle" dominant-baseline="middle">' + ax[0] + "</text>";
    }).join("");
    var bestPoly = '<polygon class="rb" points="' + axes.map(function (ax, i) { return pt(i, ax[2]).join(","); }).join(" ") + '"/>';
    var youPoly = '<polygon class="ry" points="' + axes.map(function (ax, i) { return pt(i, ax[1]).join(","); }).join(" ") + '"/>';
    var dots = axes.map(function (ax, i) { var p = pt(i, ax[1]); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" class="rd"/>'; }).join("");
    return '<svg viewBox="0 0 340 300" class="sim-radar" role="img" aria-label="Netzdiagramm Ihrer Ergebnisse im Vergleich zum Bestpfad">' + grid + spokes + bestPoly + youPoly + dots + "</svg>";
  }

  function renderDebrief() {
    var certScoreEl = document.getElementById('cert-score-display');
    if (certScoreEl) {
      var curR = replay(st.order, st.picks, st.role);
      certScoreEl.textContent = score(curR.k) + ' / 100';
    }
    var host = $("#sim-debrief");
    if (!host) return;
    var r = replay(st.order, st.picks, st.role);
    var bp = bestPath();
    var done = r.steps.length;
    if (!done) {
      host.innerHTML = '<div class="sim-empty"><span class="sim-kicker">✦ Debrief</span><h2>Noch keine Entscheidungen getroffen</h2><p>Starten Sie die Mission auf der Startseite oder springen Sie direkt in den ersten Entscheidungsknoten.</p><a class="btn" href="#s1">Mission starten: Knoten 1 →</a></div>';
      return;
    }
    var complete = done === 12;
    var sc = score(r.k), bsc = score(bp.k);
    var end = complete ? ending(r.k) : { cls: "open", title: "Zwischenstand nach " + done + " von 12 Entscheidungen", text: "Der Szenario-Ausgang wird berechnet, sobald alle zwölf Knoten entschieden sind." };
    var arch = archetype(r.steps, r.k);
    var rank = sc >= 85 ? "A · Benchmark" : sc >= 75 ? "B · Souverän" : sc >= 60 ? "C · Ausbaufähig" : "D · Kritisch";

    var h = '<div class="sim-end ' + end.cls + '"><span class="sim-node-watermark" aria-hidden="true">AUDIT</span><div><span class="sim-kicker">✦ Debrief · ' + esc((ROLES[st.role] || ROLES.lead).name) + "</span><h2>" + esc(end.title) + "</h2><p>" + esc(end.text) + "</p></div>" +
      '<div class="sim-score"><b>' + sc + '</b><span>von 100</span><em>' + (complete ? rank : "vorläufig") + "</em><small>Bestpfad: " + bsc + "</small></div></div>";

    var kpiPairs = [
      { key: "c", label: "Rechtssicherheit", val: r.k.c, best: bp.k.c },
      { key: "q", label: "Datenqualität", val: r.k.q, best: bp.k.q },
      { key: "v", label: "Vertrauen", val: r.k.v, best: bp.k.v },
    ];
    var strongest = kpiPairs.slice().sort(function (a, b) { return b.val - a.val; })[0];
    var weakest = kpiPairs.slice().sort(function (a, b) { return a.val - b.val; })[0];
    var relPct = bsc > 0 ? Math.round((sc / bsc) * 100) : 100;
    var execTone = sc >= 80 ? "tone-strong" : sc < 60 ? "tone-strained" : "";
    h += '<section class="sim-exec-feedback ' + execTone + '" aria-label="Executive Audit-Feedback">' +
      '<span class="sim-node-watermark" aria-hidden="true">AUDITOR</span>' +
      '<div class="sim-exec-kicker">EU-DPP Audit-Einordnung · Geschäftsführung &amp; Compliance</div>' +
      '<blockquote class="sim-exec-quote">„Ihre Architektur erreicht aktuell <strong>' + relPct + '% des Bestpfad-Benchmarks</strong> (' + sc + ' von ' + bsc + ' Punkten). ' +
      'Die stärkste Säule ist <strong>' + strongest.label + ' (' + strongest.val + '/100)</strong>, während <strong>' + weakest.label + ' (' + weakest.val + '/100)</strong> den größten Handlungsbedarf zeigt.“</blockquote>' +
      '<div class="sim-exec-cols">' +
      '<div class="sim-exec-col hi"><span class="sim-exec-col-k">Stärkster Hebel</span><strong>' + strongest.label + ' (' + strongest.val + ')</strong><p>Liegt nah am Referenzwert (' + strongest.best + ') und trägt die Audit-Sicherheit.</p></div>' +
      '<div class="sim-exec-col warn"><span class="sim-exec-col-k">Kritischer Engpass</span><strong>' + weakest.label + ' (' + weakest.val + ')</strong><p>' + (r.events.length ? r.events.length + ' ausgelöste Folgeereignisse belasten das Gesamtbild.' : 'Ohne Nachsteuerung drohen Reibungsverluste beim Stichtag.') + '</p></div>' +
      '<div class="sim-exec-col focus"><span class="sim-exec-col-k">Relative Performance</span><strong>' + relPct + '% vs. Benchmark</strong><p>Restbudget: <strong>' + num(r.k.b) + ' T€</strong> · Zeitpuffer: <strong>' + (r.k.days < 0 ? Math.abs(r.k.days) + ' Tage Verzug' : r.k.days + ' Tage') + '</strong>.</p></div>' +
      '</div></section>';

    var curRole = ROLES[st.role] || ROLES.lead;
    var secretReached = curRole.checkSecret ? curRole.checkSecret(r.k, r) : false;
    var secretBlock = '<div class="sim-secret-eval ' + (secretReached ? 'reached' : 'failed') + '"><b>' + (secretReached ? '✓ Rollen-Sonderziel erreicht:' : '✕ Rollen-Sonderziel verfehlt:') + '</b> <span>' + esc(curRole.secretGoal) + '</span></div>';

    h += '<div class="sim-deb-grid"><div class="sim-card">' + radar(r.k, bp.k) +
      '<div class="sim-legend"><span class="you">Ihr Ergebnis</span><span class="bst">Bestpfad</span></div></div>' +
      '<div class="sim-card"><span class="sim-panel-k">Ihr Entscheidungsprofil &amp; Rollenziel</span><h3>' + esc(arch.name) + "</h3><p>" + esc(arch.text) + "</p>" + secretBlock + 
      '<div class="sim-mission-kpis compact">' +
      '<div><span>Rechtssicherheit</span><b>' + r.k.c + "</b></div><div><span>Datenqualität</span><b>" + r.k.q + "</b></div><div><span>Vertrauen</span><b>" + r.k.v + "</b></div>" +
      '<div><span>Budget</span><b>' + num(r.k.b) + " T€</b></div><div><span>Zeit</span><b>" + (r.k.days < 0 ? "+" + Math.abs(r.k.days) + " Verzug" : r.k.days + " Tage Puffer") + "</b></div></div></div></div>";

    h += '<div class="sim-card"><span class="sim-panel-k">Entscheidungsprotokoll</span><div class="sim-log">';
    r.steps.forEach(function (s) {
      var node = DATA[s.node], opt = node.options[s.pick];
      var bestKey = Object.keys(node.options).filter(function (o) { return node.options[o].tier === "best"; })[0];
      var tone = s.conditional ? "bad" : s.tier;
      h += '<details class="sim-log-row tier-' + tone + '"><summary><span class="sim-log-n">' + s.node.slice(1) + "</span><b>" + esc(node.title) + "</b><span class=\"sim-log-pick\">" + TIER[tone].icon + " " + s.pick.toUpperCase() + ": " + esc(opt.title) + "</span></summary>" +
        "<p>" + esc(s.result) + "</p>" +
        (s.pick !== bestKey ? '<p class="sim-log-best"><b>Stärkere Option ' + bestKey.toUpperCase() + ":</b> " + esc(node.options[bestKey].title) + " · " + esc(node.options[bestKey].result) + "</p>" : "") +
        '<p class="sim-log-lesson">' + esc(node.lesson) + ' <a href="#' + s.node + '">Station ' + s.node.slice(1) + " ansehen →</a></p></details>";
    });
    h += "</div></div>";

    if (r.events.length) {
      h += '<div class="sim-card"><span class="sim-panel-k">Ausgelöste Folgeereignisse</span><ul class="sim-events">' + r.events.map(function (e) {
        return "<li><b>" + esc(e.title) + "</b> <span>(ausgelöst in Knoten " + e.from.slice(1) + ")</span><br>" + esc(e.text) + "</li>";
      }).join("") + "</ul></div>";
    }

    h += '<div class="sim-card"><span class="sim-panel-k">Reflexion für Team &amp; Workshop</span><ol class="sim-reflect">' +
      "<li>An welchem Knoten hat Zeitdruck Ihre Entscheidung am stärksten beeinflusst, und was hätte Ihnen Luft verschafft?</li>" +
      "<li>Welche Entscheidung hatte eine verzögerte Folge? Woran hätten Sie das vorher erkennen können?</li>" +
      "<li>Welche Stimme (Vertrieb, Legal, IT, Controlling) haben Sie am häufigsten überstimmt, und wer vertritt sie in Ihrem Unternehmen?</li>" +
      "<li>Bei welchem Knoten würde Ihr reales Unternehmen heute die riskante Option wählen, und warum?</li>" +
      "<li>Welche drei Maßnahmen übernehmen Sie in Ihren 90-Tage-Fahrplan aus Station 12?</li></ol></div>";

    h += '<div class="sim-deb-actions"><button type="button" class="btn" data-sim-export>Debrief als Markdown herunterladen</button>' +
      '<button type="button" class="btn ghost" data-sim-copy>In die Zwischenablage kopieren</button>' +
      '<button type="button" class="btn ghost" onclick="window.print()">Drucken</button>' +
      '<button type="button" class="btn ghost" data-sim-reset>Mission neu starten</button>' +
      (!complete ? '<a class="btn ghost" href="#' + NODES.filter(function (n) { return !st.picks[n]; })[0] + '">Offenen Knoten entscheiden →</a>' : "") +
      '<span class="sim-copy-status" role="status" aria-live="polite"></span></div>';
    host.innerHTML = h;
  }

  function markdown() {
    var r = replay(st.order, st.picks, st.role);
    var complete = r.steps.length === 12;
    var end = complete ? ending(r.k) : { title: "Zwischenstand (" + r.steps.length + "/12)", text: "" };
    var arch = archetype(r.steps, r.k);
    var lines = [
      "# DPP Simulation Lab: Debrief Mission AlpenVolt",
      "",
      "- Rolle: " + (ROLES[st.role] || ROLES.lead).name,
      "- Ausgang: **" + end.title + "**" + (end.text ? " — " + end.text : ""),
      "- Punktzahl: " + score(r.k) + "/100 (Bestpfad: " + score(bestPath().k) + ")",
      "- Profil: " + arch.name,
      "",
      "## Kennzahlen",
      "",
      "| Rechtssicherheit | Datenqualität | Vertrauen | Budget | Zeit |",
      "|---|---|---|---|---|",
      "| " + r.k.c + " | " + r.k.q + " | " + r.k.v + " | " + r.k.b + " T€ | " + (r.k.days < 0 ? "+" + Math.abs(r.k.days) + " Tage Verzug" : r.k.days + " Tage Puffer") + " |",
      "",
      "## Entscheidungen",
      ""
    ];
    r.steps.forEach(function (s) {
      var node = DATA[s.node];
      var tone = s.conditional ? "bad" : s.tier;
      lines.push("### Knoten " + s.node.slice(1) + ": " + node.title);
      lines.push("- Wahl " + s.pick.toUpperCase() + ": " + node.options[s.pick].title + " (" + TIER[tone].label + ")");
      lines.push("- Folge: " + s.result);
      lines.push("- Lehre: " + node.lesson);
      lines.push("");
    });
    if (r.events.length) {
      lines.push("## Folgeereignisse", "");
      r.events.forEach(function (e) { lines.push("- " + e.title + " (aus Knoten " + e.from.slice(1) + "): " + e.text); });
      lines.push("");
    }
    lines.push("---", "Erstellt mit dem DPP Simulation Lab · example.invalid/dpp · Sustainista × DISRUPT");
    return lines.join("\n");
  }

  /* ---------- Globale Ereignisse ---------- */
    document.addEventListener("input", function (e) {
    var reasonInput = e.target.closest("[data-sim-reason]");
    if (reasonInput) {
      var nid = reasonInput.getAttribute("data-sim-reason");
      st.reasons[nid] = reasonInput.value;
      save();
    }
  });

  document.addEventListener("click", function (e) {
    var roleBtn = e.target.closest("[data-sim-role]");
    if (roleBtn && !st.order.length) {
      st.role = roleBtn.getAttribute("data-sim-role");
      save();
      refreshAll(false);
      return;
    }
    if (e.target.closest("[data-sim-reset]")) {
      if (!window.confirm("Mission AlpenVolt komplett neu starten? Alle Entscheidungen werden gelöscht.")) return;
      st = { role: null, order: [], picks: {} };
      save();
      refreshAll(false);
      location.hash = "#start";
      return;
    }
    if (e.target.closest("[data-sim-export]")) {
      var blob = new Blob([markdown()], { type: "text/markdown;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "dpp-simulation-lab-debrief.md";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return;
    }
    if (e.target.closest("[data-sim-copy]")) {
      var status = $(".sim-copy-status");
      var done = function (ok) { if (status) status.textContent = ok ? "Kopiert." : "Kopieren nicht möglich; bitte den Download nutzen."; };
      if (navigator.clipboard) navigator.clipboard.writeText(markdown()).then(function () { done(true); }, function () { done(false); });
      else done(false);
    }
  });

  function refreshAll(flash) {
    NODES.forEach(renderNode);
    renderMission();
    renderHud(flash);
    renderDebrief();
    $$("[data-card]").forEach(function (li) {
      var nid = li.getAttribute("data-card");
      var a = $("a", li);
      if (!a) return;
      var tag = $(".sim-card-tag", a);
      var s = replay(st.order, st.picks, st.role).steps.filter(function (x) { return x.node === nid; })[0];
      if (!s) { if (tag) tag.remove(); return; }
      if (!tag) { tag = document.createElement("span"); tag.className = "sim-card-tag"; a.appendChild(tag); }
      var tone = s.conditional ? "bad" : s.tier;
      tag.className = "sim-card-tag tier-" + tone;
      tag.textContent = TIER[tone].icon + " Entschieden";
    });
  }

  window.addEventListener("hashchange", function () {
    if ((location.hash || "").replace("#", "") === "debrief") renderDebrief();
  });

  refreshAll(false);
})();
