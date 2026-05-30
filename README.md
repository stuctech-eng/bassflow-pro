# BassFlow PRO

## Nieuwe chat starten
"Lees mijn README op https://raw.githubusercontent.com/stuctech-eng/bassflow-pro/main/README.md en help me verder met BassFlow PRO"

## Project
- App: https://bassflow-pro.web.app
- GitHub: https://github.com/stuctech-eng/bassflow-pro
- Firebase Function: https://analyseertablature-dia7q5dlaq-uc.a.run.app
- Stack: React/Vite, Firebase Firestore/Storage, GitHub Actions CI/CD

## PC info
- Git Bash: /c/Users/31628/Desktop/bassflow-pro
- Functions map: C:\Users\31628\Desktop\functions\
- GitHub gebruiker: stuctech-eng

## GitHub Action
Bij elke push naar main:
1. npm run build
2. cp editor.html dist/
3. firebase deploy
Automatisch — geen handmatige deploy nodig.

## App architectuur
OefeningFormulier.jsx navigeert naar 4 schermen:
- Pagina 1: OefeningFormulier — titel, module, tempo, 3 knoppen, info, opslaan
- Pagina 2: FotoScherm — foto workflow
- Pagina 3: AudioScherm — audio workflow
- Pagina 4: EditorScherm — AlphaTab noten editor

## Bestandsstructuur
src/components/
  OefeningFormulier.jsx  klaar
  FotoScherm.jsx         2 bugs — zie hieronder
  AudioScherm.jsx        placeholder
  EditorScherm.jsx       Fase 1A AlphaTab CDN — nog niet getest
  FotoBijsnijden.jsx     klaar
  DetailScherm.jsx       klaar
  ModuleScherm.jsx       klaar
editor.html              oude canvas editor

## FotoScherm bugs — fix nodig
Bug 1 — regel 18:
useState("");f  ← verwijder de f

Bug 2 — bevestigBijsnijden functie:
Sluitende } ontbreekt na catch block
setBijsnijdActief(false);
  }
}  ← deze ontbreekt

## FotoScherm — staat na fix
3 tabs met swipe (Foto / Notatie / Info)
Groene bolletje = tab heeft inhoud
Undo per tab

Foto tab:
- Foto venster 220px
- Import knop roze
- AI Analyseer knop paars — altijd zichtbaar
- Contrast slider
- Bijsnijden 4 hoekhandgrepen + Clean knop
- Foto lijst met thumbnails — klik = selecteer, pijltjes, verwijder

Notatie tab: placeholder
Info tab: textarea + Vertaal + AI knop

## EditorScherm — AlphaTab Fase 1A
- AlphaTab geladen via CDN
- Bass notenbalk + TAB tonen
- Playback knop
- Voorbeeld baslijn als test
- Later omzetten naar npm op PC

## Volgende stappen
1. FotoScherm bugs fixen (2 bugs hierboven)
2. EditorScherm AlphaTab testen
3. AudioScherm bouwen
4. PC: AlphaTab omzetten van CDN naar npm
5. PC: Firebase Function updaten met splits modus

## AlphaTab plan
CDN nu — npm later via PC
Fase 1A: viewer — bezig
Fase 1B: noten invoeren
Fase 1C: technieken
CDN werkt via bassflow-pro.web.app — NIET via edge://external-file

## Muziekmodel toekomst
Song naar Tracks naar Measures naar Voices naar Beats naar Notes
Opslag: JSON intern, MusicXML export
AI: foto naar OCR naar MusicXML naar editor

## Firebase security rules
Firestore + Storage: alleen ingelogde gebruikers
Realtime Database: auth != null lezen en schrijven

## Workflow iPhone
1. Code schrijven in Working Copy
2. Commit + Push
3. GitHub Action deployt automatisch 2 minuten
4. Testen via bassflow-pro.web.app in Safari

## Afspraken
- Altijd 1 blok code per bestand
- Stap voor stap
- Zip met -j flag
- Claude update README na elke grote wijziging
- Commando README UPDATE = direct bijgewerkte README
- Commando CODESNAP = direct CodeSnap snippet
