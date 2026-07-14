import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true })

// App icon: dark rounded square + red comet mark (odkaz na logo Carsset)
const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#0a0a0c"/>
  <!-- red comet / swoosh -->
  <path d="M300 96 c-8 60 -14 130 -20 200 c-6 66 -12 120 -28 148 c-10 -46 -14 -104 -18 -150 c-4 -44 -8 -74 -18 -96 c14 -40 40 -76 102 -102 z"
        fill="#ef0001"/>
  <circle cx="212" cy="360" r="30" fill="#ef0001"/>
  <text x="256" y="452" font-family="Arial, sans-serif" font-size="70" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="4">CARSSET</text>
</svg>`

const targets = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 512, name: 'maskable-512.png' },
]

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size)))
    .resize(t.size, t.size)
    .png()
    .toFile(new URL(`../public/icons/${t.name}`, import.meta.url).pathname)
  console.log('wrote', t.name)
}
