"""Prosta gra 2D: omijanie czerwonych samochodów.

Sterowanie: strzałki w lewo/prawo lub A/D.
Celem jest jak najdłuższe omijanie czerwonych pojazdów na drodze.
"""

import os
import random
import sys

import pygame

# --- Ustawienia gry ---------------------------------------------------------

SZEROKOSC = 480
WYSOKOSC = 720
FPS = 60

SZEROKOSC_DROGI = 300
LEWA_DROGA = (SZEROKOSC - SZEROKOSC_DROGI) // 2
PRAWA_DROGA = LEWA_DROGA + SZEROKOSC_DROGI
LICZBA_PASOW = 3
SZEROKOSC_PASA = SZEROKOSC_DROGI // LICZBA_PASOW

ROZMIAR_AUTA = 44
PREDKOSC_GRACZA = 330  # pikseli na sekundę
PREDKOSC_NPC = 200  # pikseli na sekundę
CZAS_ODSTEP_NPC = 0.95  # sekundy
PUNKTY_NA_SEKUNDE = 10
LICZBA_ZYC = 3
CZAS_NIEZRANIALNOSCI = 1.5  # sekundy po kolizji

KOLOR_TRAWY = (58, 125, 68)
KOLOR_TRAWY_CIEMNY = (49, 108, 58)
KOLOR_DROGI = (58, 58, 62)
KOLOR_LINII = (235, 235, 225)
KOLOR_GRACZA = (60, 220, 80)
KOLOR_NPC = (225, 65, 60)
KOLOR_SZYBY = (35, 50, 60)

SCENA_GRANIE = "gran"
SCENA_KONIEC = "koniec"


def wczytaj_czcionke(rozmiar):
    """Ładuje czcionkę z obsługą polskich znaków, z bezpiecznym fallbackiem."""
    sciezki = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for sciezka in sciezki:
        if os.path.exists(sciezka):
            return pygame.font.Font(sciezka, rozmiar)
    return pygame.font.Font(None, rozmiar)


