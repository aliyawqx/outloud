import { readFile } from 'node:fs/promises'
import { put } from '@vercel/blob'

// One-off: upload the promo clip to Vercel Blob and print its public URL.
// Run: BLOB_READ_WRITE_TOKEN=... npx tsx scripts/upload-intro.ts
async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  const data = await readFile('promo/1782838281.MP4')
  const blob = await put('demo/intro.mp4', data, {
    access: 'public',
    contentType: 'video/mp4',
    token,
    allowOverwrite: true,
  })
  console.log(blob.url)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
