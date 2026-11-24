// Strzelanka 3D – rendering w Three.js, sterowanie wyłącznie myszą i klawiaturą.
// Logika gry jest w logika-strzelca.mjs (można ją testować w Node).

import * as THREE from "three";
import { GraStrzelec, POSTACIE, BRONIE, K } from "./logika-strzelca.mjs";

const $ = (id) => document.getElementById(id);
const canvas = $("gra");
const gra = new GraStrzelec({ postac: POSTACIE[0], imie: "" });

/* ------------------------------------------------------------------ */
/* Renderer, scena, kamery                                             */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const scena = new THREE.Scene();
scena.background = new THREE.Color(0x0d1a22);
scena.fog = new THREE.Fog(0x0d1a22, 26, 78);

const kamera = new THREE.PerspectiveCamera(76, 1, 0.05, 220);
kamera.rotation.order = "YXZ";
scena.add(kamera);

// Osobna scena broni – dzięki temu model nie przenika przez ściany.
const scenaBroni = new THREE.Scene();
const kameraBroni = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
scenaBroni.add(new THREE.HemisphereLight(0xffffff, 0x33404a, 2.1));
const swiatloBroni = new THREE.DirectionalLight(0xffffff, 2.4);
swiatloBroni.position.set(-2, 4, 3);
scenaBroni.add(swiatloBroni);
const grupaBroni = new THREE.Group();
scenaBroni.add(grupaBroni);

function zmienRozmiar() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h, false);
  kamera.aspect = w / h;
  kamera.updateProjectionMatrix();
  kameraBroni.aspect = w / h;
  kameraBroni.updateProjectionMatrix();
}
window.addEventListener("resize", zmienRozmiar);
window.visualViewport?.addEventListener("resize", zmienRozmiar);
zmienRozmiar();

/* ------------------------------------------------------------------ */
/* Światło i otoczenie                                                 */
/* ------------------------------------------------------------------ */

scena.add(new THREE.HemisphereLight(0xbcd8ff, 0x25322c, 1.05));
const slonce = new THREE.DirectionalLight(0xffe4ba, 1.5);
slonce.position.set(16, 26, 12);
slonce.castShadow = true;
slonce.shadow.mapSize.set(1024, 1024);
slonce.shadow.camera.left = -26;
slonce.shadow.camera.right = 26;
slonce.shadow.camera.top = 26;
slonce.shadow.camera.bottom = -26;
slonce.shadow.camera.near = 1;
slonce.shadow.camera.far = 80;
slonce.shadow.bias = -0.0006;
scena.add(slonce);

