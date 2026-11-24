// Czysta logika strzelanki 3D – bez Three.js, dzięki czemu działa też w Node.
// Renderer (strzelec3d.mjs) czyta stan gry i zdarzenia z tej klasy.

export const POSTACIE = Object.freeze([
  {
    id: "szturmowiec",
    nazwa: "Szturmowiec",
    kolor: 0x5ee08a,
    opis: "Wyważona postać. Dobra kondycja i celność.",
    szybkosc: 1.0,
    zycie: 100,
    wykrywanie: 1.0,
    celność: 1.0,
  },
  {
    id: "zwiadowca",
    nazwa: "Zwiadowca",
    kolor: 0x5fc8ff,
    opis: "Szybki i trudny do wykrycia, ale kruchy.",
    szybkosc: 1.18,
    zycie: 80,
    wykrywanie: 0.55,
    celność: 1.08,
  },
  {
    id: "strzelec",
    nazwa: "Strzelec wyborowy",
    kolor: 0xffc766,
    opis: "Najcelniejszy. Wolniejszy ruch i mniejsze rozproszenie.",
    szybkosc: 0.92,
    zycie: 90,
    wykrywanie: 0.95,
    celność: 0.68,
  },
  {
    id: "operator",
    nazwa: "Operator",
    kolor: 0xc59bff,
    opis: "Pancerz i wytrzymałość kosztem szybkości.",
    szybkosc: 0.85,
    zycie: 125,
    wykrywanie: 1.12,
    celność: 1.0,
  },
]);

export const BRONIE = Object.freeze([
  {
    id: "pistolet",
    nazwa: "Pistolet M9",
    magazynek: 12,
    zapas: 60,
    obrazenia: 26,
    mnoznikGlowy: 2.2,
    szybkosc: 4.5,
    czasPrzeladowania: 1.25,
    rozproszenie: 0.018,
    rozproszenieCel: 0.005,
    odrzut: 0.018,
    automatyczna: false,
    zasieg: 90,
  },
  {
    id: "ak",
    nazwa: "Karabinek AK-47",
    magazynek: 30,
    zapas: 180,
    obrazenia: 19,
    mnoznikGlowy: 2.0,
    szybkosc: 10,
    czasPrzeladowania: 2.1,
    rozproszenie: 0.032,
    rozproszenieCel: 0.011,
    odrzut: 0.013,
    automatyczna: true,
    zasieg: 140,
  },
  {
    id: "m24",
    nazwa: "Karabin M24",
    magazynek: 5,
    zapas: 35,
    obrazenia: 95,
    mnoznikGlowy: 2.6,
    szybkosc: 0.9,
    czasPrzeladowania: 2.8,
    rozproszenie: 0.006,
    rozproszenieCel: 0.0006,
    odrzut: 0.05,
    automatyczna: false,
    zasieg: 250,
    luneta: true,
  },
]);

export const K = {
  PREDKOSC: 4.7,
  MNOZNIK_SPRINTU: 1.45,
  MNOZNIK_KUCU: 0.5,
  MNOZNIK_CELU: 0.62,
  GRAVITACJA: 19,
  SILA_SKOKU: 6.5,
  PROMIEN_GRACZA: 0.35,
  WZROST: 1.8,
  WZROST_KUC: 1.15,
  OCZY_STAN: 1.62,
  OCZY_KUC: 1.02,
  CZULOSC_MYSZY: 0.0022,
  ZASIEG_INTERAKCJI: 2.8,
  POZIOMY_ZOOMU: [1, 2, 4, 6, 8, 12],
  CZAS_GRY: 0,
};
Object.freeze(K);

const WALCE = new Set([0, 1, 2]);

function ogranicz(wartosc, min, max) {
  return Math.max(min, Math.min(max, wartosc));
}

function odleglosc(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function normalizuj(v) {
  const d = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / d, y: v.y / d, z: v.z / d };
}

