// kie.ai image generation (unified Jobs API). All generation is async: create a
// task, then poll recordInfo until it succeeds. Returns the model's temporary image
// URL; the caller copies it into our own Blob. Throws on failure/timeout so the
// route can avoid charging for a render that never happened.

const BASE = 'https://api.kie.ai/api/v1/jobs'
// Override to swap Flux variants (cheaper/faster) without code changes.
const MODEL = process.env.KIE_IMAGE_MODEL || 'flux-2/pro-text-to-image'
const POLL_MS = 2_000
const MAX_WAIT_MS = 50_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type RecordInfo = {
  data?: { state?: string; resultJson?: string; failMsg?: string }
}

/** Generate one image from a prompt. Returns the result URL kie hosts (temporary). */
export async function generateImage(prompt: string): Promise<string> {
  const key = process.env.KIE_API_KEY
  if (!key) throw new Error('KIE_API_KEY not set')
  const auth = { authorization: `Bearer ${key}` }

  // 1) Create the task.
  const createRes = await fetch(`${BASE}/createTask`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: { prompt, aspect_ratio: '1:1' } }),
    signal: AbortSignal.timeout(15_000),
  })
  const created = (await createRes.json().catch(() => null)) as { data?: { taskId?: string }; msg?: string } | null
  const taskId = created?.data?.taskId
  if (!createRes.ok || !taskId) throw new Error(`kie createTask failed: ${created?.msg || createRes.status}`)

  // 2) Poll until success/fail or we run out of time (route maxDuration covers this).
  const deadline = Date.now() + MAX_WAIT_MS
  for (;;) {
    await sleep(POLL_MS)
    const res = await fetch(`${BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: auth,
      signal: AbortSignal.timeout(15_000),
    })
    const info = (await res.json().catch(() => null)) as RecordInfo | null
    const state = info?.data?.state
    if (state === 'success') {
      const urls = (JSON.parse(info!.data!.resultJson || '{}') as { resultUrls?: string[] }).resultUrls
      const url = Array.isArray(urls) ? urls[0] : undefined
      if (!url) throw new Error('kie: success with no result url')
      return url
    }
    if (state === 'fail') throw new Error(`kie generation failed: ${info?.data?.failMsg || 'unknown'}`)
    if (Date.now() > deadline) throw new Error('kie: generation timed out')
  }
}
