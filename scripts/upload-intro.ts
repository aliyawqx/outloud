import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { put } from '@vercel/blob'

// Upload the landing demo clip to Vercel Blob and print its public URL.
// The clip CANNOT ship inside the deploy: Vercel CLI honors .gitignore's *.mp4
// exclusion (a public/ mp4 silently 404s in prod), so Blob is the ONE way.
// Run: npx tsx scripts/upload-intro.ts
// (reads BLOB_READ_WRITE_TOKEN from the env, or from .env.vercel.local /
// .env.local - `vercel env pull` quotes values, so strip the quotes here).
// Then make sure lib/media.ts INTRO_VIDEO_URL matches the printed URL.
function tokenFromEnvFiles(): string | undefined {
  for (const f of ['.env.vercel.local', '.env.local']) {
    try {
      const m = /^BLOB_READ_WRITE_TOKEN=(.*)$/m.exec(readFileSync(f, 'utf8'))
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    } catch {}
  }
  return undefined
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.replace(/^["']|["']$/g, '') || tokenFromEnvFiles()
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
