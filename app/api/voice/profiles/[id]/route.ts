import { NextResponse } from 'next/server'
import { getOwnerKey } from '@/lib/voice/owner'
import { validateUpdateProfile } from '@/lib/voice/validateProfile'
import { buildInspiration, UnknownSourceError } from '@/lib/voice/build'
import {
  deactivateProfile,
  deleteProfile,
  getProfile,
  setActiveProfile,
  updateProfile,
  type ProfilePatch,
} from '@/lib/voice/store'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/voice/profiles/:id — edit fields, re-blend on source change, toggle active.
export async function PATCH(req: Request, { params }: Ctx) {
  const ownerKey = getOwnerKey(req)
  if (!ownerKey) return NextResponse.json({ error: 'Missing owner key.' }, { status: 401 })
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateUpdateProfile(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const { name, sources, isActive } = result.value

  try {
    // Content edits (name / re-blended sources) first.
    const patch: ProfilePatch = {}
    if (name !== undefined) patch.name = name
    if (sources !== undefined) {
      const blended = buildInspiration(sources)
      patch.sources = blended.sources
      patch.mergedTags = blended.mergedTags
      patch.styleSummary = blended.styleSummary
    }

    let profile = await getProfile(ownerKey, id)
    if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })

    if (Object.keys(patch).length > 0) {
      profile = await updateProfile(ownerKey, id, patch)
    }
    // Then activation toggle (keeps the single-active invariant in one place).
    if (isActive === true) profile = await setActiveProfile(ownerKey, id)
    else if (isActive === false) profile = await deactivateProfile(ownerKey, id)

    if (!profile) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })
    return NextResponse.json({ profile })
  } catch (err) {
    if (err instanceof UnknownSourceError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not update your voice.' }, { status: 500 })
  }
}

// DELETE /api/voice/profiles/:id
export async function DELETE(req: Request, { params }: Ctx) {
  const ownerKey = getOwnerKey(req)
  if (!ownerKey) return NextResponse.json({ error: 'Missing owner key.' }, { status: 401 })
  const { id } = await params

  try {
    const removed = await deleteProfile(ownerKey, id)
    if (!removed) return NextResponse.json({ error: 'Voice not found.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not delete your voice.' }, { status: 500 })
  }
}
