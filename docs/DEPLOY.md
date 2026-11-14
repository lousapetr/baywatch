# Návod na publikaci

Cíl: `https://baywatch.lope.me.uk` (subdoménu lze zvolit jinou) na Oracle VM,
kde už běží carstats. Baywatch běží vedle něj jako samostatný Docker Compose
projekt s vlastním Cloudflare tunelem – carstats se vůbec nedotkneme.

```
notebook ──(scripts/deploy.sh: build + rsync)──► VM ~/baywatch/
                                                   ├─ site/       statický web
                                                   ├─ fetcher/    fetch.mjs (spouští cron)
                                                   ├─ data/       forecast.json, status.json
                                                   ├─ nginx/      default.conf
                                                   ├─ docker-compose.yml
                                                   └─ .env        token tunelu
internet ─► Cloudflare ─► cloudflared ─► nginx (web:80)
```

Na VM se nic nebuilduje (šetří RAM), neotevírá se žádný port a není potřeba
řešit certifikáty – HTTPS zajišťuje Cloudflare.

## Předpoklady

- SSH přístup na VM (`ssh opc@<ip>`), na VM běží Docker s compose pluginem (díky carstats ano).
- Doména `lope.me.uk` je spravovaná v Cloudflare. **Neověřeno** – předpokládám
  to podle toho, že carstats používá Cloudflare Tunnel. Pokud ne, viz „Bez Cloudflare“ dole.
- Na notebooku Node 22, `rsync`, `ssh`. Na VM `rsync` (`sudo dnf install -y rsync`, pokud chybí).
- Projekt je implementovaný a `npm run build` vytváří `dist/site/` a `dist/fetcher/fetch.mjs`.

## 1. Cloudflare tunel (jednorázově, v prohlížeči)

1. Cloudflare dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**.
2. Typ **Cloudflared**, název `baywatch`, uložit.
3. Na stránce s instalačními příkazy nic nespouštěj, jen si zkopíruj **token**
   (dlouhý řetězec za `--token`).
4. Záložka **Public Hostname** → **Add a public hostname**:
   - Subdomain: `baywatch`, Domain: `lope.me.uk`, Path: prázdné
   - Service: Type `HTTP`, URL `web:80`
5. Uložit. Cloudflare sám vytvoří DNS záznam (CNAME na tunel).

> Chceš web přímo na `lope.me.uk` místo subdomény? Nech Subdomain prázdné.
> Jde to jen tehdy, pokud na kořeni domény už neběží něco jiného.

> Alternativa bez druhého tunelu: přidat public hostname do tunelu carstats a
> napojit `web` na jeho Docker síť. Ušetří ~30 MB RAM, ale sváže oba projekty
> (např. `docker compose down` u carstats pak selže na síti). Nedoporučuji.

## 2. Příprava serveru (jednorázově)

```bash
ssh opc@<ip>
mkdir -p ~/baywatch/{site,data,fetcher,nginx}
cd ~/baywatch
id                       # poznamenej si uid/gid (typicky 1000/1000)
cat > .env <<'EOF'
CLOUDFLARE_TUNNEL_TOKEN=<token z kroku 1>
PUID=1000
PGID=1000
EOF
chmod 600 .env
free -m                  # kontrola volné paměti; baywatch potřebuje ~50 MB trvale
```

`.env` existuje jen na serveru, do gitu nepatří. Je to jediné tajemství v celém projektu.

## 3. První nasazení (z notebooku)

```bash
cd ~/Repos/baywatch
cp .env.deploy.example .env.deploy
# uprav DEPLOY_HOST=opc@<ip nebo alias z ~/.ssh/config>, DEPLOY_DIR=baywatch
npm install
./scripts/deploy.sh
```

Doporučeně nejdřív na notebooku `./scripts/smoke.sh` (viz „Test nginx konfigurace“ níže).

Skript udělá: `npm run check` → `npm run build` → rsync `site/`, `fetcher/`,
`nginx/` a `docker-compose.yml` na server → `docker compose up -d` → reload
nginx → jednorázové spuštění fetcheru (vznikne `data/forecast.json`) → výpis stavu.

