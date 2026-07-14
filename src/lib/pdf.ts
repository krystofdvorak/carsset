import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
import type { Contract } from '../db/db'
import { TIERS } from '../data/cars'
import { fmtCZK, fmtDateTime } from './format'
import { ANTIRADAR_PRICE } from './pricing'

;(pdfMake as unknown as { vfs: unknown }).vfs =
  (pdfFonts as unknown as { vfs?: unknown; default?: unknown }).vfs ??
  (pdfFonts as unknown as { default?: unknown }).default ??
  pdfFonts

const RED = '#ef0001'

// Údaje pronajímatele – Carsset (uprav dle reálných firemních údajů)
export const LESSOR = {
  name: 'Carsset – půjčovna aut Brno',
  ico: '00000000',
  address: 'Brno',
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

function buildDocDefinition(c: Contract): TDocumentDefinitions {
  const tier = TIERS.find((t) => t.key === c.tier)
  const cust = c.customer
  const fullName = `${cust.firstName} ${cust.lastName}`.trim() || '—'

  const clauses = [
    'Nájemce prohlašuje, že je držitelem platného řidičského oprávnění příslušné skupiny a je způsobilý k řízení vozidla.',
    'Nájemce je povinen vrátit vozidlo ve sjednaném termínu, čisté a s plnou nádrží. Za každou započatou hodinu prodlení náleží pronajímateli smluvní pokuta.',
    'Nájemce nese odpovědnost za škodu na vozidle vzniklou v době nájmu, a to do výše sjednané spoluúčasti / kauce.',
    'Je zakázáno kouření ve vozidle, účast na závodech a řízení pod vlivem alkoholu či návykových látek.',
    'Vozidlo nesmí být bez písemného souhlasu pronajímatele vyvezeno mimo území České republiky.',
    'Kauce bude vrácena při vrácení vozidla bez závad. Smluvní strany souhlasí se zpracováním osobních údajů pro účely této smlouvy dle GDPR.',
  ]

  const content: Content[] = [
    {
      columns: [
        { text: 'CARSSET', style: 'brand' },
        { text: `Smlouva č. ${c.number}`, alignment: 'right', style: 'brand' },
      ],
    },
    { text: 'SMLOUVA O NÁJMU DOPRAVNÍHO PROSTŘEDKU', style: 'h1', margin: [0, 6, 0, 2] },
    {
      text: 'uzavřená dle § 2321 a násl. zákona č. 89/2012 Sb., občanský zákoník',
      style: 'sub',
      margin: [0, 0, 0, 10],
    },

    { text: '1. Smluvní strany', style: 'h2' },
    { text: 'Pronajímatel', style: 'caption', margin: [0, 4, 0, 2] },
    labelValue('Název', LESSOR.name),
    labelValue('Sídlo', LESSOR.address),
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
    labelValue('Tarif', tier?.label ?? c.tier),
    labelValue('Cena nájmu', fmtCZK(c.price - (c.antiradar ? ANTIRADAR_PRICE : 0))),
    ...(c.antiradar ? [labelValue('Antiradar', `+ ${fmtCZK(ANTIRADAR_PRICE)}`)] : []),
    labelValue('Cena celkem', fmtCZK(c.price)),
    labelValue('Vratná kauce', fmtCZK(c.deposit)),

    { text: '4. Doplňky a kontrola', style: 'h2', margin: [0, 10, 0, 4] },
    checkbox('Nájemce si půjčuje antiradar', c.antiradar),
    checkbox('Kauce byla uhrazena při převzetí', c.depositPaid),

    { text: '5. Ujednání smluvních stran', style: 'h2', margin: [0, 10, 0, 4] },
    { ol: clauses, fontSize: 9.5, lineHeight: 1.15, margin: [0, 0, 0, 10] },

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
          { text: 'Pronajímatel (Carsset)', fontSize: 9, margin: [0, 4, 0, 0] },
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

export function generatePdfBlob(c: Contract): Promise<Blob> {
  const def = buildDocDefinition(c)
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
