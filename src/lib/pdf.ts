import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
import type { Customer, PhotoBlob } from './types'
import { fmtCZK, fmtDateTime } from './format'
import { ANTIRADAR_PRICE } from './pricing'

;(pdfMake as unknown as { vfs: unknown }).vfs =
  (pdfFonts as unknown as { vfs?: unknown; default?: unknown }).vfs ??
  (pdfFonts as unknown as { default?: unknown }).default ??
  pdfFonts

const RED = '#ef0001'

/** Data pro vygenerování PDF (fotky jako bloby v paměti). */
export interface PdfData {
  number: string
  createdAt: number
  carName: string
  carType: 'osobni' | 'dodavka'
  price: number
  deposit: number
  depositPaid: boolean
  antiradar: boolean
  rentalStart: string
  rentalEnd: string
  customer: Customer
  signature: string
  photos: PhotoBlob[]
}

// Údaje pronajímatele – CARSSET (Leoš Holásek)
export const LESSOR = {
  name: 'Leoš Holásek',
  ico: '08774838',
  ucet: '310683847/0300',
  phone: '+420 777 95 95 78',
  email: 'info@carsset.cz',
}

function labelValue(label: string, value: string): Content {
  return {
    columns: [
      { text: label, width: 150, color: '#6b7280', fontSize: 9 },
      { text: value || '—', bold: true, fontSize: 10 },
    ],
    margin: [0, 2, 0, 2],
  }
}

function checkbox(label: string, checked: boolean): Content {
  // Kreslený checkbox (canvas) – Roboto nemá glyfy ☑/☐, proto vlastní vykreslení.
  const box = {
    width: 18,
    canvas: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: 12,
        h: 12,
        r: 2,
        lineWidth: 1,
        lineColor: checked ? RED : '#9ca3af',
        ...(checked ? { color: RED } : {}),
      },
      ...(checked
        ? [
            {
              type: 'polyline' as const,
              lineWidth: 1.6,
              lineColor: '#ffffff',
              closePath: false,
              points: [
                { x: 2.5, y: 6.4 },
                { x: 5, y: 9 },
                { x: 9.5, y: 3 },
              ],
            },
          ]
        : []),
    ],
  } as unknown as Content
  return {
    columns: [box, { text: label, fontSize: 10, margin: [0, 0, 0, 0] }],
    columnGap: 4,
    margin: [0, 3, 0, 3],
  }
}

