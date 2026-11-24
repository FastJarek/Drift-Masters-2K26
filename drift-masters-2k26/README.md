# Drift Masters 2K26

3D gra driftowa na Androida (i w przeglądarce) z **przełączaniem sterowania dotykowego na klawiaturę + mysz**.
Tryb single player, tuning auta, ustawienia grafiki/dźwięku/czułości, 3 trasy treningowe i 3 trasy zawodów.

## Gotowy plik APK

- [`release/DriftMasters2K26-v1.0.apk`](release/DriftMasters2K26-v1.0.apk) — podpisany, wersja 1.0 (`com.driftmasters2k26`, Android 7.0 / API 24+).
- Wystarczy skopiować plik na telefon i zainstalować (w systemie trzeba zezwolić na instalację z nieznanych źródeł).
- Podpisano kluczem **debugowym** (`android/debug.keystore`) — do publikacji w Google Play wygeneruj własny klucz release.

## Zawartość

- **Tryby:** treningi (Pętla Startowa, Okrąg Poślizgu, Slalom Miejski) oraz zawody (City Night Circuit, Strefa Przemysłowa, Górska Przełęcz).
- **Rozgrywka:** przejazd przez bramki w kolejności, okrążenia, pomiar czasu, medale złoto/srebro/brąz, punkty za długość i kąt driftu, mnożnik combo, rekordy zapisywane lokalnie.
- **Tuning:** kolor nadwozia, felgi, spoiler, neon oraz 4 pięciopoziomowe ulepszenia (silnik, przyczepność, zawieszenie, układ driftowy) kupowane za zarobione kredyty.
- **Ustawienia:** tryb sterowania (dotyk / klawiatura + mysz), czułość, sterowanie myszką, odwrócenie kierownicy, dystans i wysokość kamery, FOV, widok za autem/z wnętrza, jakość grafiki, cienie, dym i poślizgi, zasięg widzenia, skala rozdzielczości oraz trzy suwaki głośności.
- **Dźwięk:** silnik, opony, wiatr i sygnały generowane synthesizerem Web Audio — bez plików audio.
- **Grafika:** Three.js (WebGL), własna fizyka jazdy z poślizgiem bocznym, bariery i dekoracje instancjonowane, dym, ślady opon, minimapa.

## Sterowanie

| Dotyk | Klawiatura / mysz |
| --- | --- |
| Przeciąganie w okrągłym polu po lewej — kierownica | `A` `D` / `←` `→` — kierownica |
| `GAZ`, `HAM`, `RĘCZNY`, `NOS` po prawej | `W` / `S` — gaz / hamowanie i bieg wsteczny |
| Przycisk `II` — pauza | `Spacja` — hamulec ręczny, `Shift` — nitro |
| — | Przytrzymaj LPM na obrazie i przeciągnij myszą — sterowanie |
| — | `C` — kamera, `R` — restart, `Esc` — pauza |

Tryb sterowania zmieniasz w menu **Ustawienia → Sterowanie**. Na Androidzie klawiatura i mysz (USB-C/Bluetooth) działają w WebView; przycisk dotykowy pojawia się tylko w trybie dotykowym. Przycisk Wstecz urządzenia otwiera pauzę lub wraca do menu.

## Uruchomienie w przeglądarce

Wymagany jest lokalny serwer HTTP (pliki ładują się jako zwykły skrypt, więc `file://` też powinien działać, ale serwer jest bezpieczniejszy):

```bash
python3 -m http.server 8000
```

Otwórz `http://localhost:8000/` — katalog `dist/` zawiera gotową wersję gry (`index.html`, `styles.css`, `game.js`).

## Budowa od źródła

```bash
npm install          # esbuild (tylko do złożenia plików)
npm test             # testy logiki (fizyka, trasy, zapis, punktacja)
npm run build        # dist/index.html + dist/game.js

android/setup-sdk.sh             # pobiera Android SDK 35 + build-tools 35 (jeśli brak)
ANDROID_SDK_ROOT=$HOME/.android-sdk android/build-apk.sh
```

Wynik: `release/DriftMasters2K26-v1.0.apk`.

Na systemie ARM build-tools firmy Google są binarniami x86_64 — skrypt używa wtedy `qemu-x86_64-static` z sysrootem `/usr/x86_64-linux-gnu` (pakiety `libc6-amd64-cross`, `libstdc++6-amd64-cross`, `libgcc-s1-amd64-cross`). Na typowym PC z Linuxem/Windowsem/Maciem qemu nie jest potrzebny.

## Struktura

- `src/core.js` — zapis, trasy, fizyka, punktacja (czyściutki JS, testowalny w Node).
- `src/world.js` — scena 3D, trasy, auto, efekty, kamera, minimapa (Three.js).
- `src/game.js` — interfejs, wejście, pętla gry i rozgrywka.
- `src/audio.js` — synteza dźwięku.
- `src/index.template.html`, `src/styles.css` — interfejs.
- `scripts/build.mjs` — bundlowanie esbuild.
- `android/` — powłoka WebView, manifest, skrypty budowy APK.
- `tests/core.test.mjs` — testy logiki.

Licencja Three.js: MIT (plik `src/lib/three.module.js`, revision 160).
