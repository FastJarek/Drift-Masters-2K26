// Uproszczony model lotu: siły (ciąg, opór, siła nośna, grawitacja),
// przeciągnięcie, bank-to-turn, paliwo, lądowanie i autopilot.
// Moduł nie zależy od Three.js ani DOM – można go testować w Node.

const K = {
  MASA: 1200, // kg
  G: 9.81,
  GESTOSC: 1.225, // kg/m^3 (stała – wersja wybaczająca)
  POWIERZCHNIA: 16, // m^2
  CL0: 0.28,
  CL_ALPHA: 5.0, // na radian
  CL_MAX: 1.45,
  ALPHA_STALL: 0.24, // ~14 stopni
  CD0: 0.032,
  CD_INDUKOWANY: 0.055,
  CD_PODWOZIE: 0.018,
  CD_KLAPY: 0.045,
  CL_KLAPY: 0.45,
  CIAG_MAX: 12000, // N
  MAX_PITCH_RATE: 1.1, // rad/s
  MAX_ROLL_RATE: 2.0, // rad/s
  MAX_YAW_RATE: 0.5, // rad/s
  REAKCJA: 3.2, // jak szybko ster osiąga zadaną prędkość kątową
  SKRZYDLA: 11, // rozpiętość (tylko do wizualizacji w innym module)
  DLUGOSC_PASA: 400,
  SZEROKOSC_PASA: 40,
  POJEMNOSC_PALIWA: 100,
  ZUZYCIE_PALIWA: 0.05 + 0.25, // bazowe + pełny gaz (%/s)
  TARCIE_ZIEMIA: 0.06,
  TARCIE_HAMULEC: 2.0,
  PREDKOSC_AUTPILOTA: 45,
  WYSOKOSC_AUTPILOTA: 150,
  PROMIEN_PUNKTU: 150,
};

K.SZEROKOSC_PASA_POLOWA = K.SZEROKOSC_PASA / 2;

export { K };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v) => Math.hypot(v.x, v.y, v.z);