class Gra:
    def __init__(self):
        pygame.init()
        self.okno = pygame.display.set_mode((SZEROKOSC, WYSOKOSC))
        pygame.display.set_caption("Omijaj przeszkody")
        self.zegar = pygame.time.Clock()
        self.czcionka = wczytaj_czcionke(22)
        self.czcionka_duzo = wczytaj_czcionke(42)
        self.czcionka_malo = wczytaj_czcionke(16)

        self.przesuniecie_drogi = 0.0
        self.czas_od_ostatniego_npc = 0.0
        self.npc = []
        self.scena = SCENA_GRANIE
        self.najlepszy_wynik = 0
        self.reset()

    def reset(self):
        """Ustawia stan gry na początkowy (używane też przy restarcie)."""
        self.gracz = pygame.Rect(
            LEWA_DROGA + SZEROKOSC_DROGI // 2 - ROZMIAR_AUTA // 2,
            WYSOKOSC - 110,
            ROZMIAR_AUTA,
            ROZMIAR_AUTA,
        )
        self.npc.clear()
        self.czas_od_ostatniego_npc = 0.0
        self.przesuniecie_drogi = 0.0
        self.punkty = 0.0
        self.zycia = LICZBA_ZYC
        self.czas_niezranialnosci = 0.0
        self.scena = SCENA_GRANIE

    def obsluz_zdarzenia(self):
        for zdarzenie in pygame.event.get():
            if zdarzenie.type == pygame.QUIT:
                return False
            if zdarzenie.type == pygame.KEYDOWN:
                if zdarzenie.key == pygame.K_ESCAPE:
                    return False
                if (
                    self.scena == SCENA_KONIEC
                    and zdarzenie.key in (pygame.K_r, pygame.K_RETURN, pygame.K_SPACE)
                ):
                    self.reset()
        return True

    def aktualizuj(self, dt):
        if self.scena == SCENA_KONIEC:
            return

        self.punkty += PUNKTY_NA_SEKUNDE * dt
        self.przesuniecie_drogi = (self.przesuniecie_drogi + PREDKOSC_NPC * dt) % 80
        self.czas_niezranialnosci = max(0.0, self.czas_niezranialnosci - dt)

        klawisze = pygame.key.get_pressed()
        kierunek = 0
        if klawisze[pygame.K_LEFT] or klawisze[pygame.K_a]:
            kierunek -= 1
        if klawisze[pygame.K_RIGHT] or klawisze[pygame.K_d]:
            kierunek += 1

        self.gracz.x += kierunek * PREDKOSC_GRACZA * dt
        self.gracz.x = max(
            LEWA_DROGA, min(self.gracz.x, PRAWA_DROGA - ROZMIAR_AUTA)
        )

        self.czas_od_ostatniego_npc += dt
        if self.czas_od_ostatniego_npc >= CZAS_ODSTEP_NPC:
            self.czas_od_ostatniego_npc -= CZAS_ODSTEP_NPC
            pas = random.randrange(LICZBA_PASOW)
            x = (
                LEWA_DROGA
                + pas * SZEROKOSC_PASA
                + (SZEROKOSC_PASA - ROZMIAR_AUTA) // 2
            )
            self.npc.append(
                pygame.Rect(x, -ROZMIAR_AUTA, ROZMIAR_AUTA, ROZMIAR_AUTA)
            )

        for auto in self.npc:
            auto.y += PREDKOSC_NPC * dt

        self.npc = [auto for auto in self.npc if auto.y < WYSOKOSC]

        if self.czas_niezranialnosci <= 0.0:
            for auto in self.npc:
                if self.gracz.colliderect(auto):
                    self.npc.remove(auto)
                    self.zycia -= 1
                    self.czas_niezranialnosci = CZAS_NIEZRANIALNOSCI
                    if self.zycia <= 0:
                        self.najlepszy_wynik = max(
                            self.najlepszy_wynik, int(self.punkty)
                        )
                        self.scena = SCENA_KONIEC
                    break

    def rysuj_tlo(self):
        self.okno.fill(KOLOR_TRAWY)
        przes = int(self.przesuniecie_drogi)

        # Paski trawy podkreślające ruch drogi.
        for y in range(-80 + przes, WYSOKOSC, 80):
            pygame.draw.rect(
                self.okno, KOLOR_TRAWY_CIEMNY, (0, y, LEWA_DROGA, 40)
            )
            pygame.draw.rect(
                self.okno, KOLOR_TRAWY_CIEMNY, (PRAWA_DROGA, y, LEWA_DROGA, 40)
            )

        pygame.draw.rect(
            self.okno,
            KOLOR_DROGI,
            (LEWA_DROGA, 0, SZEROKOSC_DROGI, WYSOKOSC),
        )

        # Krawędzie drogi.
        pygame.draw.rect(self.okno, KOLOR_LINII, (LEWA_DROGA - 4, 0, 4, WYSOKOSC))
        pygame.draw.rect(self.okno, KOLOR_LINII, (PRAWA_DROGA, 0, 4, WYSOKOSC))

        # Przerywane linie między pasami.
        for pas in range(1, LICZBA_PASOW):
            x = LEWA_DROGA + pas * SZEROKOSC_PASA - 2
            for y in range(-80 + przes, WYSOKOSC, 80):
                pygame.draw.rect(self.okno, KOLOR_LINII, (x, y, 4, 40))

    def rysuj_auto(self, prostokat, kolor):
        pygame.draw.rect(self.okno, kolor, prostokat)
        pygame.draw.rect(
            self.okno,
            KOLOR_SZYBY,
            (
                prostokat.x + 8,
                prostokat.y + 10,
                prostokat.width - 16,
                prostokat.height // 3,
            ),
        )

    def rysuj_interfejs(self):
        pasek = pygame.Surface((SZEROKOSC, 44), pygame.SRCALPHA)
        pasek.fill((0, 0, 0, 150))
        self.okno.blit(pasek, (0, 0))

        wynik = self.czcionka.render(f"Wynik: {int(self.punkty)}", True, (255, 255, 255))
        zycia = self.czcionka.render(f"Życia: {self.zycia}", True, (255, 255, 255))
        self.okno.blit(wynik, (14, 11))
        self.okno.blit(zycia, (SZEROKOSC - zycia.get_width() - 14, 11))

        wskazowka = self.czcionka_malo.render(
            "← → lub A/D – sterowanie", True, (230, 230, 230)
        )
        self.okno.blit(
            wskazowka,
            (SZEROKOSC // 2 - wskazowka.get_width() // 2, WYSOKOSC - 26),
        )

    def rysuj_koniec(self):
        zacienienie = pygame.Surface((SZEROKOSC, WYSOKOSC), pygame.SRCALPHA)
        zacienienie.fill((0, 0, 0, 170))
        self.okno.blit(zacienienie, (0, 0))

        napisy = [
            (self.czcionka_duzo, "Koniec gry", 250),
            (self.czcionka, f"Twój wynik: {int(self.punkty)}", 310),
            (self.czcionka, f"Najlepszy wynik: {self.najlepszy_wynik}", 345),
            (self.czcionka, "R – zagraj ponownie", 415),
            (self.czcionka_malo, "ESC – wyjście", 455),
        ]
        for czcionka, tekst, y in napisy:
            obraz = czcionka.render(tekst, True, (255, 255, 255))
            self.okno.blit(obraz, (SZEROKOSC // 2 - obraz.get_width() // 2, y))

    def rysuj(self):
        self.rysuj_tlo()
        for auto in self.npc:
            self.rysuj_auto(auto, KOLOR_NPC)

        # Miganie po kolizji sygnalizuje chwilową nietykalność.
        miganie = int(self.czas_niezranialnosci * 12) % 2 == 0
        if self.czas_niezranialnosci <= 0.0 or miganie:
            self.rysuj_auto(self.gracz, KOLOR_GRACZA)

        self.rysuj_interfejs()
        if self.scena == SCENA_KONIEC:
            self.rysuj_koniec()

        pygame.display.flip()

    def uruchom(self):
        while True:
            dt = self.zegar.tick(FPS) / 1000.0
            if not self.obsluz_zdarzenia():
                break
            self.aktualizuj(dt)
            self.rysuj()
        pygame.quit()


def main():
    Gra().uruchom()
    return 0


if __name__ == "__main__":
    sys.exit(main())