async function buildDocDefinition(c: PdfData): Promise<TDocumentDefinitions> {
  const cust = c.customer
  const fullName = `${cust.firstName} ${cust.lastName}`.trim() || '—'

  const prava = [
    'Pronajímatel provede s nájemcem zkušební jízdu, seznámí ho s provozními a technickými pokyny výrobce a předvede funkční způsobilost vozidla. Připomínky ke stavu vozidla musí nájemce uplatnit nejpozději před podpisem předávacího protokolu.',
    'Vozidlo může užívat a řídit pouze nájemce, případně se souhlasem pronajímatele osoba starší 18 let, držitel řidičského oprávnění příslušné skupiny; údaje o dalších řidičích musí být uvedeny v protokolu.',
    'Nájemce je oprávněn užívat vozidlo k účelu, k němuž obvykle slouží, souhlasí se stavem vozu i úpravami a přebírá odpovědnost za případné pokuty.',
    'Nájemce nese náklady na opravu, pokud závadu způsobil nedodržením pokynů výrobce nebo porušením pravidel silničního provozu.',
  ]
  const zakazy = [
    'Řídit vozidlo po požití alkoholu, omamných látek či léků ovlivňujících schopnost řízení, nebo takové osobě přenechat vozidlo k řízení.',
    'Poskytnout vozidlo jiné osobě za účelem podnikání.',
    'Přepravovat náklady těžší než nosnost vozidla, zvířata či nebezpečné náklady.',
    'Používat vozidlo k tažení jiných vozidel.',
    'Umístit na vozidlo jakoukoliv reklamu.',
    'Driftovat, smykovat, pálit gumy či jinak snižovat kondici vozidla (zákaz vypínání trakce „DTC").',
    'Kouřit ve vozidle (pod pokutou 3 000 Kč).',
    'Vrátit vozidlo v horším stavu; při nutnosti čištění a mytí hradí náklady nájemce (pokuta 500–3 500 Kč).',
    'Cesta mimo ČR bez předchozí písemné domluvy (pod pokutou 20 000 Kč).',
  ]
  const pojisteni = [
    'Vozidlo je pojištěno ze zákonné odpovědnosti i havarijně pro ČR a státy EU. Pronajímatel neodpovídá za věci ponechané ve vozidle.',
    'Každou pojistnou událost a poškození je nájemce povinen ihned ohlásit pronajímateli a Policii ČR a vyplnit záznam o nehodě; při nesplnění může být postih pojišťovny uplatněn proti nájemci.',
    'Nekrytou část nákladů škody hradí nájemce do maximální výše 10 % sjednané spoluúčasti. Při krádeži vozidla hradí nájemce 10 % z pořizovací ceny poníženou o amortizaci.',
    'Vozy jsou připojištěny; odtah zdarma v okruhu 100 km, každý další km hradí nájemce na místě.',
  ]
  const sankce = [
    'Porušení pravidla, že vozidlo smí řídit pouze nájemce (nebo schválená osoba starší 18 let s příslušným oprávněním).',
    'Oprava vozidla bez souhlasu pronajímatele nebo mimo určený servis.',
    'Za každou nevrácenou věc z vybavení vozidla + náhrada ceny nového příslušenství (pokuta 500 Kč / ks).',
    'Vrácení vozidla s prázdnou nádrží (pokuta 2 500 Kč + cena paliva).',
    'Prodlení s vrácením o více než 1 hodinu (500 Kč za každou započatou hodinu).',
    'Poškození litého kola (odřené) 5 000–7 000 Kč / ks dle rozsahu.',
    'Havárie a následná oprava v servisu: 3 000 Kč / den jako ušlý zisk + náklady opravy.',
  ]
  const gdpr = [
    'Osobní údaje nájemce budou zpracovány pouze za účelem realizace smluvního vztahu (pronájmu vozidla); poskytnutí je nezbytné pro splnění smlouvy.',
    'Pronajímatel předá osobní údaje dalším subjektům jen ze zákonného důvodu nebo pro ochranu svých práv (např. vymáhání pohledávky).',
    'Nájemce má právo na přístup k údajům, jejich opravu či výmaz, omezení zpracování, námitku i přenositelnost; se stížností se může obrátit na Úřad pro ochranu osobních údajů.',
    'Údaje jsou zpracovávány po dobu trvání smlouvy a dále po dobu nezbytnou k ochraně práv pronajímatele.',
  ]
  const zaver = [
    'Práva a povinnosti výslovně neupravená se řídí zákonem č. 89/2012 Sb., občanský zákoník, v platném znění.',
    'Případné spory rozhodují příslušné soudy České republiky.',
    'Smluvní strany prohlašují, že si smlouvu před podpisem přečetly, byla uzavřena podle jejich pravé a svobodné vůle, vážně a srozumitelně, nikoli v tísni.',
  ]

  const content: Content[] = [
    {
      columns: [
        { text: 'CARSSET', style: 'brand' },
        { text: `Smlouva č. ${c.number}`, alignment: 'right', style: 'brand' },
      ],
    },
    { text: 'SMLOUVA O NÁJMU DOPRAVNÍHO PROSTŘEDKU', style: 'h1', margin: [0, 6, 0, 2] },
    { text: `Číslo smlouvy: ${c.number}`, bold: true, fontSize: 11, color: RED, margin: [0, 0, 0, 2] },
    {
      text: 'uzavřená dle § 2321 a násl. zákona č. 89/2012 Sb., občanský zákoník',
      style: 'sub',
      margin: [0, 0, 0, 10],
    },

    { text: '1. Smluvní strany', style: 'h2' },
    { text: 'Pronajímatel', style: 'caption', margin: [0, 4, 0, 2] },
    labelValue('Jméno', LESSOR.name),
    labelValue('IČO', LESSOR.ico),
    labelValue('Bankovní spojení', LESSOR.ucet),
    labelValue('Kontakt', `${LESSOR.phone}, ${LESSOR.email}`),

    { text: 'Nájemce', style: 'caption', margin: [0, 8, 0, 2] },
    labelValue('Jméno a příjmení', fullName),
    labelValue('Identifikátor (RČ / č. OP)', cust.identifier),
    labelValue('E-mail', cust.email),
    labelValue('Telefon', cust.phone),

    { text: '2. Předmět nájmu', style: 'h2', margin: [0, 10, 0, 0] },
    labelValue('Vozidlo', c.carName),
    labelValue('Kategorie', c.carType === 'dodavka' ? 'Dodávka' : 'Osobní / sportovní'),

    { text: '3. Doba a cena nájmu', style: 'h2', margin: [0, 10, 0, 0] },
    labelValue('Začátek nájmu', fmtDateTime(c.rentalStart)),
    labelValue('Konec nájmu', fmtDateTime(c.rentalEnd)),
    labelValue('Cena nájmu', fmtCZK(c.price - (c.antiradar ? ANTIRADAR_PRICE : 0))),
    ...(c.antiradar ? [labelValue('Antiradar', `+ ${fmtCZK(ANTIRADAR_PRICE)}`)] : []),
    labelValue('Cena celkem', fmtCZK(c.price)),
    labelValue('Vratná kauce', fmtCZK(c.deposit)),

    { text: '4. Doplňky a kontrola', style: 'h2', margin: [0, 10, 0, 4] },
    checkbox('Nájemce si půjčuje antiradar', c.antiradar),
    checkbox('Kauce byla uhrazena při převzetí', c.depositPaid),

    { text: 'IV. Práva a povinnosti smluvních stran', style: 'h2', margin: [0, 12, 0, 4], pageBreak: 'before' },
    { ol: prava, fontSize: 9, lineHeight: 1.15, margin: [0, 0, 0, 6] },
    { text: 'Nájemce nesmí:', bold: true, fontSize: 9.5, margin: [0, 2, 0, 2] },
    { ol: zakazy, fontSize: 9, lineHeight: 1.15, margin: [0, 0, 0, 8] },

    { text: 'V. Pojištění', style: 'h2', margin: [0, 8, 0, 4] },
    { ol: pojisteni, fontSize: 9, lineHeight: 1.15, margin: [0, 0, 0, 8] },

    { text: 'VI. Sankce', style: 'h2', margin: [0, 8, 0, 4], pageBreak: 'before' },
    { text: 'Nájemce je povinen zaplatit pronajímateli smluvní pokutu ve výši 10 000 Kč za každý porušený případ z následujících:', fontSize: 9, margin: [0, 0, 0, 4] },
    { ol: sankce, fontSize: 9, lineHeight: 1.15, margin: [0, 0, 0, 4] },
    { text: 'Smluvní pokuty je nutno uhradit ihned po vrácení vozidla (hotově nebo na účet ' + LESSOR.ucet + '). Pronajímatel nenese odpovědnost za pokuty způsobené úpravami vozů.', fontSize: 9, margin: [0, 0, 0, 8] },

    { text: 'VII. Zpracování osobních údajů (GDPR)', style: 'h2', margin: [0, 8, 0, 4] },
    { ol: gdpr, fontSize: 9, lineHeight: 1.15, margin: [0, 0, 0, 8] },

    { text: 'VIII. Ostatní a závěrečná ujednání', style: 'h2', margin: [0, 8, 0, 4] },
    { ol: zaver, fontSize: 9, lineHeight: 1.15, margin: [0, 0, 0, 10] },

    {
      text: 'Nájemce svým podpisem potvrzuje, že si smlouvu přečetl, souhlasí s jejím obsahem a převzal vozidlo v pořádku.',
      fontSize: 9.5,
      margin: [0, 4, 0, 20],
    },

    {
      columns: [
        [
          { text: `V Brně, dne ${new Date(c.createdAt).toLocaleDateString('cs-CZ')}`, fontSize: 9, margin: [0, 0, 0, 30] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }] },
          { text: `Pronajímatel – ${LESSOR.name}`, fontSize: 9, margin: [0, 4, 0, 0] },
        ],
        [
          c.signature
            ? { image: c.signature, fit: [170, 70] }
            : { text: '', margin: [0, 0, 0, 40] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 0.5 }] },
          { text: `Nájemce – ${fullName}`, fontSize: 9, margin: [0, 4, 0, 0] },
        ],
      ],
      columnGap: 30,
    },
  ]

  // Přílohy – fotky dokladů a vozidla
  const photos = c.photos ?? []
  const docs = photos.filter((p) => p.kind !== 'car')
  const carPics = photos.filter((p) => p.kind === 'car')
  const docLabels: Record<string, string> = {
    idFront: 'Občanský průkaz – přední strana',
    idBack: 'Občanský průkaz – zadní strana',
    licenseFront: 'Řidičský průkaz – přední strana',
    licenseBack: 'Řidičský průkaz – zadní strana',
  }
  if (docs.length) {
    content.push({ text: 'Přílohy – doklady nájemce', style: 'h2', pageBreak: 'before' })
    for (const p of docs) {
      const url = await blobToDataUrl(p.blob)
      content.push({ text: docLabels[p.kind] ?? 'Doklad', style: 'caption', margin: [0, 8, 0, 4] })
      content.push({ image: url, fit: [500, 300], margin: [0, 0, 0, 8] })
    }
  }
  if (carPics.length) {
    content.push({ text: 'Přílohy – stav vozidla', style: 'h2', pageBreak: 'before' })
    for (let i = 0; i < carPics.length; i += 2) {
      const a = await blobToDataUrl(carPics[i].blob)
      const b = carPics[i + 1] ? await blobToDataUrl(carPics[i + 1].blob) : null
      content.push({
        columns: [{ image: a, fit: [250, 180] }, b ? { image: b, fit: [250, 180] } : { text: '' }],
        columnGap: 10,
        margin: [0, 0, 0, 8],
      })
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    styles: {
      brand: { fontSize: 13, color: RED, bold: true },
      h1: { fontSize: 16, bold: true },
      h2: { fontSize: 12, bold: true, color: RED, margin: [0, 6, 0, 4] },
      caption: { fontSize: 10, bold: true, color: '#374151' },
      sub: { fontSize: 9, italics: true, color: '#6b7280' },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Carsset · smlouva č. ${c.number}`, fontSize: 8, color: '#9ca3af', margin: [40, 0, 0, 0] },
        { text: `Strana ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 8, color: '#9ca3af', margin: [0, 0, 40, 0] },
      ],
      margin: [0, 16, 0, 0],
    }),
  }
}

export async function generatePdfBlob(c: PdfData): Promise<Blob> {
  const def = await buildDocDefinition(c)
  return new Promise((resolve) => {
    ;(pdfMake.createPdf(def) as unknown as {
      getBlob: (cb: (b: Blob) => void) => void
    }).getBlob((blob) => resolve(blob))
  })
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