function teksturaPodloza() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#28343a";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const n = 22 + Math.floor(Math.random() * 32);
    ctx.fillStyle = `rgba(${n},${n + 5},${n + 4},0.5)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = "rgba(155,185,160,0.12)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

const podloga = new THREE.Mesh(
  new THREE.PlaneGeometry(44, 44),
  new THREE.MeshStandardMaterial({ map: teksturaPodloza(), roughness: 0.96 })
);
podloga.rotation.x = -Math.PI / 2;
podloga.position.y = -0.015;
podloga.receiveShadow = true;
scena.add(podloga);

const materialy = {
  mur: new THREE.MeshStandardMaterial({ color: 0x59645f, roughness: 0.9 }),
  skrzynia: new THREE.MeshStandardMaterial({ color: 0x8a704b, roughness: 0.85 }),
  kontener: new THREE.MeshStandardMaterial({ color: 0x3d6f68, roughness: 0.8, metalness: 0.15 }),
  brama: new THREE.MeshStandardMaterial({
    color: 0x9c3b36,
    roughness: 0.6,
    metalness: 0.35,
    emissive: 0x521512,
    emissiveIntensity: 0.5,
  }),
};

const siatkaKrawedzi = new THREE.LineBasicMaterial({
  color: 0x121c1c,
  transparent: true,
  opacity: 0.55,
});

const meszePrzeszkod = new Map();
for (const p of gra.przeszkody) {
  const sx = p.maxX - p.minX;
  const sy = p.maxY - p.minY;
  const sz = p.maxZ - p.minZ;
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mesh = new THREE.Mesh(geo, materialy[p.typ]);
  mesh.position.set((p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2, (p.minZ + p.maxZ) / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (p.typ === "skrzynia" || p.typ === "kontener") {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), siatkaKrawedzi));
  }
  if (p.typ === "brama") {
    for (let i = -2; i <= 2; i++) {
      const pasek = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, sy + 0.02, sz + 0.03),
        new THREE.MeshStandardMaterial({
          color: 0xffcf6b,
          emissive: 0xffa536,
          emissiveIntensity: 0.8,
        })
      );
      pasek.position.x = i * 1.3;
      mesh.add(pasek);
    }
  }
  scena.add(mesh);
  meszePrzeszkod.set(p.id, mesh);
}

// Strefa ewakuacji.
const strefa = new THREE.Group();
strefa.position.set(gra.wyjscie.x, 0.02, gra.wyjscie.z);
const plyta = new THREE.Mesh(
  new THREE.CircleGeometry(2.1, 48),
  new THREE.MeshBasicMaterial({ color: 0x39ff9a, transparent: true, opacity: 0.12, depthWrite: false })
);
plyta.rotation.x = -Math.PI / 2;
strefa.add(plyta);
const pierScien = new THREE.Mesh(
  new THREE.RingGeometry(1.85, 2.1, 48),
  new THREE.MeshBasicMaterial({ color: 0x7effb4, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
);
pierScien.rotation.x = -Math.PI / 2;
strefa.add(pierScien);
const slup = new THREE.Mesh(
  new THREE.CylinderGeometry(1.5, 1.9, 6, 24, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x54ffae,
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
);
slup.position.y = 3;
strefa.add(slup);
const swiatloEwakuacji = new THREE.PointLight(0x5cffb0, 1.6, 12);
swiatloEwakuacji.position.y = 2.4;
strefa.add(swiatloEwakuacji);
scena.add(strefa);

// Terminal.
const terminalGrupa = new THREE.Group();
terminalGrupa.position.set(gra.terminal.x, 0, gra.terminal.z);
const terminalPodstawa = new THREE.Mesh(
  new THREE.BoxGeometry(1.1, 1.15, 0.75),
  new THREE.MeshStandardMaterial({ color: 0x33424a, roughness: 0.7, metalness: 0.3 })
);
terminalPodstawa.position.y = 0.58;
terminalPodstawa.castShadow = true;
terminalGrupa.add(terminalPodstawa);
const ekranMaterial = new THREE.MeshStandardMaterial({
  color: 0xffa23c,
  emissive: 0xff7a1c,
  emissiveIntensity: 1.1,
});
const ekran = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.45), ekranMaterial);
ekran.position.set(0, 1.0, 0.39);
ekran.rotation.x = -0.3;
terminalGrupa.add(ekran);
const swiatloTerminala = new THREE.PointLight(0xffa442, 1.2, 7);
swiatloTerminala.position.set(0, 1.1, 0.8);
terminalGrupa.add(swiatloTerminala);
scena.add(terminalGrupa);

// Latarnie dla klimatu.
for (const [x, z] of [[-17, -17], [17, 17], [-17, 17]]) {
  const latarnia = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 4.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x46514f, roughness: 0.7 })
  );
  latarnia.position.set(x, 2.25, z);
  latarnia.castShadow = true;
  scena.add(latarnia);
  const zarowka = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffdca0 })
  );
  zarowka.position.set(x, 4.55, z);
  scena.add(zarowka);
  const swiatlo = new THREE.PointLight(0xffd7a0, 0.75, 14);
  swiatlo.position.set(x, 4.4, z);
  scena.add(swiatlo);
}

/* ------------------------------------------------------------------ */
/* Modele broni (widok pierwszoosobowy)                                */
/* ------------------------------------------------------------------ */

function prostopadloscian(rodzic, w, h, d, kolor, x, y, z, opcje = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: kolor,
      roughness: opcje.roughness ?? 0.55,
      metalness: opcje.metalness ?? 0.35,
      emissive: opcje.emissive ?? 0x000000,
      emissiveIntensity: opcje.emissiveIntensity ?? 0,
    })
  );
  mesh.position.set(x, y, z);
  rodzic.add(mesh);
  return mesh;
}

function walec(rodzic, r, d, kolor, x, y, z, obrot = Math.PI / 2) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, d, 14),
    new THREE.MeshStandardMaterial({ color: kolor, roughness: 0.4, metalness: 0.6 })
  );
  mesh.rotation.x = obrot;
  mesh.position.set(x, y, z);
  rodzic.add(mesh);
  return mesh;
}

function zbudujPistolet() {
  const g = new THREE.Group();
  const metal = 0x262c30;
  prostopadloscian(g, 0.12, 0.13, 0.42, metal, 0, 0, -0.05);
  prostopadloscian(g, 0.105, 0.05, 0.34, 0x3b4448, 0, 0.08, -0.08);
  prostopadloscian(g, 0.1, 0.26, 0.13, 0x6b543d, 0, -0.18, 0.09, { metalness: 0.05 });
  prostopadloscian(g, 0.02, 0.035, 0.02, 0x111111, 0, -0.07, 0.0);
  walec(g, 0.025, 0.05, 0x15191b, 0, 0.01, -0.28);
  return { grupa: g, wylot: new THREE.Vector3(0, 0.01, -0.32) };
}

function zbudujAK() {
  const g = new THREE.Group();
  prostopadloscian(g, 0.14, 0.16, 0.52, 0x2b322b, 0, 0.02, -0.08);
  prostopadloscian(g, 0.12, 0.1, 0.36, 0x4a3b2a, 0, 0.02, -0.46, { metalness: 0.1 });
  walec(g, 0.022, 0.4, 0x181d1c, 0, 0.02, -0.76);
  walec(g, 0.037, 0.08, 0x202623, 0, 0.02, -0.96);
  prostopadloscian(g, 0.115, 0.34, 0.12, 0x4b3927, 0, -0.22, -0.08, { metalness: 0.08 });
  prostopadloscian(g, 0.11, 0.16, 0.26, 0x4a3b2a, 0, -0.09, 0.31, { metalness: 0.1 });
  prostopadloscian(g, 0.05, 0.06, 0.05, 0x151818, 0, 0.14, -0.24);
  prostopadloscian(g, 0.02, 0.05, 0.02, 0x151818, 0, -0.08, 0.04);
  return { grupa: g, wylot: new THREE.Vector3(0, 0.02, -1.03) };
}

function zbudujM24() {
  const g = new THREE.Group();
  prostopadloscian(g, 0.13, 0.17, 0.5, 0x26302c, 0, 0, -0.02);
  prostopadloscian(g, 0.12, 0.17, 0.42, 0x5a4630, 0, -0.02, 0.4, { metalness: 0.08 });
  prostopadloscian(g, 0.1, 0.22, 0.16, 0x5a4630, 0, -0.12, 0.58, { metalness: 0.08 });
  walec(g, 0.023, 0.62, 0x171c1b, 0, 0.01, -0.56);
  walec(g, 0.034, 0.09, 0x202623, 0, 0.01, -0.89);
  walec(g, 0.055, 0.36, 0x1c2221, 0, 0.16, -0.11);
  walec(g, 0.072, 0.06, 0x111514, 0, 0.16, -0.31);
  walec(g, 0.072, 0.06, 0x111514, 0, 0.16, 0.07);
  prostopadloscian(g, 0.06, 0.06, 0.06, 0x8a8f8a, 0.12, 0.0, -0.3);
  prostopadloscian(g, 0.02, 0.06, 0.02, 0x151818, 0, -0.09, 0.0);
  return { grupa: g, wylot: new THREE.Vector3(0, 0.01, -0.95) };
}

const modeleBroni = [zbudujPistolet(), zbudujAK(), zbudujM24()];
const blyski = [];
modeleBroni.forEach((model, i) => {
  model.grupa.visible = i === 0;
  const blysk = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.26, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9 })
  );
  blysk.rotation.x = -Math.PI / 2;
  blysk.position.copy(model.wylot);
  blysk.visible = false;
  model.grupa.add(blysk);
  blyski.push(blysk);
  grupaBroni.add(model.grupa);
});

/* ------------------------------------------------------------------ */
/* Wrogowie, przedmioty, efekty                                        */
/* ------------------------------------------------------------------ */

const wizualniWrogowie = new Map();
const wizualnePrzedmioty = new Map();
const efekty = [];

function stworzWroga(w) {
  const grupa = new THREE.Group();
  const mundur = new THREE.MeshStandardMaterial({ color: 0x70443c, roughness: 0.85 });
  const pancerz = new THREE.MeshStandardMaterial({ color: 0x2f3a35, roughness: 0.7, metalness: 0.2 });
  const skora = new THREE.MeshStandardMaterial({ color: 0xc7a17a, roughness: 0.9 });

  const korpus = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.82, 0.42), mundur);
  korpus.position.y = 1.1;
  korpus.castShadow = true;
  grupa.add(korpus);

  const kamizelka = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.48, 0.46), pancerz);
  kamizelka.position.y = 1.2;
  kamizelka.castShadow = true;
  grupa.add(kamizelka);

  const glowa = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skora);
  glowa.position.y = 1.68;
  glowa.castShadow = true;
  grupa.add(glowa);

  const hełm = new THREE.Mesh(
    new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    pancerz
  );
  hełm.position.y = 1.72;
  grupa.add(hełm);

  const wizjer = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.055, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xff5340 })
  );
  wizjer.position.set(0, 1.68, -0.19);
  grupa.add(wizjer);

  const nogi = [];
  for (const x of [-0.16, 0.16]) {
    const noga = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), mundur);
    noga.position.set(x, 0.36, 0);
    noga.castShadow = true;
    grupa.add(noga);
    nogi.push(noga);
  }
  const rece = [];
  for (const x of [-0.38, 0.38]) {
    const reka = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), mundur);
    reka.position.set(x, 1.05, -0.1);
    reka.rotation.x = -0.5;
    grupa.add(reka);
    rece.push(reka);
  }
  const karabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.75),
    new THREE.MeshStandardMaterial({ color: 0x202624, metalness: 0.5, roughness: 0.5 })
  );
  karabin.position.set(0.18, 1.0, -0.42);
  grupa.add(karabin);

  const pasekTlo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x101614, transparent: true, opacity: 0.8 })
  );
  pasekTlo.position.set(0, 2.14, 0);
  grupa.add(pasekTlo);
  const pasekFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff5d5d })
  );
  pasekFill.position.set(0, 2.14, 0.01);
  grupa.add(pasekFill);

  grupa.position.set(w.x, w.y, w.z);
  grupa.userData = { mundur, pancerz, wizjer, pasekFill, pasekTlo, nogi, rece, hp: w.hp, flash: 0 };
  scena.add(grupa);
  return grupa;
}

function stworzPrzedmiot(p, indeks) {
  const grupa = new THREE.Group();
  if (p.typ === "apteczka") {
    const pudelko = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.32, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xe8eee8, roughness: 0.6 })
    );
    pudelko.castShadow = true;
    grupa.add(pudelko);
    const krzyz1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.07, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff4d4d })
    );
    krzyz1.position.z = -0.23;
    grupa.add(krzyz1);
    const krzyz2 = krzyz1.clone();
    krzyz2.rotation.z = Math.PI / 2;
    grupa.add(krzyz2);
  } else {
    const skrzynka = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.4, 0.46),
      new THREE.MeshStandardMaterial({ color: 0x6e7643, roughness: 0.8 })
    );
    skrzynka.castShadow = true;
    grupa.add(skrzynka);
    for (const y of [-0.11, 0.11]) {
      const pasek = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.05, 0.48),
        new THREE.MeshBasicMaterial({ color: 0xe8c35c })
      );
      pasek.position.y = y;
      grupa.add(pasek);
    }
  }
  grupa.position.set(p.x, 0.35, p.z);
  grupa.userData = { indeks, bazowaY: 0.35 };
  scena.add(grupa);
  return grupa;
}

function wyczyscDynamiczne() {
  for (const grupa of wizualniWrogowie.values()) scena.remove(grupa);
  for (const grupa of wizualnePrzedmioty.values()) scena.remove(grupa);
  for (const efekt of efekty) scena.remove(efekt.obiekt);
  wizualniWrogowie.clear();
  wizualnePrzedmioty.clear();
  efekty.length = 0;
}

function zbudujDynamiczne() {
  wyczyscDynamiczne();
  gra.wrogowie.forEach((w) => wizualniWrogowie.set(w.id, stworzWroga(w)));
  gra.przedmioty.forEach((p, i) => wizualnePrzedmioty.set(p.id, stworzPrzedmiot(p, i)));
  const brama = meszePrzeszkod.get("brama");
  if (brama) {
    brama.visible = true;
    brama.position.y = (0 + 3.2) / 2;
    brama.userData.otwarcie = 0;
  }
}

function dodajLinie(od, cel, kolor, czas = 0.11) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(od.x, od.y, od.z),
    new THREE.Vector3(cel.x, cel.y, cel.z),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: kolor,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const linia = new THREE.Line(geo, mat);
  scena.add(linia);
  efekty.push({ obiekt: linia, czas, czasPoczatkowy: czas, typ: "linia" });
}

function dodajBlysk(punkt, kolor = 0xffd9a0, rozmiar = 0.13) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(rozmiar, 8, 6),
    new THREE.MeshBasicMaterial({
      color: kolor,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
  );
  mesh.position.set(punkt.x, punkt.y, punkt.z);
  scena.add(mesh);
  efekty.push({ obiekt: mesh, czas: 0.1, czasPoczatkowy: 0.1, typ: "blysk" });
}

function dodajCząstki(punkt, kolor, liczba = 7) {
  for (let i = 0; i < liczba; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.026 + Math.random() * 0.022, 6, 5),
      new THREE.MeshBasicMaterial({ color: kolor, transparent: true, opacity: 0.9 })
    );
    mesh.position.set(punkt.x, punkt.y, punkt.z);
    scena.add(mesh);
    efekty.push({
      obiekt: mesh,
      czas: 0.32 + Math.random() * 0.22,
      czasPoczatkowy: 0.5,
      typ: "czastka",
      v: new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        Math.random() * 2.2,
        (Math.random() - 0.5) * 2.4
      ),
    });
  }
}

function aktualizujEfekty(dt) {
  for (let i = efekty.length - 1; i >= 0; i--) {
    const e = efekty[i];
    e.czas -= dt;
    if (e.czas <= 0) {
      scena.remove(e.obiekt);
      e.obiekt.geometry?.dispose();
      e.obiekt.material?.dispose();
      efekty.splice(i, 1);
      continue;
    }
    const f = e.czas / e.czasPoczatkowy;
    e.obiekt.material.opacity = f;
    if (e.typ === "czastka") {
      e.v.y -= 6 * dt;
      e.obiekt.position.addScaledVector(e.v, dt);
      e.obiekt.scale.setScalar(0.4 + f * 0.8);
    } else if (e.typ === "blysk") {
      e.obiekt.scale.setScalar(0.7 + (1 - f) * 1.6);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Dźwięk (syntezowany, bez plików zewnętrznych)                       */
/* ------------------------------------------------------------------ */

class Dzwiek {
  constructor() {
    this.ctx = null;
    this.szum = null;
    this.wyciszony = false;
  }

  inicjuj() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      const dlugosc = Math.floor(this.ctx.sampleRate * 0.5);
      this.szum = this.ctx.createBuffer(1, dlugosc, this.ctx.sampleRate);
      const dane = this.szum.getChannelData(0);
      for (let i = 0; i < dlugosc; i++) dane[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  glosnosc(wartosc) {
    return this.wyciszony || !this.ctx ? 0 : wartosc;
  }

  wybuchsZumu(dlugosc, czestotliwosc, glosnosc) {
    if (!this.ctx || this.wyciszony || glosnosc <= 0) return;
    const zrodlo = this.ctx.createBufferSource();
    zrodlo.buffer = this.szum;
    const filtr = this.ctx.createBiquadFilter();
    filtr.type = "lowpass";
    filtr.frequency.value = czestotliwosc;
    const wzmacniacz = this.ctx.createGain();
    const teraz = this.ctx.currentTime;
    wzmacniacz.gain.setValueAtTime(glosnosc, teraz);
    wzmacniacz.gain.exponentialRampToValueAtTime(0.001, teraz + dlugosc);
    zrodlo.connect(filtr).connect(wzmacniacz).connect(this.ctx.destination);
    zrodlo.start(teraz);
    zrodlo.stop(teraz + dlugosc + 0.02);
  }

  ton(czestotliwosc, dlugosc, glosnosc, typ = "sine", koncowka = null) {
    if (!this.ctx || this.wyciszony || glosnosc <= 0) return;
    const osc = this.ctx.createOscillator();
    const wz = this.ctx.createGain();
    const teraz = this.ctx.currentTime;
    osc.type = typ;
    osc.frequency.setValueAtTime(czestotliwosc, teraz);
    if (koncowka) osc.frequency.exponentialRampToValueAtTime(koncowka, teraz + dlugosc);
    wz.gain.setValueAtTime(glosnosc, teraz);
    wz.gain.exponentialRampToValueAtTime(0.001, teraz + dlugosc);
    osc.connect(wz).connect(this.ctx.destination);
    osc.start(teraz);
    osc.stop(teraz + dlugosc + 0.02);
  }

  strzal(bron) {
    this.inicjuj();
    const ustawienia = [
      [0.16, 2300, 0.22],
      [0.2, 1500, 0.3],
      [0.32, 1100, 0.34],
    ][bron] || [0.2, 1500, 0.25];
    this.wybuchsZumu(...ustawienia);
    this.ton(bron === 2 ? 75 : 110, 0.09, 0.12, "triangle", 45);
  }

  strzalWroga() {
    this.inicjuj();
    this.wybuchsZumu(0.14, 1000, this.glosnosc(0.11));
  }

  trafienie(glowa) {
    this.inicjuj();
    this.ton(glowa ? 1250 : 820, 0.07, this.glosnosc(0.12), "square", glowa ? 1700 : 600);
  }

  ranienie() {
    this.inicjuj();
    this.ton(160, 0.22, this.glosnosc(0.2), "sawtooth", 70);
  }

  przeladowanie() {
    this.inicjuj();
    this.ton(310, 0.05, this.glosnosc(0.09), "square", 180);
    setTimeout(() => this.ton(420, 0.05, this.glosnosc(0.08), "square", 240), 180);
  }

  pickup() {
    this.inicjuj();
    [520, 680, 900].forEach((f, i) =>
      setTimeout(() => this.ton(f, 0.1, this.glosnosc(0.08), "sine"), i * 70)
    );
  }

  brama() {
    this.inicjuj();
    this.ton(90, 0.7, this.glosnosc(0.16), "sawtooth", 220);
  }

  klik() {
    this.inicjuj();
    this.ton(660, 0.035, this.glosnosc(0.05), "square", 440);
  }
}

const dzwiek = new Dzwiek();

/* ------------------------------------------------------------------ */
/* Wejście: wyłącznie klawiatura i mysz                                */
/* ------------------------------------------------------------------ */

const klawisze = new Set();
const mysz = { fire: false, aim: false, drag: false };
const jednorazowe = {
  ruchX: 0,
  ruchY: 0,
  zoom: 0,
  bron: 0,
  skok: false,
  interakcja: false,
  przeladuj: false,
};

function dodajRuch(dx, dy) {
  jednorazowe.ruchX += dx;
  jednorazowe.ruchY -= dy;
}

function wyczyscWejscie() {
  klawisze.clear();
  mysz.fire = false;
  mysz.aim = false;
  mysz.drag = false;
}

const klawiszeGry = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyF", "KeyR",
  "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight",
  "Space", "Digit1", "Digit2", "Digit3", "ArrowUp", "ArrowDown",
  "ArrowLeft", "ArrowRight", "Escape",
]);

window.addEventListener("keydown", (e) => {
  if (klawiszeGry.has(e.code) && gra.scena !== "menu") e.preventDefault();
  if (e.code === "Escape") {
    if (gra.scena === "gran" || gra.scena === "pauza") przełączPauzę();
    return;
  }
  if (e.code === "KeyM" && !e.repeat) {
    dzwiek.wyciszony = !dzwiek.wyciszony;
    $("btn-dzwiek").textContent = dzwiek.wyciszony ? "×" : "♪";
    return;
  }
  if (gra.scena !== "gran") return;
  klawisze.add(e.code);
  if (e.repeat) return;
  if (e.code === "Space") jednorazowe.skok = true;
  if (e.code === "KeyF" || e.code === "KeyE") jednorazowe.interakcja = true;
  if (e.code === "KeyR") jednorazowe.przeladuj = true;
  if (e.code === "Digit1") jednorazowe.bron = 1;
  if (e.code === "Digit2") jednorazowe.bron = 2;
  if (e.code === "Digit3") jednorazowe.bron = 3;
});

window.addEventListener("keyup", (e) => klawisze.delete(e.code));
window.addEventListener("blur", () => {
  wyczyscWejscie();
  if (gra.scena === "gran") przełączPauzę(true);
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => {
  if (gra.scena === "gran") e.preventDefault();
});

canvas.addEventListener("pointerdown", (e) => {
  if (gra.scena !== "gran") return;
  if (e.pointerType === "mouse" || e.pointerType === "pen") {
    mysz.drag = true;
    ostatniMysz.x = e.clientX;
    ostatniMysz.y = e.clientY;
    if (e.button === 2) mysz.fire = true;
    if (e.button === 0) {
      mysz.aim = true;
      przejmijMysz();
    }
    dzwiek.inicjuj();
  }
});

window.addEventListener("pointerup", (e) => {
  if (e.button === 2) mysz.fire = false;
  if (e.button === 0) mysz.aim = false;
  mysz.drag = false;
});

window.addEventListener("pointermove", (e) => {
  if (gra.scena !== "gran") return;
  if (document.pointerLockElement === canvas) {
    dodajRuch(e.movementX || 0, e.movementY || 0);
  } else if ((e.pointerType === "mouse" || e.pointerType === "pen") && mysz.drag) {
    const dx = e.clientX - (ostatniMysz.x ?? e.clientX);
    const dy = e.clientY - (ostatniMysz.y ?? e.clientY);
    dodajRuch(dx, dy);
    ostatniMysz.x = e.clientX;
    ostatniMysz.y = e.clientY;
  }
});
const ostatniMysz = { x: null, y: null };

window.addEventListener(
  "wheel",
  (e) => {
    if (gra.scena !== "gran") return;
    e.preventDefault();
    jednorazowe.zoom += e.deltaY > 0 ? -1 : 1;
  },
  { passive: false }
);

let mielismyLock = false;
function przejmijMysz() {
  if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {
      // Starsze przeglądarki – patrzenie działa przez przeciąganie.
    }
  }
}

document.addEventListener("pointerlockchange", () => {
  const zablokowana = document.pointerLockElement === canvas;
  if (zablokowana) mielismyLock = true;
  const pokaz = gra.scena === "gran" && !zablokowana;
  $("podpowiedz").classList.toggle("ukryty", !pokaz);
  if (!zablokowana && mielismyLock && gra.scena === "gran") przełączPauzę(true);
});

function zbierzWejscie() {
  const w = {
    przod: klawisze.has("KeyW") || klawisze.has("ArrowUp"),
    tyl: klawisze.has("KeyS") || klawisze.has("ArrowDown"),
    lewo: klawisze.has("KeyA") || klawisze.has("ArrowLeft"),
    prawo: klawisze.has("KeyD") || klawisze.has("ArrowRight"),
    strafeLewo: klawisze.has("KeyQ"),
    strafePrawo: klawisze.has("KeyE"),
    sprint: klawisze.has("ShiftLeft") || klawisze.has("ShiftRight"),
    kuc: klawisze.has("ControlLeft") || klawisze.has("ControlRight"),
    cel: mysz.aim,
    strzelaj: mysz.fire,
    ruchX: jednorazowe.ruchX,
    ruchY: jednorazowe.ruchY,
    zoom: jednorazowe.zoom,
    bron: jednorazowe.bron,
    skok: jednorazowe.skok,
    interakcja: jednorazowe.interakcja,
    przeladuj: jednorazowe.przeladuj,
  };
  jednorazowe.ruchX = 0;
  jednorazowe.ruchY = 0;
  jednorazowe.zoom = 0;
  jednorazowe.bron = 0;
  jednorazowe.skok = false;
  jednorazowe.interakcja = false;
  jednorazowe.przeladuj = false;
  return w;
}

/* ------------------------------------------------------------------ */
/* Menu i ekrany                                                       */
/* ------------------------------------------------------------------ */

let wybranaPostac = POSTACIE[0];
const kontenerPostaci = $("postacie");

POSTACIE.forEach((p) => {
  const przycisk = document.createElement("button");
  przycisk.type = "button";
  przycisk.className = "postac" + (p === wybranaPostac ? " wybrana" : "");
  przycisk.dataset.id = p.id;
  const kolor = `#${p.kolor.toString(16).padStart(6, "0")}`;
  przycisk.innerHTML = `
    <b><i class="kropka" style="background:${kolor};color:${kolor}"></i>${p.nazwa}</b>
    <small>${p.opis}</small>
    <div class="stat">SZYBKOŚĆ <i style="width:${p.szybkosc * 55}px"></i></div>
    <div class="stat">ZDROWIE <i style="width:${p.zycie * 0.5}px"></i></div>
    <div class="stat">SKRYTOŚĆ <i style="width:${(2 - p.wykrywanie) * 50}px;background:#5fc8ff"></i></div>
  `;
  przycisk.addEventListener("click", () => {
    wybranaPostac = p;
    kontenerPostaci.querySelectorAll(".postac").forEach((el) => el.classList.remove("wybrana"));
    przycisk.classList.add("wybrana");
    dzwiek.inicjuj();
    dzwiek.klik();
  });
  kontenerPostaci.appendChild(przycisk);
});

