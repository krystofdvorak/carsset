# Carsset – aplikace pro půjčovnu aut

Mobilní web aplikace (PWA) pro půjčovnu **Carsset Brno**. Vytvoření nájemní smlouvy na
telefonu: výběr vozidla, hlídání termínů v kalendáři, podpis prstem, PDF a automatické
odeslání e-mailem. V brandingu Carsset (červená `#ef0001`, tmavé téma).

## 🔗 Živý preview

**https://krystofdvorak.github.io/carsset/** — funguje na mobilu i desktopu (responzivní).
Data jsou lokální v prohlížeči každého zařízení (IndexedDB), preview startuje prázdný.

> Na GitHub Pages (statický hosting) běží vše kromě serverového odesílání e-mailu –
> tam appka nabídne **sdílení / stažení PDF**. Reálné auto-odesílání viz sekce níže (Vercel + Resend).

### Aktualizace preview
```bash
npm run deploy      # build + push na větev gh-pages (~1 min než se projeví)
```

## Funkce

- 🏎️ / 🚐 **Výběr kategorie** – osobní / sportovní vozy nebo dodávky
- 🚗 **Reálná vozidla a ceny** stažené z carsset.cz (Lexus LC 500, BMW M4/M2, Audi S3/S5/S6, Mercedes A45, Tesla S, BMW X5 + dodávky)
- ➕ **Přidat auto do nabídky** – vlastní vozidlo s cenami (5/10/24/24víkend/72 h a kauce)
- ⏱️ **Tarify 5 / 10 / 24 / 72 h** s automatikou:
  - víkendový začátek (pá–ne) → víkendová 24h sazba
  - **72h balíček jen o víkendu** (musí začít v pátek)
- 📅 **Kalendář a hlídání překrytí** – nedovolí půjčit stejné auto ve stejném čase dvěma klientům
- 🎚️ **Switche**: „půjčuje si antiradar" a „kauce uhrazena" (due diligence) – propíšou se do PDF
- 👤 **Klient** (jméno, příjmení, identifikátor – RČ/OP) s **našeptáváním** dřívějších klientů
- ✍️ **Podpis prstem** → vygenerování **PDF smlouvy** (české fonty, kreslené checkboxy)
- 📧 **Automatické odeslání PDF** zákazníkovi i majiteli (`dvorak@weblify.studio`)
- ✅ **„Auto vráceno v pořádku"** – po skončení termínu bez odkliknutí svítí smlouva **oranžově**
- 📱 Instalovatelné na plochu telefonu (PWA), funguje offline; data lokálně (IndexedDB)

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produkce do dist/
```

## Instalace na iPhone (PWA)

iOS instaluje PWA **jen ze Safari** a potřebuje HTTPS (na produkci zařídí Vercel):
Safari → **Sdílet** → **„Přidat na plochu"**. Na Androidu (Chrome) se nabídne „Nainstalovat aplikaci".

## Automatické odesílání e-mailů

Appka po podpisu volá serverless funkci [`api/send-contract.js`](api/send-contract.js) (Vercel + [Resend](https://resend.com)).

**Zapnutí reálného odesílání** (na Vercelu):
1. V Resend vytvoř API klíč a ověř odesílací doménu.
2. Ve Vercel projektu nastav env proměnné:
   - `RESEND_API_KEY` = `re_...`
   - `MAIL_FROM` = `Carsset <smlouvy@tvoje-domena.cz>` (na ověřené doméně)
   - `OWNER_EMAIL` = `dvorak@weblify.studio` (nepovinné, výchozí)
3. Deploy. Od té chvíle se každá smlouva sama pošle zákazníkovi i majiteli.

**Bez konfigurace** appka spadne do fallbacku: otevře systémové **sdílení** s PDF
(na telefonu → vybereš Mail a odešleš), na desktopu PDF stáhne. Nic se neztratí.

## Struktura

```
api/send-contract.js     # serverless odeslání e-mailu (Resend)
src/
  data/cars.ts           # přednastavená vozidla + ceníky (carsset.cz)
  db/db.ts               # IndexedDB (Dexie): contracts, cars, clients
  hooks/useCars.ts       # spojení přednastavených + vlastních aut
  lib/
    pricing.ts           # tarify, víkendová logika, 72h jen pá, výpočet konce
    overlap.ts           # kontrola překrytí rezervací
    pdf.ts               # generování PDF smlouvy (pdfmake, kreslené checkboxy)
    email.ts             # odeslání / sdílení PDF (owner: dvorak@weblify.studio)
    format.ts            # Kč, data, číslo smlouvy
  components/            # SignaturePad, Switch
  pages/                 # Home, NewContract (wizard), ContractDetail, AddCar
```

## Poznámky / další kroky

- **Ceny dodávek** jsou orientační (carsset.cz je veřejně neuvádí) – uprav v `src/data/cars.ts`
  nebo přidej vlastní přes „＋ Auto".
- Firemní údaje pronajímatele (IČO, adresa) uprav v `src/lib/pdf.ts` → `LESSOR`.
- **pdfmake je záměrně na verzi 0.2.x** – verze 0.3 (beta) má jiné API a generování visí.
- Cloudové úložiště (sdílení mezi zařízeními, záloha): připraveno na výměnu vrstvy `src/db/db.ts`
  za Supabase (contracts/cars/clients → tabulky, PDF → Storage).
- 🤖 Vygenerováno s [Claude Code](https://claude.com/claude-code)
