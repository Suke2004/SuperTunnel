import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const outDir = join('extension', 'icons')
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}

// 1x1 transparent PNG
const transparentPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9N4HcAAAAASUVORK5CYII='

for (const name of ['16.png', '32.png', '48.png', '128.png']) {
  const filePath = join(outDir, name)
  writeFileSync(filePath, Buffer.from(transparentPngBase64, 'base64'))
}

console.log('Wrote icons to', outDir)


