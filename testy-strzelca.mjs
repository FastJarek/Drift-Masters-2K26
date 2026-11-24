// Testy logiki strzelanki 3D – uruchamianie: node --test testy-strzelca.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { GraStrzelec, POSTACIE, BRONIE, K } from "./logika-strzelca.mjs";

function nowaGra(postac = POSTACIE[0]) {
  const gra = new GraStrzelec({ postac, imie: "Test" });
  gra.start();
  return gra;
}

function wejscie(nadpis = {}) {
  return {
    przod: false,
    tyl: false,
    lewo: false,
    prawo: false,
    strafeLewo: false,
    strafePrawo: false,
    sprint: false,
    kuc: false,
    cel: false,
    skok: false,
    interakcja: false,
    przeladuj: false,
    ruchX: 0,
    ruchY: 0,
    zoom: 0,
    bron: 0,
    ...nadpis,
  };
}

test("start tworzy kompletny stan misji", () => {
  const gra = nowaGra();
  assert.equal(gra.scena, "gran");
  assert.equal(gra.wrogowie.length, 6);
  assert.equal(gra.przedmioty.length, 4);
  assert.equal(gra.gracz.magazynki.length, 3);
  assert.equal(gra.pozostaloWrogow, 6);
});

test("W przesuwa do przodu, Q/E dają strafe bez interakcji", () => {
  const gra = nowaGra();
  const z0 = gra.gracz.z;
  const x0 = gra.gracz.x;
  for (let i = 0; i < 30; i++) gra.aktualizuj(1 / 60, wejscie({ przod: true }));
  assert.ok(gra.gracz.z < z0 - 1, "gracz powinien podejść w stronę -Z");
  for (let i = 0; i < 30; i++)
    gra.aktualizuj(1 / 60, wejscie({ strafeLewo: true, strafePrawo: true }));
  assert.ok(Math.abs(gra.gracz.x - x0) < 0.05, "Q i E powinny się znosić");
});

test("sprint jest szybszy niż chód i zużywa kondycję", () => {
  const zwykla = nowaGra();
  const szybka = nowaGra();
  for (let i = 0; i < 60; i++) {
    zwykla.aktualizuj(1 / 60, wejscie({ przod: true }));
    szybka.aktualizuj(1 / 60, wejscie({ przod: true, sprint: true }));
  }
  assert.ok(szybka.gracz.z < zwykla.gracz.z - 0.7);
  assert.ok(szybka.gracz.wytrzymalosc < 100);
});

test("kucanie zmniejsza prędkość i wysokość oczu", () => {
  const gra = nowaGra();
  for (let i = 0; i < 60; i++) gra.aktualizuj(1 / 60, wejscie({ kuc: true }));
  assert.ok(gra.gracz.wysokoscOcz < K.OCZY_STAN - 0.4);
  assert.ok(gra.gracz.z > 17 - K.PREDKOSC * 0.7);
});

test("skok wznosi i opuszcza gracza z powrotem na ziemię", () => {
  const gra = nowaGra();
  gra.aktualizuj(1 / 60, wejscie({ skok: true }));
  assert.ok(gra.gracz.y > 0);
  for (let i = 0; i < 120; i++) gra.aktualizuj(1 / 60, wejscie());
  assert.equal(gra.gracz.y, 0);
  assert.equal(gra.gracz.naZiemi, true);
});

test("ściany blokują ruch", () => {
  const gra = nowaGra();
  gra.gracz.x = 19;
  gra.gracz.yaw = Math.PI / 2;
  for (let i = 0; i < 120; i++) gra.aktualizuj(1 / 60, wejscie({ przod: true }));
  assert.ok(gra.gracz.x < 20, "gracz nie powinien wyjść poza mur");
});

test("wrogowie wykrywają gracza i zadają mu obrażenia", () => {
  const gra = nowaGra();
  const w = gra.wrogowie[0];
  w.x = gra.gracz.x;
  w.z = gra.gracz.z - 6;
  w.czujnosc = 1;
  w.stan = "atak";
  w.czasStrzalu = 0;
  const staryRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const zycie = gra.gracz.zycie;
    for (let i = 0; i < 20; i++) gra.aktualizuj(1 / 60, wejscie());
    assert.ok(gra.gracz.zycie < zycie, "gracz powinien stracić zdrowie");
    assert.ok(gra.zdarzenia.some((z) => z.typ === "strzal_wroga"));
    assert.ok(gra.zdarzenia.some((z) => z.typ === "ranienie"));
  } finally {
    Math.random = staryRandom;
  }
});

test("strzał wroga alarmuje sąsiednich wrogów", () => {
  const gra = nowaGra();
  const [strzelec, sasied] = gra.wrogowie;
  strzelec.x = 0;
  strzelec.z = 11;
  strzelec.czujnosc = 1;
  strzelec.stan = "atak";
  strzelec.czasStrzalu = 0;
  sasied.x = 2;
  sasied.z = 11;
  sasied.czujnosc = 0;
  for (let i = 0; i < 5; i++) gra.aktualizuj(1 / 60, wejscie());
  assert.ok(sasied.czujnosc > 0.5, "sąsiad powinien zostać zaalarmowany");
});