// Przecięcie promienia z prostopadłościanem (metoda slab).
function promienBox(poczatek, kierunek, box, maks = Infinity) {
  let tMin = 0;
  let tMax = maks;
  const osie = [
    [poczatek.x, kierunek.x, box.minX, box.maxX],
    [poczatek.y, kierunek.y, box.minY, box.maxY],
    [poczatek.z, kierunek.z, box.minZ, box.maxZ],
  ];
  for (const [p, d, min, max] of osie) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > max) return null;
      continue;
    }
    let t1 = (min - p) / d;
    let t2 = (max - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

function stworzPrzeszkody() {
  const lista = [];
  const dodaj = (typ, x1, y1, z1, x2, y2, z2, extra = {}) => {
    lista.push({
      id: `${typ}-${lista.length}`,
      typ,
      minX: x1,
      maxX: x2,
      minY: y1,
      maxY: y2,
      minZ: z1,
      maxZ: z2,
      aktywny: true,
      ...extra,
    });
  };

  // Mury zewnętrzne areny.
  dodaj("mur", -21, 0, -21, 21, 5, -20.2);
  dodaj("mur", -21, 0, 20.2, 21, 5, 21);
  dodaj("mur", -21, 0, -21, -20.2, 5, 21);
  dodaj("mur", 20.2, 0, -21, 21, 5, 21);

  // Skrzynie i kontenery – osłony.
  dodaj("skrzynia", -6.5, 0, -5.5, -3.5, 1.7, -2.5);
  dodaj("skrzynia", 2.5, 0, -10.5, 5.5, 2.1, -7.5);
  dodaj("skrzynia", -14, 0, -8, -11, 1.35, -5.5);
  dodaj("kontener", 8, 0, -2.5, 12, 2.4, 1.5);
  dodaj("skrzynia", -7, 0, 5.5, -4, 1.5, 8.5);
  dodaj("skrzynia", 3.5, 0, 4, 6.5, 1.8, 7);
  dodaj("kontener", -3, 0, -15.5, 0.3, 2.2, -12.5);
  dodaj("skrzynia", 11, 0, -17, 14, 1.6, -14.5);
  dodaj("skrzynia", -16.5, 0, 10, -13.5, 1.5, 13);

  // Brama blokująca drogę do ewakuacji – otwiera terminal.
  dodaj("brama", -3.4, 0, -16.4, 3.4, 3.2, -15.8, { id: "brama" });

  return lista;
}

function stworzWrogow() {
  const dane = [
    [-9, -3, [-9, -3, -12, -3]],
    [6.5, -6, [6.5, -6, 6.5, 1]],
    [-14.5, 3.5, [-14.5, 3.5, -14.5, -2]],
    [12, 6, [12, 6, 6, 6]],
    [-6, -12, [-6, -12, -10, -12]],
    [15, -10, [15, -10, 15, -4]],
  ];
  return dane.map(([x, z, trasa], i) => ({
    id: `wróg-${i + 1}`,
    indeks: i,
    x,
    z,
    y: 0,
    yaw: (i * Math.PI) / 3,
    hp: 100,
    maxHp: 100,
    trasa,
    celTrasy: 1,
    czujnosc: 0,
    stan: "patrol",
    czasStrzalu: 0.8 + i * 0.17,
    czasSmierci: 0,
    martwy: false,
    biegle: 0,
  }));
}

function stworzPrzedmioty() {
  return [
    { id: "apteczka-1", typ: "apteczka", x: -1.5, z: 12, aktywny: true, wartosc: 40 },
    { id: "apteczka-2", typ: "apteczka", x: 17, z: -5, aktywny: true, wartosc: 40 },
    { id: "ammo-1", typ: "amunicja", x: -14, z: 7, aktywny: true, wartosc: 60 },
    { id: "ammo-2", typ: "amunicja", x: 6, z: -17, aktywny: true, wartosc: 90 },
  ];
}

export class GraStrzelec {
  constructor({ postac = POSTACIE[0], imie = "Żołnierz" } = {}) {
    this.ustawPostac(postac, imie);
  }

  ustawPostac(postac, imie) {
    this.postac = POSTACIE.find((p) => p.id === postac?.id) || POSTACIE[0];
    this.imie = String(imie || "Żołnierz").slice(0, 16) || "Żołnierz";
    this.reset();
  }

  reset() {
    this.scena = "menu";
    this.czas = 0;
    this.zabici = 0;
    this.oddaneStrzaly = 0;
    this.trafienia = 0;
    this.zdarzenia = [];
    this.wiadomosc = "";
    this.czasWiadomosci = 0;
    this.terminalAktywny = false;
    this.bramaOtwarta = false;

    this.gracz = {
      x: 0,
      y: 0,
      z: 17,
      yaw: 0,
      pitch: 0,
      vy: 0,
      naZiemi: true,
      kuc: false,
      cel: false,
      sprint: false,
      zycie: this.postac.zycie,
      maxZycie: this.postac.zycie,
      wytrzymalosc: 100,
      wysokoscOcz: K.OCZY_STAN,
      odrzut: 0,
      rozproszenie: 0,
      bron: 0,
      zoom: 0,
      magazynki: BRONIE.map((b) => b.magazynek),
      zapasy: BRONIE.map((b) => b.zapas),
      czasPrzeladowania: 0,
      czasStrzalu: 0,
      poprzedniaStrona: 0,
    };

    this.przeszkody = stworzPrzeszkody();
    this.wrogowie = stworzWrogow();
    this.przedmioty = stworzPrzedmioty();
    this.terminal = { x: 15.5, z: -15.5, typ: "terminal", aktywny: true };
    this.wyjscie = { x: 0, z: -18.6, typ: "wyjscie", aktywny: true };
    this.bliskaInterakcja = null;
  }

  start() {
    if (this.scena === "menu" || this.scena === "koniec") this.reset();
    this.scena = "gran";
  }

  pauza() {
    if (this.scena === "gran") this.scena = "pauza";
    else if (this.scena === "pauza") this.scena = "gran";
  }

  dodajZdarzenie(zdarzenie) {
    this.zdarzenia.push(zdarzenie);
  }

  pokazWiadomosc(tekst, czas = 2.4) {
    this.wiadomosc = tekst;
    this.czasWiadomosci = czas;
    this.dodajZdarzenie({ typ: "wiadomosc", tekst, czas });
  }

  get bron() {
    return BRONIE[this.gracz.bron];
  }

  get pozostaloWrogow() {
    return this.wrogowie.filter((w) => !w.martwy).length;
  }

  get celownikRozproszenie() {
    return this.gracz.rozproszenie;
  }

  get powiekszenie() {
    return this.bron.luneta ? K.POZIOMY_ZOOMU[this.gracz.zoom] : 1;
  }

  kierunekPatrzenia() {
    const { yaw, pitch } = this.gracz;
    return normalizuj({
      x: Math.sin(yaw) * Math.cos(pitch),
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * Math.cos(pitch),
    });
  }

  pozycjaOcz() {
    return {
      x: this.gracz.x,
      y: this.gracz.y + this.gracz.wysokoscOcz,
      z: this.gracz.z,
    };
  }

  zmienBron(numer) {
    if (!WALCE.has(numer) || numer === this.gracz.bron) return;
    this.gracz.bron = numer;
    this.gracz.czasPrzeladowania = 0;
    this.gracz.czasStrzalu = Math.max(this.gracz.czasStrzalu, 0.25);
    this.gracz.zoom = 0;
    this.dodajZdarzenie({ typ: "bron", numer, nazwa: BRONIE[numer].nazwa });
  }

  zmienZoom(delta) {
    if (!this.bron.luneta || !delta) return;
    const nowy = ogranicz(this.gracz.zoom + Math.sign(delta), 0, K.POZIOMY_ZOOMU.length - 1);
    if (nowy !== this.gracz.zoom) {
      this.gracz.zoom = nowy;
      this.dodajZdarzenie({ typ: "zoom", wartosc: this.powiekszenie });
    }
  }

  zacznijPrzeladowanie() {
    const g = this.gracz;
    const b = this.bron;
    if (g.czasPrzeladowania > 0 || g.magazynki[g.bron] >= b.magazynek || g.zapasy[g.bron] <= 0) return;
    g.czasPrzeladowania = b.czasPrzeladowania;
    this.dodajZdarzenie({ typ: "przeladuj", nazwa: b.nazwa });
  }

  zakonczPrzeladowanie() {
    const g = this.gracz;
    const b = this.bron;
    const potrzeba = b.magazynek - g.magazynki[g.bron];
    const wzieto = Math.min(potrzeba, g.zapasy[g.bron]);
    g.magazynki[g.bron] += wzieto;
    g.zapasy[g.bron] -= wzieto;
    this.dodajZdarzenie({ typ: "przeladujKoniec" });
  }

  kolizja(x, z, promien, wysokosc, y) {
    for (const p of this.przeszkody) {
      if (!p.aktywny) continue;
      if (p.maxY <= y + 0.06 || p.minY >= y + wysokosc - 0.06) continue;
      if (
        x + promien > p.minX &&
        x - promien < p.maxX &&
        z + promien > p.minZ &&
        z - promien < p.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  przesunObiekt(obj, dx, dz, promien, wysokosc, y = obj.y || 0) {
    if (dx && !this.kolizja(obj.x + dx, obj.z, promien, wysokosc, y)) obj.x += dx;
    if (dz && !this.kolizja(obj.x, obj.z + dz, promien, wysokosc, y)) obj.z += dz;
  }

  promienWSwiat(poczatek, kierunek, maks = 200, wrogowie = true) {
    let najlepszy = null;
    const zapisz = (t, dane) => {
      if (t !== null && t >= 0 && t <= maks && (!najlepszy || t < najlepszy.t)) {
        najlepszy = { t, ...dane };
      }
    };

    for (const p of this.przeszkody) {
      if (!p.aktywny) continue;
      zapisz(promienBox(poczatek, kierunek, p, maks), { typ: "przeszkoda", przeszkoda: p });
    }

    if (kierunek.y < -1e-6) {
      const t = -poczatek.y / kierunek.y;
      zapisz(t, { typ: "ziemia" });
    }

    if (wrogowie) {
      for (const w of this.wrogowie) {
        if (w.martwy) continue;
        const box = {
          minX: w.x - 0.42,
          maxX: w.x + 0.42,
          minY: w.y + 0.05,
          maxY: w.y + 1.85,
          minZ: w.z - 0.42,
          maxZ: w.z + 0.42,
        };
        const t = promienBox(poczatek, kierunek, box, maks);
        if (t === null) continue;
        const punkt = {
          x: poczatek.x + kierunek.x * t,
          y: poczatek.y + kierunek.y * t,
          z: poczatek.z + kierunek.z * t,
        };
        zapisz(t, {
          typ: "wróg",
          wróg: w,
          punkt,
          głowa: punkt.y > w.y + 1.48,
        });
      }
    }

    if (najlepszy) {
      najlepszy.punkt = najlepszy.punkt || {
        x: poczatek.x + kierunek.x * najlepszy.t,
        y: poczatek.y + kierunek.y * najlepszy.t,
        z: poczatek.z + kierunek.z * najlepszy.t,
      };
      najlepszy.odleglosc = najlepszy.t;
    }
    return najlepszy;
  }

  liniaWolna(od, cel, maks = 60) {
    const dx = cel.x - od.x;
    const dy = cel.y - od.y;
    const dz = cel.z - od.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) return true;
    const kierunek = { x: dx / d, y: dy / d, z: dz / d };
    for (const p of this.przeszkody) {
      if (!p.aktywny) continue;
      const t = promienBox(od, kierunek, p, Math.min(d, maks));
      if (t !== null && t > 0.05 && t < d - 0.25) return false;
    }
    return true;
  }

  strzelaj() {
    const g = this.gracz;
    const b = this.bron;
    if (g.magazynki[g.bron] <= 0) {
      this.zacznijPrzeladowanie();
      return;
    }

    g.magazynki[g.bron] -= 1;
    g.czasStrzalu = 1 / b.szybkosc;
    this.oddaneStrzaly += 1;

    const ruch = Math.hypot(g.vy, 0) + (g.sprint ? 1 : 0);
    const mnoznik =
      b.rozproszenie *
      (g.cel ? b.rozproszenieCel / b.rozproszenie : 1) *
      this.postac.celność *
      (g.kuc ? 0.8 : 1) *
      (ruch > 0.1 ? 1.35 : 1);
    const bazowy = this.kierunekPatrzenia();
    const kierunek = normalizuj({
      x: bazowy.x + (Math.random() * 2 - 1) * mnoznik,
      y: bazowy.y + (Math.random() * 2 - 1) * mnoznik,
      z: bazowy.z + (Math.random() * 2 - 1) * mnoznik * 0.4,
    });
    const poczatek = this.pozycjaOcz();
    const trafienie = this.promienWSwiat(poczatek, kierunek, b.zasieg);

    const koniec = trafienie
      ? trafienie.punkt
      : {
          x: poczatek.x + kierunek.x * b.zasieg,
          y: poczatek.y + kierunek.y * b.zasieg,
          z: poczatek.z + kierunek.z * b.zasieg,
        };

    g.odrzut = Math.min(0.22, g.odrzut + b.odrzut);
    g.pitch = ogranicz(g.pitch + b.odrzut * 0.28, -1.45, 1.45);

    this.dodajZdarzenie({
      typ: "strzal",
      bron: g.bron,
      od: poczatek,
      do: koniec,
      cel: trafienie ? trafienie.typ : "powietrze",
    });

    if (!trafienie) return;

    if (trafienie.typ === "wróg") {
      const w = trafienie.wróg;
      const dmg = Math.round(b.obrazenia * (trafienie.głowa ? b.mnoznikGlowy : 1));
      w.hp -= dmg;
      this.trafienia += 1;
      this.dodajZdarzenie({
        typ: "trafienie",
        punkt: trafienie.punkt,
        głowa: trafienie.głowa,
        obrazenia: dmg,
        wróg: w.id,
      });
      if (w.hp <= 0) {
        w.hp = 0;
        w.martwy = true;
        w.czasSmierci = 0;
        this.zabici += 1;
        this.dodajZdarzenie({ typ: "zabicie", wróg: w, liczba: this.zabici });
        if (this.zabici === this.wrogowie.length) {
          this.pokazWiadomosc("Wszyscy wrogowie pokonani. Uruchom terminal! (E)", 4);
        }
      }
    } else {
      this.dodajZdarzenie({
        typ: "uderzenie",
        punkt: trafienie.punkt,
        rodzaj: trafienie.typ,
      });
    }
  }

  znajdzInterakcje() {
    const g = this.gracz;
    const kandydaci = [...this.przedmioty.filter((p) => p.aktywny), this.terminal, this.wyjscie];
    let najblizszy = null;
    let najmniejsza = K.ZASIEG_INTERAKCJI;
    for (const o of kandydaci) {
      if (o.aktywny === false) continue;
      const d = odleglosc(g, o);
      if (d < najmniejsza) {
        najmniejsza = d;
        najblizszy = o;
      }
    }
    return najblizszy;
  }

  etykietaInterakcji() {
    const o = this.bliskaInterakcja;
    if (!o) return "";
    if (o.typ === "apteczka") return "[E] Weź apteczkę (+40 HP)";
    if (o.typ === "amunicja") return "[E] Weź amunicję";
    if (o.typ === "terminal") {
      return this.terminalAktywny
        ? "Terminal już uruchomiony"
        : this.pozostaloWrogow > 0
          ? "[E] Terminal (najpierw pokonaj wrogów)"
          : "[E] Uruchom terminal – otwórz bramę";
    }
    if (o.typ === "wyjscie") {
      return this.terminalAktywny
        ? "[E] Ewakuacja – zakończ misję"
        : "[E] Ewakuacja (otwórz bramę w terminalu)";
    }
    return "[E] Użyj";
  }

  wykonajInterakcje() {
    const o = this.bliskaInterakcja || this.znajdzInterakcje();
    if (!o) return false;
    const g = this.gracz;

    if (o.typ === "apteczka") {
      if (g.zycie >= g.maxZycie) {
        this.pokazWiadomosc("Masz pełne zdrowie", 1.4);
        return false;
      }
      g.zycie = Math.min(g.maxZycie, g.zycie + o.wartosc);
      o.aktywny = false;
      this.dodajZdarzenie({ typ: "pickup", rodzaj: "apteczka", x: o.x, z: o.z });
      this.pokazWiadomosc("Apteczka: +40 zdrowia", 1.6);
      return true;
    }

    if (o.typ === "amunicja") {
      BRONIE.forEach((b, i) => {
        g.zapasy[i] = Math.min(b.zapas + o.wartosc, g.zapasy[i] + o.wartosc);
      });
      o.aktywny = false;
      this.dodajZdarzenie({ typ: "pickup", rodzaj: "amunicja", x: o.x, z: o.z });
      this.pokazWiadomosc("Amunicja uzupełniona", 1.6);
      return true;
    }

    if (o.typ === "terminal") {
      if (this.terminalAktywny) {
        this.pokazWiadomosc("Brama jest już otwarta", 1.4);
        return false;
      }
      if (this.pozostaloWrogow > 0) {
        this.pokazWiadomosc(`Pozostało ${this.pozostaloWrogow} wrogów`, 1.8);
        return false;
      }
      this.terminalAktywny = true;
      this.bramaOtwarta = true;
      const brama = this.przeszkody.find((p) => p.id === "brama");
      if (brama) brama.aktywny = false;
      this.dodajZdarzenie({ typ: "brama" });
      this.pokazWiadomosc("Brama otwarta. Biegnij do strefy ewakuacji!", 4);
      return true;
    }

    if (o.typ === "wyjscie") {
      if (!this.terminalAktywny || this.pozostaloWrogow > 0) {
        this.pokazWiadomosc("Strefa zamknięta – uruchom terminal", 2);
        return false;
      }
      this.scena = "wygrana";
      this.dodajZdarzenie({ typ: "wygrana" });
      return true;
    }

    return false;
  }

  aktualizujWrogow(dt) {
    const g = this.gracz;
    const okoGracza = this.pozycjaOcz();

    for (const w of this.wrogowie) {
      if (w.martwy) {
        w.czasSmierci += dt;
        continue;
      }

      const d = odleglosc(w, g);
      const okoWroga = { x: w.x, y: w.y + 1.55, z: w.z };
      const widzi = d < 24 && this.liniaWolna(okoWroga, okoGracza);
      const mod = g.sprint ? 1.65 : g.kuc ? 0.42 : 1;

      if (widzi) {
        const bliskosc = 1 - d / 30;
        w.czujnosc = ogranicz(
          w.czujnosc + dt * (0.75 + bliskosc * 1.9) * mod * this.postac.wykrywanie,
          0,
          1
        );
      } else {
        w.czujnosc = Math.max(0, w.czujnosc - dt * 0.32);
      }

      if (w.czujnosc >= 1) w.stan = "atak";
      else if (w.czujnosc > 0.25) w.stan = "podejrzliwy";
      else w.stan = "patrol";

      let vx = 0;
      let vz = 0;
      let celYaw = w.yaw;

      if (w.stan === "patrol") {
        const [tx, tz] = [w.trasa[w.celTrasy * 2], w.trasa[w.celTrasy * 2 + 1]];
        const dd = Math.hypot(tx - w.x, tz - w.z);
        if (dd < 0.7) w.celTrasy = 1 - w.celTrasy;
        else {
          vx = ((tx - w.x) / dd) * 1.7;
          vz = ((tz - w.z) / dd) * 1.7;
          celYaw = Math.atan2(vx, -vz);
        }
      } else if (w.stan === "podejrzliwy") {
        vx = ((g.x - w.x) / (d || 1)) * 1.3;
        vz = ((g.z - w.z) / (d || 1)) * 1.3;
        celYaw = Math.atan2(g.x - w.x, -(g.z - w.z));
      } else {
        celYaw = Math.atan2(g.x - w.x, -(g.z - w.z));
        if (d > 7) {
          vx = ((g.x - w.x) / d) * 3.3;
          vz = ((g.z - w.z) / d) * 3.3;
        } else if (d < 3.5) {
          vx = -((g.x - w.x) / d) * 2.2;
          vz = -((g.z - w.z) / d) * 2.2;
        } else {
          vx = -(g.z - w.z) / d * 1.6;
          vz = (g.x - w.x) / d * 1.6;
        }
      }

      this.przesunObiekt(w, vx * dt, vz * dt, 0.42, 1.8);
      w.biegle = Math.min(1, Math.hypot(vx, vz) / 3);
      let roznica = ((celYaw - w.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      w.yaw += roznica * Math.min(1, dt * 5);

      w.czasStrzalu -= dt;
      if (w.stan === "atak" && widzi && d < 23 && w.czasStrzalu <= 0) {
        w.czasStrzalu = 0.55 + Math.random() * 0.6;
        // Huk strzału alarmuje wrogów w pobliżu – nie muszą sami widzieć gracza.
        for (const inny of this.wrogowie) {
          if (inny === w || inny.martwy) continue;
          if (Math.hypot(inny.x - w.x, inny.z - w.z) < 14) {
            inny.czujnosc = Math.max(inny.czujnosc, 0.8);
          }
        }
        const cel = {
          x: okoGracza.x + (Math.random() * 2 - 1) * 0.35,
          y: okoGracza.y + (Math.random() * 2 - 1) * 0.4,
          z: okoGracza.z + (Math.random() * 2 - 1) * 0.35,
        };
        const szansa = ogranicz(
          0.7 - d * 0.016 - (g.kuc ? 0.16 : 0) - (g.sprint ? 0.06 : 0),
          0.06,
          0.72
        );
        const trafiony = Math.random() < szansa;
        const koniec = trafiony
          ? okoGracza
          : {
              x: cel.x + (Math.random() * 2 - 1) * 2.5,
              y: cel.y + (Math.random() * 2 - 1) * 2.5,
              z: cel.z + (Math.random() * 2 - 1) * 2.5,
            };
        this.dodajZdarzenie({
          typ: "strzal_wroga",
          od: okoWroga,
          do: koniec,
          wróg: w.id,
          trafiony,
        });
        if (trafiony) {
          const dmg = Math.round(8 + Math.random() * 7);
          g.zycie = Math.max(0, g.zycie - dmg);
          this.dodajZdarzenie({
            typ: "ranienie",
            obrazenia: dmg,
            od: Math.atan2(w.x - g.x, -(w.z - g.z)),
          });
          if (g.zycie <= 0) {
            this.scena = "koniec";
            this.dodajZdarzenie({ typ: "porazka" });
            return;
          }
        }
      }
    }
  }

  aktualizuj(dt, wejscie = {}) {
    if (this.scena !== "gran") return;
    dt = ogranicz(dt, 0, 0.05);
    const g = this.gracz;
    const b = this.bron;
    this.czas += dt;
    this.czasWiadomosci = Math.max(0, this.czasWiadomosci - dt);

    // Patrzenie – mysz, touchpad lub prawy strefa dotykowa.
    g.yaw += (wejscie.ruchX || 0) * K.CZULOSC_MYSZY;
    g.pitch = ogranicz(g.pitch + (wejscie.ruchY || 0) * K.CZULOSC_MYSZY, -1.45, 1.45);
    g.odrzut *= Math.max(0, 1 - dt * 9);

    if (wejscie.bron) this.zmienBron(wejscie.bron - 1);
    if (wejscie.zoom) this.zmienZoom(wejscie.zoom);

    // Wybór broni 1/2/3 oraz przeładowanie.
    g.cel = !!wejscie.cel;
    g.kuc = !!wejscie.kuc;
    const docelowaWysokosc = g.kuc ? K.OCZY_KUC : K.OCZY_STAN;
    g.wysokoscOcz += (docelowaWysokosc - g.wysokoscOcz) * Math.min(1, dt * 12);

    this.bliskaInterakcja = this.znajdzInterakcje();
    const eBlisko = !!wejscie.interakcja && !!this.bliskaInterakcja;
    if (wejscie.interakcja || wejscie.przeladuj) {
      if (wejscie.interakcja) this.wykonajInterakcje();
      if (wejscie.przeladuj) this.zacznijPrzeladowanie();
    }
    if (this.scena !== "gran") return;

    const doPrzodu = (wejscie.przod ? 1 : 0) - (wejscie.tyl ? 1 : 0);
    const naBok =
      (wejscie.prawo ? 1 : 0) -
      (wejscie.lewo ? 1 : 0) +
      (wejscie.strafePrawo && !eBlisko ? 1 : 0) -
      (wejscie.strafeLewo ? 1 : 0);
    const dlugosc = Math.hypot(doPrzodu, naBok) || 1;

    g.sprint =
      !!wejscie.sprint && !g.kuc && !g.cel && g.wytrzymalosc > 1 && doPrzodu > 0;
    if (g.sprint) g.wytrzymalosc = Math.max(0, g.wytrzymalosc - dt * 26);
    else g.wytrzymalosc = Math.min(100, g.wytrzymalosc + dt * 18);

    let predkosc = K.PREDKOSC * this.postac.szybkosc;
    if (g.sprint) predkosc *= K.MNOZNIK_SPRINTU;
    if (g.kuc) predkosc *= K.MNOZNIK_KUCU;
    if (g.cel) predkosc *= K.MNOZNIK_CELU;

    const kierunekX = Math.sin(g.yaw);
    const kierunekZ = -Math.cos(g.yaw);
    const dx =
      (kierunekX * doPrzodu + Math.cos(g.yaw) * naBok) / dlugosc * predkosc * dt;
    const dz =
      (kierunekZ * doPrzodu + Math.sin(g.yaw) * naBok) / dlugosc * predkosc * dt;
    const wysokosc = g.kuc ? K.WZROST_KUC : K.WZROST;
    this.przesunObiekt(g, dx, dz, K.PROMIEN_GRACZA, wysokosc, g.y);

    // Grawitacja, skok i lądowanie na skrzyniach.
    if (wejscie.skok && g.naZiemi && !g.kuc) {
      g.vy = K.SILA_SKOKU * (g.sprint ? 1.08 : 1);
      g.naZiemi = false;
      this.dodajZdarzenie({ typ: "skok" });
    }
    const poprzednieY = g.y;
    g.vy -= K.GRAVITACJA * dt;
    g.y += g.vy * dt;
    g.naZiemi = false;
    if (g.y <= 0) {
      g.y = 0;
      g.vy = 0;
      g.naZiemi = true;
    } else {
      for (const p of this.przeszkody) {
        if (!p.aktywny) continue;
        if (
          g.x + K.PROMIEN_GRACZA > p.minX &&
          g.x - K.PROMIEN_GRACZA < p.maxX &&
          g.z + K.PROMIEN_GRACZA > p.minZ &&
          g.z - K.PROMIEN_GRACZA < p.maxZ &&
          g.vy <= 0 &&
          poprzednieY >= p.maxY - 0.09 &&
          g.y <= p.maxY
        ) {
          g.y = p.maxY;
          g.vy = 0;
          g.naZiemi = true;
          break;
        }
      }
    }

    // Strzelanie i przeładowanie.
    g.czasStrzalu = Math.max(0, g.czasStrzalu - dt);
    if (g.czasPrzeladowania > 0) {
      g.czasPrzeladowania -= dt;
      if (g.czasPrzeladowania <= 0) {
        g.czasPrzeladowania = 0;
        this.zakonczPrzeladowanie();
      }
    }
    const chceStrzelac = !!wejscie.strzelaj;
    if (chceStrzelac && g.magazynki[g.bron] <= 0 && g.czasPrzeladowania <= 0) {
      this.zacznijPrzeladowanie();
    } else if (
      chceStrzelac &&
      g.czasStrzalu <= 0 &&
      g.czasPrzeladowania <= 0 &&
      (b.automatyczna || !g.poprzedniaStrona)
    ) {
      this.strzelaj();
    }
    g.poprzedniaStrona = chceStrzelac ? 1 : 0;

    const ruch = Math.hypot(dx, dz) / Math.max(dt, 1e-5);
    const rozproszenieBazowe = g.cel ? b.rozproszenieCel : b.rozproszenie;
    g.rozproszenie =
      rozproszenieBazowe *
      this.postac.celność *
      (g.kuc ? 0.8 : 1) *
      (ruch > 0.4 ? 1.3 : 1);

    this.aktualizujWrogow(dt);
    this.bliskaInterakcja = this.znajdzInterakcje();
  }

  pobierzHud() {
    const g = this.gracz;
    const b = this.bron;
    return {
      stan: this.scena,
      imie: this.imie,
      postac: this.postac.nazwa,
      kolor: this.postac.kolor,
      zycie: Math.ceil(g.zycie),
      maxZycie: g.maxZycie,
      wytrzymalosc: Math.round(g.wytrzymalosc),
      bron: g.bron,
      nazwaBroni: b.nazwa,
      magazynek: g.magazynki[g.bron],
      zapas: g.zapasy[g.bron],
      rozmiarMagazynka: b.magazynek,
      przeladowanie: g.czasPrzeladowania > 0,
      postepPrzeladowania: g.czasPrzeladowania > 0 ? 1 - g.czasPrzeladowania / b.czasPrzeladowania : 1,
      wrogowie: this.pozostaloWrogow,
      zabici: this.zabici,
      czas: this.czas,
      cel: g.cel,
      kuc: g.kuc,
      sprint: g.sprint,
      zoom: this.powiekszenie,
      luneta: !!b.luneta,
      rozproszenie: g.rozproszenie,
      interakcja: this.etykietaInterakcji(),
      terminal: this.terminalAktywny,
      wiadomosc: this.czasWiadomosci > 0 ? this.wiadomosc : "",
      celność: Math.round((this.trafienia / Math.max(1, this.oddaneStrzaly)) * 100),
    };
  }
}

export { promienBox };
