import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

function createPng(width, height, pixelFn) {
  const buffer = Buffer.alloc(height * (width * 4 + 1))
  let offset = 0

  for (let y = 0; y < height; y++) {
    buffer[offset++] = 0 // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x / width, y / height, x, y)
      buffer[offset++] = r
      buffer[offset++] = g
      buffer[offset++] = b
      buffer[offset++] = a
    }
  }

  const idatData = zlib.deflateSync(buffer)

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.alloc(4)
    const crc = crc32(Buffer.concat([typeBuf, data]))
    crcBuf.writeUInt32BE(crc >>> 0, 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }

  // Precomputed CRC table
  function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i]
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
      }
    }
    return (c ^ 0xffffffff) >>> 0
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // Bit depth
  ihdrData[9] = 6 // Color type: RGBA
  ihdrData[10] = 0 // Compression
  ihdrData[11] = 0 // Filter
  ihdrData[12] = 0 // Interlace

  const ihdr = chunk('IHDR', ihdrData)
  const idat = chunk('IDAT', idatData)
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// Draw a blue shield with cyan border
function shieldPixel(u, v, x, y) {
  // Normalize coords to -1..1
  const nx = (u - 0.5) * 2
  const ny = (v - 0.5) * 2

  // Shield boundary calculation
  const inTop = ny >= -0.75 && ny <= 0.1 && Math.abs(nx) <= 0.8
  const inBottom = ny > 0.1 && ny <= 0.85 && Math.abs(nx) <= 0.8 * (1 - (ny - 0.1) / 0.75)

  if (inTop || inBottom) {
    // Border check
    const border = Math.abs(nx) > 0.65 || ny < -0.65 || (ny > 0.1 && Math.abs(nx) > 0.8 * (1 - (ny - 0.1) / 0.75) - 0.15)
    if (border) {
      return [56, 189, 248, 255] // Cyan border (#38bdf8)
    }
    return [37, 84, 199, 255] // Royal navy blue fill (#2554c7)
  }

  return [0, 0, 0, 0] // Transparent
}

const iconsDir = path.resolve('c:/Users/Admin/Desktop/threatshare-ui-prototype2/threatshare/extension/icons')
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true })

for (const size of [16, 48, 128]) {
  const png = createPng(size, size, shieldPixel)
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png)
  console.log(`Created icon${size}.png (${size}x${size})`)
}
