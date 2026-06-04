// One-off live round-trip for the voice store against the real DB.
// Run: npx tsx scripts/try-voice.ts   (requires DATABASE_URL in .env.local)
// Creates a profile, reads it back, sets active, then DELETES it — leaves no rows.
import { readFileSync } from 'node:fs'

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {
  /* rely on the environment */
}

async function main() {
  const { buildInspiration } = await import('../lib/voice/build')
  const store = await import('../lib/voice/store')
  const owner = `__selftest_${Date.now()}`

  const blend = buildInspiration([{ sourceId: 'naval', weight: 2 }, { sourceId: 'paul-graham', weight: 1 }])
  const created = await store.createProfile({
    ownerKey: owner,
    kind: 'inspiration',
    name: 'Self-test blend',
    sources: blend.sources,
    mergedTags: blend.mergedTags,
    styleSummary: blend.styleSummary,
    isActive: true,
  })
  console.log('created:', { id: created.id, name: created.name, isActive: created.isActive, tags: created.mergedTags })

  const list = await store.listProfiles(owner)
  console.log('listed:', list.length, 'profile(s); active:', list.filter((p) => p.isActive).length)

  const reactivated = await store.setActiveProfile(owner, created.id)
  console.log('setActive ok:', reactivated?.isActive)

  const otherOwnerSees = await store.getProfile('someone_else', created.id)
  console.log('owner scoping (other owner sees null):', otherOwnerSees === null)

  const deleted = await store.deleteProfile(owner, created.id)
  const after = await store.listProfiles(owner)
  console.log('deleted:', deleted, '| rows left for owner:', after.length)

  process.exit(0)
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
