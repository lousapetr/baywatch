import type { ComponentChildren } from 'preact';
import { href } from '../router.ts';

const AEMET_WARNINGS = 'https://www.aemet.es/es/eltiempo/prediccion/avisos';

const buildFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** External link opened outside the app. */
function Ext({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function About() {
  return (
    <section class="card">
      <p class="small">
        <a href={href('/')}>← zpět na Přehled</a>
      </p>
      <h1>O aplikaci</h1>

      <h2>Zdroje dat</h2>
      <p>
        Vlny, příliv a počasí pocházejí z modelů služby <Ext href="https://open-meteo.com/">Open-Meteo.com</Ext> (Marine
        Weather API a Weather Forecast API), licence{' '}
        <Ext href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Ext>. Předpověď se stahuje na serveru každou
        hodinu; aplikace sama žádné cizí služby nevolá, nepoužívá cookies ani analytiku.
      </p>

      <h2>Přesnost</h2>
      <ul>
        <li>Jde o modelovou předpověď s rozlišením zhruba 8 km, vzdálenější dny jsou méně spolehlivé.</li>
        <li>
          Časy přílivu a odlivu jsou orientační (±30 min, model bývá o 15–30 min dřív než tabulky), výšky jsou vztažené
          k nule námořních map. Nepoužívejte pro navigaci.
        </li>
        <li>
          Model vidí otevřené moře, ne tvar pobřeží: místní vlny u útesů se mohou lišit, některá místa sdílejí společný
          bod modelu.
        </li>
        <li>Hodnocení nezohledňuje bezpečnost – velké vlny jsou nebezpečné, držte se dál od hrany útesů.</li>
      </ul>

      <h2>Jak funguje hodnocení</h2>
      <p>
        Síla vln se počítá z výšky a periody (výkon ≈ ½ · výška² · perioda). Ten se zmenší, pokud vlny nepřicházejí
        kolmo na pobřeží místa, a mírně i při odlivu, protože při přílivu dosáhnou vlny výš na skály. Výsledek se
        převede na 0–5 hvězdiček: 1★ je slabé, 3★ pěkné, 5★ bouře. Nejlepší čas se hledá jen přes den; vítr se do
        hodnocení nezapočítává, uvádí se jen kvůli pohodlí. Jde o první kalibraci, bude se ještě ladit.
      </p>

      <h2>Výstrahy</h2>
      <p>
        Oficiální výstrahy pro pobřeží Kantábrie najdete u španělské meteorologické služby:{' '}
        <Ext href={AEMET_WARNINGS}>AEMET – avisos</Ext> (vyberte Cantabria, pobřežní výstrahy).
      </p>

      <h2>Verze</h2>
      <p class="small muted">
        Verze {__APP_VERSION__}, sestaveno {buildFmt.format(__BUILD_TIME__ * 1000)}.
      </p>
    </section>
  );
}
