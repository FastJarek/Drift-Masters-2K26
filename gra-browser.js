// Przeglądarkowa wersja gry „Omijaj przeszkody”.

"use strict";

const K = {
  SZEROKOSC: 480,
  WYSOKOSC: 720,
  SZEROKOSC_DROGI: 300,
  ROZMIAR_AUTA: 44,
  PREDKOSC_GRACZA: 330,
  PREDKOSC_NPC: 200,
  CZAS_ODSTEP_NPC: 0.95,
  PUNKTY_NA_SEKUNDE: 10,
  LICZBA_ZYC: 3,
  CZAS_NIEZRANIALNOSCI: 1.5,
  LICZBA_PASOW: 3,
};

K.LEWA_DROGA = (K.SZEROKOSC - K.SZEROKOSC_DROGI) / 2;
K.PRAWA_DROGA = K.LEWA_DROGA + K.SZEROKOSC_DROGI;
K.SZEROKOSC_PASA = K.SZEROKOSC_DROGI / K.LICZBA_PASOW;
Object.freeze(K);

const KOLORY = Object.freeze({
  trawa: "#3a7d44",
  trawaCiemny: "#316a3a",
  droga: "#3a3a3e",
  linia: "#ebebe1",
  gracz: "#3cdc50",
  npc: "#e1413c",
  szyba: "#23323c",
});

class Gra {
  constructor() {
    this.najlepszyWynik = 0;
    try {
      this.najlepszyWynik =
        Number(localStorage.getItem("omijaj-najlepszy")) || 0;
    } catch (_) {
      // localStorage może być niedostępny (np. prywatny tryb przeglądarki).
    }
    this.reset();
  }

  reset() {
    this.gracz = {
      x: K.LEWA_DROGA + K.SZEROKOSC_DROGI / 2 - K.ROZMIAR_AUTA / 2,
      y: K.WYSOKOSC - 110,
      w: K.ROZMIAR_AUTA,
      h: K.ROZMIAR_AUTA,
    };
    this.npc = [];
    this.czasOdNpc = 0;
    this.przes = 0;
    this.punkty = 0;
    this.zycia = K.LICZBA_ZYC;
    this.czasNiezr = 0;
    this.scena = "gran";
  }

  aktualizuj(dt, lewo = false, prawo = false) {
    if (this.scena === "koniec") return;

    this.punkty += K.PUNKTY_NA_SEKUNDE * dt;
    this.przes = (this.przes + K.PREDKOSC_NPC * dt) % 80;
    this.czasNiezr = Math.max(0, this.czasNiezr - dt);

    const kierunek = (prawo ? 1 : 0) - (lewo ? 1 : 0);
    this.gracz.x += kierunek * K.PREDKOSC_GRACZA * dt;
    this.gracz.x = Math.max(
      K.LEWA_DROGA,
      Math.min(this.gracz.x, K.PRAWA_DROGA - K.ROZMIAR_AUTA)
    );

    this.czasOdNpc += dt;
    while (this.czasOdNpc >= K.CZAS_ODSTEP_NPC) {
      this.czasOdNpc -= K.CZAS_ODSTEP_NPC;
      const pas = Math.floor(Math.random() * K.LICZBA_PASOW);
      const x =
        K.LEWA_DROGA +
        pas * K.SZEROKOSC_PASA +
        (K.SZEROKOSC_PASA - K.ROZMIAR_AUTA) / 2;
      this.npc.push({
        x,
        y: -K.ROZMIAR_AUTA,
        w: K.ROZMIAR_AUTA,
        h: K.ROZMIAR_AUTA,
      });
    }

    for (const auto of this.npc) auto.y += K.PREDKOSC_NPC * dt;
    this.npc = this.npc.filter((auto) => auto.y < K.WYSOKOSC);

    if (this.czasNiezr <= 0) {
      const indeks = this.npc.findIndex((auto) => this.kolizja(auto));
      if (indeks !== -1) {
        this.npc.splice(indeks, 1);
        this.zycia -= 1;
        this.czasNiezr = K.CZAS_NIEZRANIALNOSCI;
        if (this.zycia <= 0) {
          this.najlepszyWynik = Math.max(
            this.najlepszyWynik,
            Math.floor(this.punkty)
          );
          try {
            localStorage.setItem(
              "omijaj-najlepszy",
              String(this.najlepszyWynik)
            );
          } catch (_) {
            // Brak dostępu do pamięci lokalnej nie przeszkadza w grze.
          }
          this.scena = "koniec";
        }
      }
    }
  }

  kolizja(auto) {
    return (
      this.gracz.x < auto.x + auto.w &&
      this.gracz.x + this.gracz.w > auto.x &&
      this.gracz.y < auto.y + auto.h &&
      this.gracz.y + this.gracz.h > auto.y
    );
  }

  rysujTlo(ctx) {
    const przes = Math.floor(this.przes);
    ctx.fillStyle = KOLORY.trawa;
    ctx.fillRect(0, 0, K.SZEROKOSC, K.WYSOKOSC);

    for (let y = -80 + przes; y < K.WYSOKOSC; y += 80) {
      ctx.fillStyle = KOLORY.trawaCiemny;
      ctx.fillRect(0, y, K.LEWA_DROGA, 40);
      ctx.fillRect(K.PRAWA_DROGA, y, K.LEWA_DROGA, 40);
    }

    ctx.fillStyle = KOLORY.droga;
    ctx.fillRect(K.LEWA_DROGA, 0, K.SZEROKOSC_DROGI, K.WYSOKOSC);

    ctx.fillStyle = KOLORY.linia;
    ctx.fillRect(K.LEWA_DROGA - 4, 0, 4, K.WYSOKOSC);
    ctx.fillRect(K.PRAWA_DROGA, 0, 4, K.WYSOKOSC);
    for (let pas = 1; pas < K.LICZBA_PASOW; pas++) {
      const x = K.LEWA_DROGA + pas * K.SZEROKOSC_PASA - 2;
      for (let y = -80 + przes; y < K.WYSOKOSC; y += 80) {
        ctx.fillRect(x, y, 4, 40);
      }
    }
  }