Očekávaný konec výstupu: služby `web` a `cloudflared` ve stavu `running`.

### Test nginx konfigurace (na notebooku, před nasazením)

```bash
./scripts/smoke.sh          # port lze změnit: SMOKE_PORT=8090 ./scripts/smoke.sh
```

Potřebuje docker. Skript (když chybí `dist/site/`, zavolá `npm run build`)
složí do dočasné složky `site/`, `data/` a `nginx/` stejně jako na serveru,
spustí `nginx:alpine` se stejnými volumes jako compose a zkontroluje
status kódy a hlavičky: `/` (no-cache), `/data/forecast.json` (JSON, gzip,
`max-age=300`), `/data/status.json` (no-cache), `/manifest.webmanifest`
(`application/manifest+json`), `/sw.js` (no-cache), soubor v `/assets/`
(`immutable`), ikona, 404 pro neexistující cesty a že `/data/` ani `/assets/`
nevypisují obsah složky (403). Kontejner po sobě uklidí. Pokud chybí
`src/web/public/data/forecast.json`, stáhne se čerstvý přes `dist/fetcher/fetch.mjs`.

Konfigurace nginx: každý `location` má vlastní `add_header` (nginx jinak
dědí hlavičky z nadřazené úrovně jen tehdy, když `location` žádnou nemá),
`autoindex off`, gzip včetně JSON a webmanifestu.

## 4. Cron pro stahování dat (jednorázově, na serveru)

```bash
crontab -e
```

a přidej řádek (vedle zálohy carstats):

```
7 * * * * cd /home/opc/baywatch && /usr/bin/docker compose run --rm fetcher >> fetch.log 2>&1
```

Každou hodinu v :07 se na pár sekund spustí kontejner, stáhne data z Open-Meteo
a přepíše `data/forecast.json`. Když stažení selže, starý soubor zůstane a web
ukáže stáří dat.

Odolnost proti zaseknutí: příkaz kontejneru v `docker-compose.yml` spouští
`node fetch.mjs` s tvrdým limitem 120 s (`timeout -s KILL 120`). Při selhání
nebo zaseknutí počká 60 s a zkusí to přesně jednou znovu (`FETCH_RETRY=1`),
pak to nechá být do dalšího běhu cronu. Limit je v compose, ne v cronu, aby
kill opravdu zabil node uvnitř kontejneru. Cron řádek se nemění.

Fetcher při každém běhu zapisuje `data/status.json` (`consecutiveFailures`,
`lastAttemptAt`, `lastSuccessAt`, `lastError`). Neúspěch se započítá už na
začátku běhu, takže se počítá i násilné zabití; běh včetně opakování se
počítá nejvýš jednou. Po úspěchu se počítadlo vynuluje. Když je
`consecutiveFailures` aspoň 3 (tři hodiny v kuse), aplikace zobrazí upozornění.
`status.json` je veřejný jako `forecast.json`; nginx ho posílá s
`Cache-Control: no-cache`, ostatní `/data/` s `max-age=300`.

Carstats na 1GB stroji má zálohu ve 3:00 a updaty ve 4:00 –
krátký běh fetcheru jim nevadí.

## 5. Ověření

```bash
# na serveru
cd ~/baywatch && docker compose ps
ls -la data/                      # forecast.json s čerstvým časem
tail fetch.log                    # po první hodině

# odkudkoli
curl -I https://baywatch.lope.me.uk/
curl -s https://baywatch.lope.me.uk/data/status.json       # consecutiveFailures: 0 po úspěšném běhu
curl -s https://baywatch.lope.me.uk/data/forecast.json | head -c 200
curl -I https://baywatch.lope.me.uk/manifest.webmanifest   # content-type: application/manifest+json
```

Jednorázově na serveru před prvním cronem – fetcher spoléhá na busybox `timeout`:

```bash
docker run --rm node:22-alpine sh -c 'timeout -s KILL 2 sleep 5; echo rc=$?'
```

Očekávaný výstup: po ~2 s `rc=137`. Chyba s nápovědou (usage) znamená, že
příkaz v compose je potřeba upravit.

## 6. Instalace na mobil (PWA)