function rozpocznijGry() {
  const imie = $("imie").value.trim().slice(0, 16) || "Żołnierz";
  gra.ustawPostac(wybranaPostac, imie);
  gra.start();
  zbudujDynamiczne();
  $("menu").classList.add("ukryty");
  $("koniec").classList.add("ukryty");
  $("pauza").classList.add("ukryty");
  $("hud").classList.remove("ukryty");
  $("celownik").classList.remove("ukryty");
  wyczyscWejscie();
  dzwiek.inicjuj();
  dzwiek.klik();
  przejmijMysz();
}

function wrocDoMenu() {
  gra.reset();
  wyczyscWejscie();
  if (document.pointerLockElement) document.exitPointerLock?.();
  $("menu").classList.remove("ukryty");
  $("koniec").classList.add("ukryty");
  $("pauza").classList.add("ukryty");
  $("hud").classList.add("ukryty");
  $("celownik").classList.add("ukryty");
  $("luneta").classList.add("ukryty");
  $("komunikat").classList.add("ukryty");
  $("podpowiedz").classList.add("ukryty");
}

function przełączPauzę(wymuszone = null) {
  const chcemyPauzy = wymuszone === null ? gra.scena === "gran" : wymuszone;
  if (chcemyPauzy && gra.scena === "gran") gra.pauza();
  else if (!chcemyPauzy && gra.scena === "pauza") gra.pauza();
  const jestPauza = gra.scena === "pauza";
  $("pauza").classList.toggle("ukryty", !jestPauza);
  if (jestPauza) {
    wyczyscWejscie();
    if (document.pointerLockElement) document.exitPointerLock?.();
  } else if (gra.scena === "gran") {
    przejmijMysz();
  }
  $("podpowiedz").classList.add("ukryty");
}

