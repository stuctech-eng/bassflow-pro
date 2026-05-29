# BassFlow PRO

## Nieuwe chat starten
Zeg dit in nieuwe chat:
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
- Pagina 4: EditorScherm — noten editor

## Bestandsstructuur
src/components/
 OefeningFormulier.jsx  klaar
 FotoScherm.jsx         bug bijsnijden
 AudioScherm.jsx        placeholder
 EditorScherm.jsx       placeholder — AlphaTab komt hier
 FotoBijsnijden.jsx     klaar
 DetailScherm.jsx       klaar
 ModuleScherm.jsx       klaar
editor.html              oude canvas editor

## FotoScherm — huidige staat
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

## Bug — bijsnijden bevestigen
Probleem: foto wordt verkeerd bijgesneden
Oorzaak: cropRect percentages gebaseerd op heel venster maar foto gebruikt objectFit contain met lege ruimte boven/onder of links/rechts
Fix nodig: offsetX/offsetY correct berekenen voor werkelijke fotogrootte binnen venster

## Volgende stappen
1. FotoScherm bijsnijden bug fixen
2. AlphaTab integreren in EditorScherm.jsx
3. AudioScherm bouwen zelfde tab structuur als FotoScherm
4. PC: Firebase Function updaten met splits modus

## AlphaTab plan
Doel: professionele notatie engine voor basgitaar
Volledige notatie + TAB + playback
Fase 1A: viewer werkend
Fase 1B: noten invoeren
Fase 1C: technieken hammer-on slide bend etc
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

## README update afspraak
Claude werkt deze README bij na elke grote wijziging.
Altijd als laatste stap van een sessie.