- **Android / Chrome**: otevři web → menu ⋮ → **Přidat na plochu** / **Instalovat aplikaci**.
- **iPhone / Safari**: otevři web v Safari → tlačítko Sdílet → **Přidat na plochu**.

Aplikace se pak otevírá bez adresního řádku a bez signálu ukáže poslední stažená data.

## 7. Další nasazení a údržba

- **Nová verze**: `./scripts/deploy.sh` z notebooku. Nainstalované PWA se
  aktualizují samy (`autoUpdate`): nový service worker se stáhne při otevření
  a novou verzi uvidíš po zavření a opětovném otevření aplikace (někdy až napodruhé).
  Data (`forecast.json`) se berou přes síť (`NetworkFirst`, 5 s) a offline se použije poslední uložená kopie.
- **Logy**: `docker compose logs --tail 50 web`, `docker compose logs --tail 50 cloudflared`, `tail fetch.log`.
- **Aktualizace obrazů** (cca měsíčně, spolu s údržbou carstats):
  `cd ~/baywatch && docker compose pull && docker compose --profile job pull && docker compose up -d && docker image prune -f`
- **Rotace logu**: `fetch.log` roste ~1 řádek za hodinu; jednou za rok smaž, nebo nic.
- **Po restartu VM** naběhnou `web` i `cloudflared` samy (`restart: unless-stopped`),
  pokud jsi předtím neudělal `docker compose down`.
- **Vypnutí webu**: `cd ~/baywatch && docker compose down`, smaž řádek z crontabu,
  v Cloudflare smaž tunel `baywatch` (DNS záznam zmizí s ním, případně ho smaž ručně).

## 8. Řešení potíží

| Příznak | Kde hledat |
| --- | --- |
| Cloudflare chyba 1033 / 530 | `cloudflared` neběží nebo má špatný token: `docker compose logs cloudflared`, zkontroluj `.env` |
| Chyba 502 Bad Gateway | v tunelu je špatná Service URL (má být `http://web:80`), nebo neběží `web` |
| 403 / prázdná stránka | prázdné nebo nečitelné `site/` – `ls -la site/`; na Oracle Linuxu se SELinuxem řeší přípona `:z` u volumes (už v compose) |
| `forecast.json` 404 | fetcher ještě neběžel nebo padá: `docker compose run --rm fetcher` a přečti výstup |
| `EACCES` ve fetcheru | `PUID`/`PGID` v `.env` neodpovídá vlastníkovi `data/` (`id`, `ls -ln data`) |
| Data se neaktualizují | `crontab -l`, `tail fetch.log`, `systemctl status crond`; `cat data/status.json` (počet selhání a `lastError`) |
| Fetcher se zasekává (`status.json`: `consecutiveFailures` ≥ 3, v logu jen 137) | Open-Meteo nebo síť nereaguje; zkus `docker compose run --rm fetcher` ručně, `curl -sI https://marine-api.open-meteo.com`. Aplikace ukazuje upozornění, dokud se nepovede jeden běh |
| Stará verze webu v mobilu | zavři a znovu otevři aplikaci; případně Cloudflare → Caching → Purge Everything |
| rsync: command not found | `sudo dnf install -y rsync` na VM |

## Bez Cloudflare (jen pokud doména není v Cloudflare)

Pak je potřeba klasická cesta: A záznam domény na veřejnou IP VM, otevřít porty
80/443 jak v Oracle Security Listu, tak ve firewallu VM (`firewall-cmd`), a
místo `cloudflared` pustit reverse proxy s Let's Encrypt (např. Caddy). To není
v repu připravené – řekni si a doplním.

## Neověřeno

- Busybox `timeout -s KILL 120 …` v `node:22-alpine` se ověřuje příkazem v kroku 5
  (logiku jsem ověřil jen s GNU `timeout`).
- `docker compose config` je validní (ověřeno), ale nginx ani compose jsem v prostředí bez dockeru
  nespustil – `scripts/smoke.sh` je určený ke spuštění na notebooku.
- `deploy/` a `scripts/deploy.sh` jsem psal bez možnosti je spustit proti serveru –
  první nasazení ber jako test.
- Uživatel `opc`, uid 1000 a Oracle Linux předpokládám podle README carstats.
