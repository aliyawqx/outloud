import { put } from '@vercel/blob'

// One seam for storing draft images in Vercel Blob. Every flow (AI, stock, upload)
// ends here: bytes in → a public, immutable URL out that gets stored on the draft
// and handed to the publishers. BLOB_READ_WRITE_TOKEN is read from env by @vercel/blob.

/** Whether Vercel Blob is configured. Writes throw without this token, so routes
 *  guard on it up front and return a clear "not set up" instead of a generic 502. */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Store image bytes under `draft-images/` and return the public Blob URL. */
export async function storeImage(
  data: ArrayBuffer | Blob | Buffer,
  contentType: string,
  prefix = 'draft-images',
): Promise<string> {
  const ext = EXT[contentType] ?? 'jpg'
  // addRandomSuffix keeps names unique without us tracking ids; access is public so
  // X/Threads (and the browser thumbnail) can read it.
  const blob = await put(`${prefix}/image.${ext}`, data, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
  })
  return blob.url
}

/** Fetch a remote image (e.g. an Unsplash file) and copy it into Blob. Returns the
 *  Blob URL + the resolved content type. Throws on a non-image or failed fetch. */
export async function storeImageFromUrl(url: string, prefix?: string): Promise<{ url: string; contentType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`)
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  if (!contentType.startsWith('image/')) throw new Error('not an image')
  const buf = await res.arrayBuffer()
  return { url: await storeImage(buf, contentType, prefix), contentType }
}
