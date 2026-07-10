import { readFile } from 'node:fs/promises'
import { put } from '@vercel/blob'

// Upload the landing demo clip to Vercel Blob and print its public URL.
// The clip CANNOT ship inside the deploy: Vercel CLI honors .gitignore's *.mp4
// exclusion (a public/ mp4 silently 404s in prod), so Blob is the ONE way.
// Run: BLOB_READ_WRITE_TOKEN=... npx tsx scripts/upload-intro.ts
// Then make sure lib/media.ts INTRO_VIDEO_URL matches the printed URL.
async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  const data = await readFile('public/demo/intro-v2.mp4')
  const blob = await put('demo/intro-v2.mp4', data, {
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
