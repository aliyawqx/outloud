import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { isStaff } from '@/lib/appLock'
import { deduct, refund, getBalance, resetIfDue, InsufficientCreditsError, COST_PER_PHOTO_SEARCH } from '@/lib/credits'
import { storeImageFromUrl } from '@/lib/images/blob'

export const maxDuration = 30

// POST /api/images/pick — the user attaches a stock photo. Charge happens HERE (not
// on search): deduct COST_PER_PHOTO_SEARCH, ping Unsplash's required download
// endpoint, copy the file into Blob, return the Blob URL + attribution.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const fullUrl = typeof b.fullUrl === 'string' ? b.fullUrl : ''
  const downloadLocation = typeof b.downloadLocation === 'string' ? b.downloadLocation : ''
  const photographer = typeof b.photographer === 'string' ? b.photographer : ''
  const photographerUrl = typeof b.photographerUrl === 'string' ? b.photographerUrl : ''
  if (!fullUrl || !/^https:\/\/images\.unsplash\.com\//.test(fullUrl)) {
    return NextResponse.json({ error: 'Pick a photo first.' }, { status: 400 })
  }

  // Metered by credits (staff unlimited). Charge before doing the work; refund if the
  // copy-to-Blob step fails so the user is never charged for a photo they didn't get.
  const staff = isStaff(session.email)
  let chargeLedgerId: string | undefined
  if (!staff) {
    await resetIfDue(session.userId)
    const balance = await getBalance(session.userId)
    if (balance < COST_PER_PHOTO_SEARCH) {
      return NextResponse.json(
        { error: 'Not enough credits.', insufficientCredits: true, cost: COST_PER_PHOTO_SEARCH, balance },
        { status: 402 },
      )
    }
    try {
      const charge = await deduct(session.userId, COST_PER_PHOTO_SEARCH, 'photo_search', { metadata: { kind: 'stock' } })
      chargeLedgerId = charge.ledgerId
    } catch (e) {
      if (e instanceof InsufficientCreditsError)
        return NextResponse.json({ error: 'Not enough credits.', insufficientCredits: true, cost: e.cost, balance: e.balance }, { status: 402 })
      throw e
    }
  }

  try {
    // Unsplash API guideline: trigger the download endpoint when a photo is used.
    if (downloadLocation && process.env.UNSPLASH_ACCESS_KEY) {
      await fetch(downloadLocation, {
        headers: { authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
        signal: AbortSignal.timeout(8_000),
      }).catch(() => {}) // best-effort; never block the attach on this ping
    }
    const { url } = await storeImageFromUrl(fullUrl, 'draft-images/stock')
    const alt = photographer ? `Photo by ${photographer} on Unsplash` : 'Photo from Unsplash'
    const creditsLeft = staff ? undefined : await getBalance(session.userId)
    return NextResponse.json({ url, source: 'stock', alt, photographer, photographerUrl, creditsLeft })
  } catch (err) {
    if (chargeLedgerId) await refund(session.userId, chargeLedgerId).catch(() => {})
    console.error('[images/pick] failed:', err)
    return NextResponse.json({ error: "Couldn't attach that photo. Try again." }, { status: 502 })
  }
}
