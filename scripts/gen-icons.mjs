import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const outDir = join('extension', 'icons')
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}

/**
 * Generate a simple placeholder PNG icon with a shield shape.
 * For production, replace these with proper designed icons.
 */
function generatePlaceholderPng(size) {
  const width = size
  const height = size

  function crc32(buf) {
    let crc = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i]
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([typeBytes, data])
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, checksum])
  }

  // Shield-blue color: #4f6bed (primary color from the theme)
  const r = 79, g = 107, b = 237

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // IDAT: raw image data
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // filter byte: none
    for (let x = 0; x < width; x++) {
      const cx = width / 2
      const cy = height / 2
      const dx = Math.abs(x - cx) / cx
      const dy = Math.abs(y - cy) / cy
      const topHalf = y < cy
      const inShape = topHalf
        ? (dx + dy * 0.3 < 0.85)
        : (dx * 1.2 + dy < 1.0)

      if (inShape) {
        rawData.push(r, g, b)
      } else {
        rawData.push(0, 0, 0)
      }
    }
  }

  const compressed = deflateSync(Buffer.from(rawData))
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [16, 32, 48, 128]) {
  const filePath = join(outDir, `${size}.png`)
  const png = generatePlaceholderPng(size)
  writeFileSync(filePath, png)
}

console.log('Generated shield icons in', outDir)