  rysujAuto(ctx, auto, kolor) {
    ctx.fillStyle = kolor;
    ctx.fillRect(auto.x, auto.y, auto.w, auto.h);
    ctx.fillStyle = KOLORY.szyba;
    ctx.fillRect(auto.x + 8, auto.y + 10, auto.w - 16, auto.h / 3);
  }

  rysujTekst(ctx, tekst, x, y, font, kolor = "#ffffff", align = "left") {
    ctx.font = font;
    ctx.fillStyle = kolor;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(tekst, x, y);
  }

  rysujInterfejs(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, K.SZEROKOSC, 44);
    const font = "20px 'DejaVu Sans', system-ui, sans-serif";
    this.rysujTekst(ctx, `Wynik: ${Math.floor(this.punkty)}`, 14, 29, font);
    this.rysujTekst(
      ctx,
      `Życia: ${this.zycia}`,
      K.SZEROKOSC - 14,
      29,
      font,
      "#ffffff",
      "right"
    );
    this.rysujTekst(
      ctx,
      "← → lub A/D – sterowanie",
      K.SZEROKOSC / 2,
      K.WYSOKOSC - 12,
      "15px 'DejaVu Sans', system-ui, sans-serif",
      "#e6e6e6",
      "center"
    );
  }

  rysujKoniec(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(0, 0, K.SZEROKOSC, K.WYSOKOSC);
    const srodek = K.SZEROKOSC / 2;
    this.rysujTekst(
      ctx,
      "Koniec gry",
      srodek,
      280,
      "42px 'DejaVu Sans', system-ui, sans-serif",
      "#ffffff",
      "center"
    );
    this.rysujTekst(
      ctx,
      `Twój wynik: ${Math.floor(this.punkty)}`,
      srodek,
      340,
      "22px 'DejaVu Sans', system-ui, sans-serif",
      "#ffffff",
      "center"
    );
    this.rysujTekst(
      ctx,
      `Najlepszy wynik: ${this.najlepszyWynik}`,
      srodek,
      375,
      "22px 'DejaVu Sans', system-ui, sans-serif",
      "#ffffff",
      "center"
    );
    this.rysujTekst(
      ctx,
      "R, Enter lub Spacja – zagraj ponownie",
      srodek,
      445,
      "20px 'DejaVu Sans', system-ui, sans-serif",
      "#ffffff",
      "center"
    );
  }

  rysuj(ctx) {
    if (!ctx) return;
    this.rysujTlo(ctx);
    for (const auto of this.npc) this.rysujAuto(ctx, auto, KOLORY.npc);

    const miganie = Math.floor(this.czasNiezr * 12) % 2 === 0;
    if (this.czasNiezr <= 0 || miganie) {
      this.rysujAuto(ctx, this.gracz, KOLORY.gracz);
    }

    this.rysujInterfejs(ctx);
    if (this.scena === "koniec") this.rysujKoniec(ctx);
  }
}

function uruchomWPrzegladarce() {
  const canvas = document.getElementById("gra");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const gra = new Gra();
  const klawisze = { lewo: false, prawo: false };

  const steruj = ( kod, wartosc ) => {
    if (kod === "ArrowLeft" || kod === "KeyA") klawisze.lewo = wartosc;
    if (kod === "ArrowRight" || kod === "KeyD") klawisze.prawo = wartosc;
  };

  window.addEventListener("keydown", (e) => {
    steruj(e.code, true);
    if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Space") {
      e.preventDefault();
    }
    if (
      gra.scena === "koniec" &&
      (e.code === "KeyR" || e.code === "Enter" || e.code === "Space")
    ) {
      gra.reset();
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => steruj(e.code, false));
  window.addEventListener("blur", () => {
    klawisze.lewo = false;
    klawisze.prawo = false;
  });

  for (const [id, kierunek] of [
    ["lewo", "lewo"],
    ["prawo", "prawo"],
  ]) {
    const przycisk = document.getElementById(id);
    if (!przycisk) continue;
    const ustaw = (wartosc) => (e) => {
      e.preventDefault();
      klawisze[kierunek] = wartosc;
    };
    przycisk.addEventListener("pointerdown", ustaw(true));
    przycisk.addEventListener("pointerup", ustaw(false));
    przycisk.addEventListener("pointercancel", ustaw(false));
    przycisk.addEventListener("pointerleave", ustaw(false));
  }

  let poprzedni = 0;
  const petla = (czas) => {
    const dt = poprzedni ? Math.min(0.05, (czas - poprzedni) / 1000) : 0;
    poprzedni = czas;
    gra.aktualizuj(dt, klawisze.lewo, klawisze.prawo);
    gra.rysuj(ctx);
    requestAnimationFrame(petla);
  };
  requestAnimationFrame(petla);

  // Ułatwia testy w konsoli przeglądarki.
  window.gra = gra;
}

if (typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", uruchomWPrzegladarce);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { K, Gra };
}
