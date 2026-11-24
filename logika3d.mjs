// Czysta logika gry 3D – bez Three.js, żeby można było ją testować w Node.

const K = {
  DROGA_SZER: 9,
  LICZBA_PASOW: 3,
  AUTO_SZER: 1.3,
  AUTO_DL: 2.2,
  PREDKOSC_GRACZA: 9.5,
  PREDKOSC_NPC: 8,
  ODSTEP_NPC: 0.95,
  PUNKTY_NA_SEK: 10,
  LICZBA_ZYC: 3,
  CZAS_NIEZRANIALNOSCI: 1.5,
  Z_SPAWNU: -42,
  Z_KONCA: 12,
};

K.POL_DROGI = K.DROGA_SZER / 2;
K.SZEROKOSC_PASA = K.DROGA_SZER / K.LICZBA_PASOW;
Object.freeze(K);

export { K };

export class Gra3D {
  constructor() {
    this.nastepnyId = 0;
    this.najlepszyWynik = 0;
    try {
      this.najlepszyWynik =
        Number(localStorage.getItem("omijaj-3d-najlepszy")) || 0;
    } catch (_) {
      // Pamięć lokalna może być niedostępna – gra działa też bez niej.
    }
    this.reset();
  }

  reset() {
    this.gracz = { x: 0, z: 0 };
    this.npc = [];
    this.czasOdNpc = 0;
    this.punkty = 0;
    this.zycia = K.LICZBA_ZYC;
    this.czasNiezr = 0;
    this.scena = "gran";
  }

  aktualizuj(dt, lewo = false, prawo = false) {
    if (this.scena === "koniec") return;

    this.punkty += K.PUNKTY_NA_SEK * dt;
    this.czasNiezr = Math.max(0, this.czasNiezr - dt);

    const kierunek = (prawo ? 1 : 0) - (lewo ? 1 : 0);
    this.gracz.x += kierunek * K.PREDKOSC_GRACZA * dt;
    const granica = K.POL_DROGI - K.AUTO_SZER / 2;
    this.gracz.x = Math.max(-granica, Math.min(this.gracz.x, granica));

    this.czasOdNpc += dt;
    while (this.czasOdNpc >= K.ODSTEP_NPC) {
      this.czasOdNpc -= K.ODSTEP_NPC;
      const pas = Math.floor(Math.random() * K.LICZBA_PASOW);
      const x =
        -K.POL_DROGI + pas * K.SZEROKOSC_PASA + K.SZEROKOSC_PASA / 2;
      this.npc.push({ id: this.nastepnyId++, x, z: K.Z_SPAWNU });
    }

    for (const auto of this.npc) auto.z += K.PREDKOSC_NPC * dt;
    this.npc = this.npc.filter((auto) => auto.z < K.Z_KONCA);

    if (this.czasNiezr <= 0) {
      const indeks = this.npc.findIndex(
        (auto) =>
          Math.abs(auto.x - this.gracz.x) < K.AUTO_SZER &&
          Math.abs(auto.z - this.gracz.z) < K.AUTO_DL
      );
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
              "omijaj-3d-najlepszy",
              String(this.najlepszyWynik)
            );
          } catch (_) {
            // Ignorujemy brak dostępu do pamięci lokalnej.
          }
          this.scena = "koniec";
        }
      }
    }
  }
}