export function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export class FizykaLotu {
  constructor() {
    this.reset();
  }

  reset() {
    this.pozycja = { x: 0, y: 0.9, z: 170 };
    this.predkosc = { x: 0, y: 0, z: 0 };
    this.heading = 0; // 0 = północ (-z)
    this.pitch = 0;
    this.roll = 0;
    this.pitchRate = 0;
    this.rollRate = 0;
    this.yawRate = 0;
    this.throttle = 0;
    this.gear = true;
    this.flaps = false;
    this.brakes = false;
    this.fuel = K.POJEMNOSC_PALIWA;
    this.engineOn = true;
    this.autopilot = false;
    this.waypoints = [];
    this.celIndex = 0;
    this.stall = false;
    this.naZiemi = true;
    this.byloWSzpowietrzu = false;
    this.crashed = false;
    this.komunikat = "Gotowy do startu – dodaj gaz (Shift)";
    this.czasKomunikatu = -1; // -1 = bez wygaśnięcia
    this.czasLotu = 0;
    this.obrityProp = 0;
  }

  ustawKomunikat(tekst, czas = 3.5) {
    this.komunikat = tekst;
    this.czasKomunikatu = czas;
  }

  get predkoscWartosc() {
    return length(this.predkosc);
  }

  get predkoscKmh() {
    return this.predkoscWartosc * 3.6;
  }

  get verticalSpeed() {
    return this.predkosc.y;
  }

  get wysokosc() {
    return Math.max(0, this.pozycja.y);
  }

  get headingStopnie() {
    return ((this.heading * 180) / Math.PI + 360) % 360;
  }

  get wektorForward() {
    const sh = Math.sin(this.heading);
    const ch = Math.cos(this.heading);
    const sp = Math.sin(this.pitch);
    const cp = Math.cos(this.pitch);
    return { x: sh * cp, y: sp, z: -ch * cp };
  }

  get wektorUp() {
    const sh = Math.sin(this.heading);
    const ch = Math.cos(this.heading);
    const sp = Math.sin(this.pitch);
    const cp = Math.cos(this.pitch);
    const sr = Math.sin(this.roll);
    const cr = Math.cos(this.roll);
    return {
      x: -sh * sp * cr + ch * sr,
      y: cp * cr,
      z: ch * sp * cr + sh * sr,
    };
  }

  get wektorRight() {
    const sh = Math.sin(this.heading);
    const ch = Math.cos(this.heading);
    const sp = Math.sin(this.pitch);
    const cp = Math.cos(this.pitch);
    const sr = Math.sin(this.roll);
    const cr = Math.cos(this.roll);
    return {
      x: ch * cr + sh * sp * sr,
      y: -cp * sr,
      z: sh * cr - ch * sp * sr,
    };
  }

  dodajPunkt(x, z) {
    this.waypoints.push({ x, z, alt: K.WYSOKOSC_AUTPILOTA });
  }

  usunOstatniPunkt() {
    return this.waypoints.pop() || null;
  }

  wyczyscTrase() {
    this.waypoints = [];
    this.celIndex = 0;
  }

  ustawAutopilot(wlaczone) {
    if (wlaczone && this.waypoints.length === 0) {
      this.ustawKomunikat("Najpierw zaznacz punkty trasy na minimapie");
      return false;
    }
    this.autopilot = wlaczone;
    if (wlaczone) {
      this.celIndex = 0;
      this.ustawKomunikat("Autopilot włączony");
    } else {
      this.ustawKomunikat("Autopilot wyłączony");
    }
    return true;
  }

  sterowanieAutopilotem() {
    const ster = { pitch: 0, roll: 0, yaw: 0, throttle: 0.4 };

    if (this.naZiemi) {
      const start = this.waypoints[0];
      if (start) {
        const pozadanKurs = Math.atan2(start.x - this.pozycja.x, -(start.z - this.pozycja.z));
        ster.roll = clamp(normalizeAngle(pozadanKurs - this.heading) * 0.35, -0.35, 0.35);
      }
      ster.throttle = 1;
      ster.pitch = this.predkoscWartosc > 32 ? 0.45 : 0;
      return ster;
    }

    const cel = this.waypoints[this.celIndex];
    if (cel) {
      const dx = cel.x - this.pozycja.x;
      const dz = cel.z - this.pozycja.z;
      const dystans = Math.hypot(dx, dz);
      if (dystans < K.PROMIEN_PUNKTU) {
        this.celIndex += 1;
        if (this.celIndex >= this.waypoints.length) {
          this.ustawAutopilot(false);
          ster.throttle = 0.45;
          this.ustawKomunikat("Trasa ukończona – autopilot wyłączony");
          return ster;
        }
      }
    }

    const cel2 = this.waypoints[this.celIndex];
    const celAlt = cel2 ? cel2.alt : K.WYSOKOSC_AUTPILOTA;
    const bladKursu = cel2
      ? normalizeAngle(
          Math.atan2(cel2.x - this.pozycja.x, -(cel2.z - this.pozycja.z)) - this.heading
        )
      : -this.roll;

    // PD na kącie przechyłu zamiast bezpośredniego steru – nie pozwala
    // samolotowi "zwariować" przy dużym błędzie kursu.
    const maxBank = this.pozycja.y < 120 ? 0.4 : 1.0;
    const zadanyRoll = clamp(bladKursu * 0.8, -maxBank, maxBank);
    ster.roll = clamp((zadanyRoll - this.roll) * 1.6 - this.rollRate * 0.5, -1, 1);
    ster.yaw = clamp(bladKursu * 0.12, -1, 1);

    // PD na kącie wysokości: ster dąży do zadanego kąta, a nie rośnie w nieskończoność.
    const bankComp = (1 / Math.max(0.4, Math.cos(this.roll)) - 1) * 0.3;
    const zadanyPitch =
      this.pozycja.y < 120
        ? clamp(0.25 + (120 - this.pozycja.y) * 0.002 - this.predkosc.y * 0.03, 0.1, 0.4)
        : clamp((celAlt - this.pozycja.y) * 0.005 - this.predkosc.y * 0.05 + bankComp, -0.25, 0.4);
    ster.pitch = clamp((zadanyPitch - this.pitch) * 1.8 - this.pitchRate * 0.4, -1, 1);
    ster.throttle = clamp((K.PREDKOSC_AUTPILOTA - this.predkoscWartosc) * 0.08, 0.12, 1);
    return ster;
  }

  crash(powod) {
    this.crashed = true;
    this.crashTimer = 2.5;
    this.ustawKomunikat(powod, 2.5);
  }

  krok(dt, ster) {
    if (this.crashed) {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0) this.reset();
      return;
    }

    if (this.czasKomunikatu > 0) {
      this.czasKomunikatu -= dt;
    }

    if (this.autopilot) ster = this.sterowanieAutopilotem();

    ster = ster || {};
    const wejPitch = clamp(ster.pitch || 0, -1, 1);
    const wejRoll = clamp(ster.roll || 0, -1, 1);
    const wejYaw = clamp(ster.yaw || 0, -1, 1);
    this.brakes = Boolean(ster.brakes);
    if (ster.throttle !== undefined) {
      this.throttle = clamp(ster.throttle, 0, 1);
    }
    if (ster.gear !== undefined && ster.gear !== this.gear) {
      if (this.naZiemi && !ster.gear) {
        this.ustawKomunikat("Nie można schować podwozia na ziemi");
      } else {
        this.gear = ster.gear;
      }
    }
    if (ster.flaps !== undefined && ster.flaps !== this.flaps) {
      this.flaps = ster.flaps;
    }

    // Paliwo i silnik.
    if (this.fuel > 0 && this.engineOn) {
      this.fuel = Math.max(
        0,
        this.fuel - (0.05 + 0.25 * this.throttle) * dt
      );
      if (this.fuel === 0) {
        this.engineOn = false;
        this.ustawKomunikat("Brak paliwa – lecimy jako szybowiec");
      }
    }

    // Dynamika kątowa (sterownice dążą do zadanej prędkości kątowej).
    this.pitchRate += (wejPitch * K.MAX_PITCH_RATE - this.pitchRate) * K.REAKCJA * dt;
    this.rollRate += (wejRoll * K.MAX_ROLL_RATE - this.rollRate) * K.REAKCJA * dt;
    this.yawRate += (wejYaw * K.MAX_YAW_RATE - this.yawRate) * K.REAKCJA * dt;
    this.pitch = clamp(this.pitch + this.pitchRate * dt, -1.05, 1.05);
    if (this.naZiemi) this.pitch = clamp(this.pitch, -0.1, 0.25);
    this.roll = normalizeAngle(this.roll + this.rollRate * dt);
    if (this.naZiemi) this.roll = clamp(this.roll, -0.18, 0.18);

    // Skręt z przechyłu (bank-to-turn) + ster kierunku.
    const zwrotZBanku =
      (K.G * Math.tan(this.roll)) / Math.max(this.predkoscWartosc, 12);
    this.heading = normalizeAngle(
      this.heading + (zwrotZBanku + this.yawRate * 0.35) * dt
    );

    const forward = this.wektorForward;
    const up = this.wektorUp;
    const right = this.wektorRight;

    // Kąt natarcia i prędkość w układzie samolotu.
    const vForward = dot(this.predkosc, forward);
    const vUp = dot(this.predkosc, up);
    const vRight = dot(this.predkosc, right);
    const alpha = Math.atan2(-vUp, Math.max(vForward, 0.1));
    const beta = Math.atan2(vRight, Math.max(vForward, 0.1));

    let CL = K.CL0 + K.CL_ALPHA * alpha + (this.flaps ? K.CL_KLAPY : 0);
    CL = clamp(CL, -K.CL_MAX, K.CL_MAX);
    if (Math.abs(alpha) > K.ALPHA_STALL) {
      const nadmiar = Math.abs(alpha) - K.ALPHA_STALL;
      CL *= Math.max(0.2, 1 - nadmiar * 2.5);
    }
    this.stall = Math.abs(alpha) > K.ALPHA_STALL && this.predkoscWartosc > 8;

    const CD =
      K.CD0 +
      K.CD_INDUKOWANY * CL * CL +
      (this.gear ? K.CD_PODWOZIE : 0) +
      (this.flaps ? K.CD_KLAPY : 0);

    const q = 0.5 * K.GESTOSC * this.predkoscWartosc ** 2;
    const sila = q * K.POWIERZCHNIA;
    const vet = this.predkoscWartosc > 0.01
      ? {
          x: this.predkosc.x / this.predkoscWartosc,
          y: this.predkosc.y / this.predkoscWartosc,
          z: this.predkosc.z / this.predkoscWartosc,
        }
      : { x: 0, y: 0, z: 0 };

    const ciag = this.engineOn ? K.CIAG_MAX * this.throttle : 0;
    const F = {
      x: ciag * forward.x + sila * CL * up.x - sila * CD * vet.x - sila * 0.35 * beta * right.x,
      y: ciag * forward.y + sila * CL * up.y - sila * CD * vet.y - sila * 0.35 * beta * right.y - K.MASA * K.G,
      z: ciag * forward.z + sila * CL * up.z - sila * CD * vet.z - sila * 0.35 * beta * right.z,
    };

    this.predkosc.x += (F.x / K.MASA) * dt;
    this.predkosc.y += (F.y / K.MASA) * dt;
    this.predkosc.z += (F.z / K.MASA) * dt;
    this.pozycja.x += this.predkosc.x * dt;
    this.pozycja.y += this.predkosc.y * dt;
    this.pozycja.z += this.predkosc.z * dt;

    this.obrityProp += (4 + this.throttle * 28) * dt;
    this.czasLotu += dt;

    // Kontakt z ziemią.
    if (this.pozycja.y <= 0) {
      const vertical = this.predkosc.y;
      if (!this.gear) {
        this.crash("Lądowanie bez podwozia!");
        return;
      }
      if (vertical < -4.5) {
        this.crash("Lądowanie zbyt twarde!");
        return;
      }
      if (
        vertical < -0.5 &&
        (Math.abs(this.roll) > 0.45 || Math.abs(this.pitch) > 0.35)
      ) {
        this.crash("Nieprawidłowa pozycja przy lądowaniu!");
        return;
      }

      const ladowanie = this.byloWSzpowietrzu && vertical < -0.4;
      this.pozycja.y = 0;
      if (vertical < 0) this.predkosc.y = 0;
      this.naZiemi = true;
      this.byloWSzpowietrzu = false;

      const hamowanie = this.brakes ? K.TARCIE_HAMULEC : K.TARCIE_ZIEMIA;
      const tarcie = Math.exp(-hamowanie * dt);
      this.predkosc.x *= tarcie;
      this.predkosc.z *= tarcie;
      this.pitch += (0 - this.pitch) * Math.min(1, dt * 4);
      this.roll += (0 - this.roll) * Math.min(1, dt * 4);

      const naPasie =
        Math.abs(this.pozycja.x) < K.SZEROKOSC_PASA_POLOWA &&
        Math.abs(this.pozycja.z) < K.DLUGOSC_PASA / 2;
      if (ladowanie && this.czasKomunikatu <= 0) {
        this.ustawKomunikat(
          naPasie ? "Lądowanie na pasie udane" : "Lądowanie udane"
        );
      }
      if (this.predkoscWartosc < 1.5 && this.fuel < K.POJEMNOSC_PALIWA) {
        this.fuel = K.POJEMNOSC_PALIWA;
        this.engineOn = true;
        this.ustawKomunikat("Tankowanie zakończone – pełny zbiornik", 3);
      }
    } else {
      this.naZiemi = false;
      this.byloWSzpowietrzu = true;
    }
  }
}
