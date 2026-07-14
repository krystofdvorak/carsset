import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true })

// vytáhni červenou pulzní značku přímo z loga
const logo = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8')
const redPath = logo.match(/<path d="([^"]+)"[^>]*fill:#ef0001/)[1]

const svg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2546 2546">
  <rect width="2546" height="2546" rx="480" fill="#0a0a0c"/>
  <svg x="323" y="323" width="1900" height="1900" viewBox="480 40 1400 2470" preserveAspectRatio="xMidYMid meet">
    <path d="${redPath}" fill="#ef0001"/>
  </svg>
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