$("start").addEventListener("click", rozpocznijGry);
$("imie").addEventListener("keydown", (e) => {
  if (e.code === "Enter") {
    e.preventDefault();
    rozpocznijGry();
  }
});
$("btn-pauza").addEventListener("click", () => przełączPauzę(true));
$("wznow").addEventListener("click", () => przełączPauzę(false));
$("restart-pauza").addEventListener("click", rozpocznijGry);
$("menu-pauza").addEventListener("click", wrocDoMenu);
$("restart-koniec").addEventListener("click", rozpocznijGry);
$("menu-koniec").addEventListener("click", wrocDoMenu);
$("btn-dzwiek").addEventListener("click", () => {
  dzwiek.wyciszony = !dzwiek.wyciszony;
  $("btn-dzwiek").textContent = dzwiek.wyciszony ? "×" : "♪";
  dzwiek.klik();
});
$("fullscreen").addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch?.(() => {});
  else document.exitFullscreen?.().catch?.(() => {});
});
function pokazKoniec(wygrana) {
  const hud = gra.pobierzHud();
  $("koniec-nadpis").textContent = wygrana ? "Misja zakończona" : "Raport strat";
  $("koniec-tytul").textContent = wygrana ? "EWAKUACJA" : "POLEGNĄŁEŚ";
  $("koniec-opis").textContent = wygrana
    ? `${hud.imie}, ${hud.postac} opuścił strefę wrogów. Terminal uruchomiony, cel osiągnięty.`
    : `${hud.imie}, ${hud.postac} nie dotrwał do ewakuacji. Spróbuj skradania (CTRL) i osłon.`;
  $("wynik-zabici").textContent = String(hud.zabici);
  $("wynik-czas").textContent = formatCzasu(hud.czas);
  $("wynik-celnosc").textContent = `${hud.celność}%`;
  $("koniec").classList.remove("ukryty");
  $("celownik").classList.add("ukryty");
  $("luneta").classList.add("ukryty");
  $("komunikat").classList.add("ukryty");
  $("hud-interakcja").classList.add("ukryty");
  $("podpowiedz").classList.add("ukryty");
  if (document.pointerLockElement) document.exitPointerLock?.();
}