test("promień nie przechodzi przez mur", () => {
  const gra = nowaGra();
  const od = { x: 19, y: 1.6, z: 0 };
  const cel = { x: 25, y: 1.6, z: 0 };
  assert.equal(gra.liniaWolna(od, cel), false);
  assert.equal(gra.liniaWolna({ x: 0, y: 1.6, z: 10 }, { x: 0, y: 1.6, z: 5 }), true);
});

test("strzał zużywa amunicję i trafia wroga", () => {
  const gra = nowaGra();
  const w = gra.wrogowie[0];
  gra.gracz.x = w.x;
  gra.gracz.z = w.z + 6;
  gra.gracz.yaw = 0;
  gra.gracz.pitch = 0;
  gra.gracz.cel = true;
  const staryRandom = Math.random;
  Math.random = () => 0.5;
  try {
    const hp = w.hp;
    const ammo = gra.gracz.magazynki[0];
    gra.strzelaj();
    assert.equal(gra.gracz.magazynki[0], ammo - 1);
    assert.ok(w.hp < hp, "wróg powinien stracić zdrowie");
    assert.ok(gra.trafienia > 0);
    assert.ok(gra.zdarzenia.some((z) => z.typ === "trafienie"));
  } finally {
    Math.random = staryRandom;
  }
});

test("bron 1/2/3, przeładowanie i zoom lunety", () => {
  const gra = nowaGra();
  gra.aktualizuj(1 / 60, wejscie({ bron: 2 }));
  assert.equal(gra.gracz.bron, 1);
  gra.aktualizuj(1 / 60, wejscie({ bron: 3 }));
  assert.equal(gra.gracz.bron, 2);
  assert.equal(gra.powiekszenie, 1);
  for (let i = 0; i < 3; i++) gra.aktualizuj(1 / 60, wejscie({ zoom: 1 }));
  assert.equal(gra.powiekszenie, K.POZIOMY_ZOOMU[3]);
  for (let i = 0; i < 12; i++) gra.aktualizuj(1 / 60, wejscie({ zoom: -1 }));
  assert.equal(gra.powiekszenie, 1);

  gra.gracz.magazynki[2] = 0;
  gra.aktualizuj(1 / 60, wejscie({ przeladuj: true }));
  assert.ok(gra.gracz.czasPrzeladowania > 0);
  for (let i = 0; i < 200; i++) gra.aktualizuj(1 / 60, wejscie());
  assert.equal(gra.gracz.magazynki[2], BRONIE[2].magazynek);
  assert.equal(gra.gracz.czasPrzeladowania, 0);
});

test("pistolet nie strzela bez puszczenia przycisku, AK strzela ciągle", () => {
  const gra = nowaGra();
  for (let i = 0; i < 90; i++) gra.aktualizuj(1 / 60, wejscie({ strzelaj: true }));
  assert.equal(gra.oddaneStrzaly, 1, "pistolet jest półautomatyczny");
  gra.aktualizuj(1 / 60, wejscie({ bron: 2 }));
  const przed = gra.oddaneStrzaly;
  for (let i = 0; i < 60; i++) gra.aktualizuj(1 / 60, wejscie({ strzelaj: true }));
  assert.ok(gra.oddaneStrzaly > przed + 3, "AK powinien prowadzić ogień ciągły");
});

test("E przy przedmiocie wykonuje interakcję zamiast strafe'u", () => {
  const gra = nowaGra();
  const apteczka = gra.przedmioty[0];
  gra.gracz.zycie = 40;
  gra.gracz.x = apteczka.x;
  gra.gracz.z = apteczka.z + 1;
  const x0 = gra.gracz.x;
  gra.aktualizuj(1 / 60, wejscie({ interakcja: true, strafePrawo: true }));
  assert.equal(apteczka.aktywny, false);
  assert.ok(gra.gracz.zycie > 40);
  assert.ok(Math.abs(gra.gracz.x - x0) < 0.01, "E nie powinien jednocześnie przesuwać w bok");
});

test("terminal otwiera bramę, ewakuacja kończy misję", () => {
  const gra = nowaGra();
  gra.wrogowie.forEach((w) => { w.martwy = true; w.hp = 0; });
  gra.gracz.x = gra.terminal.x + 1;
  gra.gracz.z = gra.terminal.z;
  gra.aktualizuj(1 / 60, wejscie({ interakcja: true }));
  assert.equal(gra.terminalAktywny, true);
  assert.equal(gra.przeszkody.find((p) => p.id === "brama").aktywny, false);

  gra.gracz.x = gra.wyjscie.x;
  gra.gracz.z = gra.wyjscie.z + 1;
  gra.aktualizuj(1 / 60, wejscie({ interakcja: true }));
  assert.equal(gra.scena, "wygrana");
});

test("przycisk terminalu nie działa, póki są wrogowie", () => {
  const gra = nowaGra();
  gra.gracz.x = gra.terminal.x;
  gra.gracz.z = gra.terminal.z + 1;
  gra.aktualizuj(1 / 60, wejscie({ interakcja: true }));
  assert.equal(gra.terminalAktywny, false);
  assert.ok(gra.wiadomosc.includes("wrogów"));
});

test("HUD zwraca spójne dane", () => {
  const gra = nowaGra(POSTACIE[2]);
  const h = gra.pobierzHud();
  assert.equal(h.imie, "Test");
  assert.equal(h.postac, POSTACIE[2].nazwa);
  assert.equal(h.wrogowie, 6);
  assert.equal(h.magazynek, BRONIE[0].magazynek);
  assert.equal(typeof h.interakcja, "string");
});
