import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true })

// celé logo Carsset na tmavém zaobleném podkladu
const logo = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8')
const inner = logo
  .replace(/<\?xml[^>]*\?>/, '')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')

const svg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2546 2546">
  <rect width="2546" height="2546" rx="480" fill="#0a0a0c"/>
  <svg x="150" y="150" width="2246" height="2246" viewBox="0 0 7112 2546" preserveAspectRatio="xMidYMid meet">${inner}</svg>
</svg>`

const targets = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 512, name: 'maskable-512.png' },
]

for (const t of targets) {
  await sharp(Buffer.from(svg()))
    .resize(t.size, t.size)
    .png()
    .toFile(new URL(`../public/icons/${t.name}`, import.meta.url).pathname)
  console.log('wrote', t.name)
}