function formatCzasu(sekundy) {
  const m = Math.floor(sekundy / 60).toString().padStart(2, "0");
  const s = Math.floor(sekundy % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ------------------------------------------------------------------ */
/* HUD i minimapa                                                      */
/* ------------------------------------------------------------------ */

const sloty = [...document.querySelectorAll(".slot")];
const mapa = $("minimap");
const ctxMapy = mapa.getContext("2d");
let czasTrafienia = 0;
let czasUszkodzenia = 0;
let czasKomunikatu = 0;

function aktualizujHud() {
  const h = gra.pobierzHud();
  $("imie-gracza").textContent = h.imie;
  $("postac-gracza").textContent = h.postac;
  $("zycie-tekst").textContent = `${h.zycie} / ${h.maxZycie}`;
  $("pasek-zycia").style.width = `${Math.max(0, (h.zycie / h.maxZycie) * 100)}%`;
  $("wytrzymalosc-tekst").textContent = `${h.wytrzymalosc}%`;
  $("pasek-wytrzymalosci").style.width = `${h.wytrzymalosc}%`;

  $("cel-tekst").textContent = h.wrogowie > 0
    ? "Pokonaj wrogów"
    : h.terminal
      ? "Dotrz do strefy ewakuacji"
      : "Uruchom terminal (E)";
  $("cel-liczniki").textContent = `Wrogowie: ${h.wrogowie} · Zabici: ${h.zabici} · ${formatCzasu(h.czas)}`;

  $("nazwa-broni").textContent = h.nazwaBroni;
  $("ammo").innerHTML = `${h.magazynek} <small>/ ${h.zapas}</small>`;
  sloty.forEach((s, i) => s.classList.toggle("aktywny", i === h.bron));
  $("zoom-info").textContent = h.luneta && h.zoom > 1 ? `ZOOM ${h.zoom}× · kółko myszy` : "";
  $("pasek-przeladowania").firstElementChild.style.width =
    h.przeladowanie ? `${Math.min(100, h.postepPrzeladowania * 100)}%` : "0%";

  const roz = $("hud-interakcja");
  roz.classList.toggle("ukryty", !h.interakcja);
  if (h.interakcja) roz.textContent = h.interakcja;

  $("chip-kuc").classList.toggle("on", h.kuc);
  $("chip-sprint").classList.toggle("on", h.sprint);
  $("chip-cel").classList.toggle("on", h.cel);

  const kom = $("komunikat");
  const tekst = h.wiadomosc || (czasKomunikatu > 0 ? kom.dataset.tresc || "" : "");
  kom.classList.toggle("ukryty", !tekst);
  if (tekst) kom.textContent = tekst;
  if (h.wiadomosc) {
    kom.dataset.tresc = h.wiadomosc;
    czasKomunikatu = 1.6;
  }

  const celownik = $("celownik");
  const luneta = $("luneta");
  const celujeLuneta = h.cel && h.luneta && h.zoom > 1;
  luneta.classList.toggle("ukryty", !celujeLuneta);
  celownik.classList.toggle("ukryty", celujeLuneta);
  if (!celujeLuneta) {
    const odstep = 4 + Math.min(26, h.rozproszenie * 620) + (h.cel ? 0 : 3);
    celownik.querySelectorAll(".g").forEach((el) => {
      el.style.setProperty("--odstep", `${odstep.toFixed(1)}px`);
    });
  }
}

function rysujMinimape() {
  const s = mapa.width;
  const sk = s / 44;
  const px = (x) => (x + 22) * sk;
  const pz = (z) => (z + 22) * sk;
  ctxMapy.clearRect(0, 0, s, s);
  ctxMapy.fillStyle = "#0b1719";
  ctxMapy.fillRect(0, 0, s, s);
  ctxMapy.strokeStyle = "rgba(126,240,166,0.08)";
  ctxMapy.lineWidth = 1;
  for (let i = 0; i <= s; i += s / 8) {
    ctxMapy.beginPath();
    ctxMapy.moveTo(i, 0);
    ctxMapy.lineTo(i, s);
    ctxMapy.moveTo(0, i);
    ctxMapy.lineTo(s, i);
    ctxMapy.stroke();
  }

  for (const p of gra.przeszkody) {
    if (!p.aktywny) continue;
    ctxMapy.fillStyle = p.typ === "brama" ? "#ff6666" : "rgba(150,175,165,0.4)";
    ctxMapy.fillRect(px(p.minX), pz(p.minZ), (p.maxX - p.minX) * sk, (p.maxZ - p.minZ) * sk);
  }

  for (const o of gra.przedmioty) {
    if (!o.aktywny) continue;
    ctxMapy.fillStyle = o.typ === "apteczka" ? "#ff7b7b" : "#ffe08a";
    ctxMapy.fillRect(px(o.x) - 4, pz(o.z) - 4, 8, 8);
  }
  ctxMapy.fillStyle = gra.terminalAktywny ? "#7ef0a6" : "#ffbe5c";
  ctxMapy.fillRect(px(gra.terminal.x) - 6, pz(gra.terminal.z) - 6, 12, 12);
  ctxMapy.strokeStyle = "#7effb4";
  ctxMapy.lineWidth = 3;
  ctxMapy.beginPath();
  ctxMapy.arc(px(gra.wyjscie.x), pz(gra.wyjscie.z), 13, 0, Math.PI * 2);
  ctxMapy.stroke();

  const g = gra.gracz;
  for (const w of gra.wrogowie) {
    if (w.martwy) continue;
    const d = Math.hypot(w.x - g.x, w.z - g.z);
    if (w.czujnosc < 0.15 && d > 13) continue;
    ctxMapy.fillStyle = w.czujnosc >= 1 ? "#ff4040" : "#d98a5c";
    ctxMapy.beginPath();
    ctxMapy.arc(px(w.x), pz(w.z), 5, 0, Math.PI * 2);
    ctxMapy.fill();
  }

  ctxMapy.save();
  ctxMapy.translate(px(g.x), pz(g.z));
  ctxMapy.rotate(g.yaw);
  ctxMapy.fillStyle = "#7ef0a6";
  ctxMapy.beginPath();
  ctxMapy.moveTo(0, -10);
  ctxMapy.lineTo(7, 8);
  ctxMapy.lineTo(0, 4);
  ctxMapy.lineTo(-7, 8);
  ctxMapy.closePath();
  ctxMapy.fill();
  ctxMapy.restore();
}

/* ------------------------------------------------------------------ */
/* Obsługa zdarzeń z logiki                                            */
/* ------------------------------------------------------------------ */

function obsluzZdarzenia() {
  const g = gra.gracz;
  for (const z of gra.zdarzenia) {
    switch (z.typ) {
      case "strzal":
        dodajLinie(z.od, z.do, z.bron === 2 ? 0xffe1a0 : 0xffc36b);
        blyski[z.bron].visible = true;
        blyski[z.bron].scale.setScalar(1 + Math.random() * 0.5);
        setTimeout(() => { blyski[z.bron].visible = false; }, 55);
        dzwiek.strzal(z.bron);
        break;
      case "strzal_wroga":
        dodajBlysk(z.od, 0xffb066, 0.14);
        dodajLinie(z.od, z.do, 0xff8452, 0.2);
        if (z.trafiony) dodajCząstki(z.do, 0xff5d5d, 5);
        dzwiek.strzalWroga();
        break;
      case "trafienie":
        dodajCząstki(z.punkt, z.głowa ? 0xffc766 : 0xd94b46, z.głowa ? 11 : 7);
        czasTrafienia = 0.22;
        $("trafienie").classList.toggle("glowa", z.głowa);
        dzwiek.trafienie(z.głowa);
        break;
      case "uderzenie":
        dodajCząstki(z.punkt, z.rodzaj === "ziemia" ? 0xb8a98c : 0xc9c9bd, 4);
        break;
      case "ranienie":
        czasUszkodzenia = 0.95;
        $("komunikat").dataset.tresc = "ZOSTAŁEŚ TRAFIONY!";
        czasKomunikatu = 0.9;
        $("hud-gracz").classList.add("raniony");
        setTimeout(() => $("hud-gracz").classList.remove("raniony"), 420);
        dzwiek.ranienie();
        {
          const strzalka = $("strzalka-ran");
          const kat = ((z.od - g.yaw) * 180) / Math.PI;
          strzalka.style.transform = `translate(-50%, -50%) rotate(${kat}deg)`;
          strzalka.style.opacity = "1";
          setTimeout(() => { strzalka.style.opacity = "0"; }, 700);
        }
        break;
      case "pickup":
        dzwiek.pickup();
        break;
      case "brama":
        dzwiek.brama();
        break;
      case "zoom":
      case "bron":
      case "przeladuj":
        dzwiek.klik();
        if (z.typ === "przeladuj") dzwiek.przeladowanie();
        break;
      case "skok":
        dzwiek.ton(180, 0.06, dzwiek.glosnosc(0.04), "sine", 240);
        break;
      case "wiadomosc":
        $("komunikat").dataset.tresc = z.tekst;
        czasKomunikatu = z.czas;
        break;
      case "wygrana":
        pokazKoniec(true);
        break;
      case "porazka":
        pokazKoniec(false);
        break;
      default:
        break;
    }
  }
  gra.zdarzenia.length = 0;
}

/* ------------------------------------------------------------------ */
/* Synchronizacja wizualna i pętla gry                                 */
/* ------------------------------------------------------------------ */

let poprzedniCzas = 0;
let poprzedniaPozycja = new THREE.Vector3(0, 0, 17);
let drganiaBron = 0;

function synchronizujSceny(dt, czas) {
  const g = gra.gracz;

  // Wrogowie.
  for (const w of gra.wrogowie) {
    const grupa = wizualniWrogowie.get(w.id);
    if (!grupa) continue;
    grupa.position.set(w.x, w.y, w.z);
    if (w.martwy) {
      grupa.rotation.x = -Math.min(Math.PI / 2, w.czasSmierci * 2.6);
      grupa.userData.pasekFill.visible = false;
      grupa.userData.pasekTlo.visible = false;
      grupa.userData.wizjer.material.color.setHex(0x332020);
      continue;
    }
    grupa.rotation.set(0, -w.yaw, 0);
    const chodzenie = Math.sin(czas * 9 + w.indeks) * w.biegle * 0.5;
    grupa.userData.nogi[0].rotation.x = chodzenie;
    grupa.userData.nogi[1].rotation.x = -chodzenie;
    grupa.userData.rece[0].rotation.x = -0.5 - chodzenie * 0.3;
    grupa.userData.rece[1].rotation.x = -0.5 + chodzenie * 0.3;
    if (w.hp < grupa.userData.hp) {
      grupa.userData.flash = 0.18;
      grupa.userData.hp = w.hp;
    }
    grupa.userData.flash = Math.max(0, grupa.userData.flash - dt);
    const swiec = grupa.userData.flash > 0 ? 1.5 : 0;
    grupa.userData.mundur.emissive.setHex(0xffffff);
    grupa.userData.mundur.emissiveIntensity = swiec;
    const pasek = grupa.userData.pasekFill;
    const widocznyPasek = w.hp < w.maxHp || w.czujnosc > 0.15;
    pasek.visible = widocznyPasek;
    grupa.userData.pasekTlo.visible = widocznyPasek;
    pasek.scale.x = Math.max(0.02, w.hp / w.maxHp);
    pasek.position.x = -0.41 * (1 - pasek.scale.x);
    pasek.material.color.setHex(w.czujnosc >= 1 ? 0xff4040 : 0xffc766);
    grupa.userData.wizjer.material.color.setHex(w.czujnosc >= 1 ? 0xff3020 : 0xa35340);
    pasek.lookAt(kamera.position);
    grupa.userData.pasekTlo.lookAt(kamera.position);
  }

  // Przedmioty.
  for (const p of gra.przedmioty) {
    const grupa = wizualnePrzedmioty.get(p.id);
    if (!grupa) continue;
    grupa.visible = p.aktywny;
    grupa.position.y = grupa.userData.bazowaY + Math.sin(czas * 2.2 + grupa.userData.indeks) * 0.09;
    grupa.rotation.y = czas * 0.6 + grupa.userData.indeks;
  }

  // Terminal i brama.
  ekranMaterial.color.setHex(gra.terminalAktywny ? 0x7effb4 : 0xffa23c);
  ekranMaterial.emissive.setHex(gra.terminalAktywny ? 0x39ff9a : 0xff7a1c);
  swiatloTerminala.color.setHex(gra.terminalAktywny ? 0x63ffb2 : 0xffa442);
  const brama = meszePrzeszkod.get("brama");
  if (brama) {
    const cel = gra.bramaOtwarta ? 1 : 0;
    brama.userData.otwarcie += (cel - brama.userData.otwarcie) * Math.min(1, dt * 2.2);
    brama.position.y = (0 + 3.2) / 2 + brama.userData.otwarcie * 3.4;
    if (brama.userData.otwarcie > 0.98) brama.visible = false;
  }
  pierScien.material.opacity = 0.55 + Math.sin(czas * 3) * 0.2;
  swiatloEwakuacji.intensity = 1.3 + Math.sin(czas * 4) * 0.4;

  // Model broni w widoku pierwszoosobowym.
  modeleBroni.forEach((model, i) => { model.grupa.visible = i === g.bron; });
  const celuje = g.cel;
  const lunetaAktywna = celuje && g.bron === 2 && gra.powiekszenie > 1;
  const docelnaPozycja = lunetaAktywna
    ? new THREE.Vector3(0, -0.16, -0.36)
    : celuje
      ? new THREE.Vector3(0.0, -0.205, -0.5)
      : new THREE.Vector3(0.33, -0.31, -0.63);
  const docelnyObrot = lunetaAktywna
    ? new THREE.Vector3(0, 0, 0)
    : celuje
      ? new THREE.Vector3(0.01, 0, 0)
      : new THREE.Vector3(0.02, -0.13, 0.05);
  const predkoscRuchu = poprzedniaPozycja.distanceTo(
    new THREE.Vector3(g.x, g.y, g.z)
  ) / Math.max(dt, 1e-5);
  const bob = Math.sin(czas * 10) * Math.min(0.025, predkoscRuchu * 0.004) * (g.naZiemi ? 1 : 0.2);
  drganiaBron *= Math.max(0, 1 - dt * 11);
  docelnaPozycja.y += bob;
  docelnaPozycja.z += g.odrzut * 1.5 + drganiaBron * 0.06;
  docelnyObrot.x += g.odrzut * 0.7 + drganiaBron * 0.1;
  grupaBroni.position.lerp(docelnaPozycja, Math.min(1, dt * 13));
  grupaBroni.rotation.x += (docelnyObrot.x - grupaBroni.rotation.x) * Math.min(1, dt * 13);
  grupaBroni.rotation.y += (docelnyObrot.y - grupaBroni.rotation.y) * Math.min(1, dt * 13);
  grupaBroni.rotation.z += (docelnyObrot.z - grupaBroni.rotation.z) * Math.min(1, dt * 13);
  poprzedniaPozycja.set(g.x, g.y, g.z);

  // Kamera i pole widzenia.
  let fovDocelowy = 76;
  if (celuje) {
    if (g.bron === 2 && gra.powiekszenie > 1) {
      const Rad = Math.PI / 180;
      fovDocelowy = (2 * Math.atan(Math.tan((76 * Rad) / 2) / gra.powiekszenie)) / Rad;
    } else {
      fovDocelowy = 55;
    }
  }
  kamera.fov += (fovDocelowy - kamera.fov) * Math.min(1, dt * 12);
  kamera.updateProjectionMatrix();
  kamera.position.set(g.x, g.y + g.wysokoscOcz + bob * 0.5, g.z);
  kamera.rotation.set(g.pitch, -g.yaw, 0);

  // Efekty ekranowe z czasem trwania.
  czasTrafienia = Math.max(0, czasTrafienia - dt);
  $("trafienie").style.opacity = String(Math.min(1, czasTrafienia * 5));
  czasUszkodzenia = Math.max(0, czasUszkodzenia - dt);
  $("uszkodzenie").style.opacity = String(Math.min(0.9, czasUszkodzenia));
  czasKomunikatu = Math.max(0, czasKomunikatu - dt);
}

function petla(czasMs) {
  const czas = czasMs / 1000;
  const dt = poprzedniCzas ? Math.min(0.05, czas - poprzedniCzas) : 0;
  poprzedniCzas = czas;

  if (gra.scena === "gran") {
    gra.aktualizuj(dt, zbierzWejscie());
    obsluzZdarzenia();
    synchronizujSceny(dt, czas);
    aktualizujHud();
    if (Math.floor(czas * 12) !== Math.floor((czas - dt) * 12)) rysujMinimape();
  } else if (gra.scena === "menu") {
    const a = czas * 0.12;
    kamera.position.set(Math.sin(a) * 17, 10 + Math.sin(a * 0.7) * 1.5, Math.cos(a) * 17);
    kamera.lookAt(0, 1, -2);
    kamera.fov = 66;
    kamera.updateProjectionMatrix();
  } else {
    synchronizujSceny(dt, czas);
    obsluzZdarzenia();
  }

  aktualizujEfekty(dt);
  renderer.clear();
  renderer.render(scena, kamera);
  renderer.clearDepth();
  renderer.render(scenaBroni, kameraBroni);
  requestAnimationFrame(petla);
}

zbudujDynamiczne();
rysujMinimape();
requestAnimationFrame(petla);

// Ułatwienie testów w konsoli przeglądarki.
window.graStrzelec = gra;
