import { linkedinVersion } from './config'
import {
  LinkedInAuthError,
  LinkedInPostTooLongError,
  LinkedInPublishError,
  LinkedInRateLimitError,
  LinkedInVersionError,
} from './errors'

// Publish path (spec §4). Primary: versioned Posts API (/rest/posts). Fallback:
// legacy /v2/ugcPosts — it's unconfirmed whether bare w_member_social is
// accepted at /rest/posts on Default Tier, so the first publish per instance
// probes and the result is cached (module-level; LINKEDIN_FORCE_UGC=1 pins it).

const POSTS_URL = 'https://api.linkedin.com/rest/posts'
const UGC_URL = 'https://api.linkedin.com/v2/ugcPosts'
const IMAGES_INIT_URL = 'https://api.linkedin.com/rest/images?action=initializeUpload'

export const LINKEDIN_TEXT_LIMIT = 3000

/** null = not probed yet; true = /rest/posts works; false = use /v2/ugcPosts. */
let postsApiWorks: boolean | null = null

/** Posts API `commentary` is LinkedIn "little text": these characters are
 *  markup and must be backslash-escaped or posts with parens/brackets break. */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`)
}

/** The created post id comes back in a response HEADER, not the body (spec §4a). */
export function extractPostId(headers: Headers): string | null {
  return headers.get('x-restli-id') ?? headers.get('x-linkedin-id')
}

function classifyHttpError(status: number, body: string): Error {
  if (status === 401) return new LinkedInAuthError()
  if (status === 403)
    return new LinkedInAuthError('LinkedIn denied posting permission — reconnect with the posting scope.')
  if (status === 429) return new LinkedInRateLimitError()
  if (status === 426 || (status === 400 && /version/i.test(body))) return new LinkedInVersionError()
  return new LinkedInPublishError(`LinkedIn rejected the post (${status}).`)
}

async function postJson(url: string, accessToken: string, payload: unknown, versioned: boolean): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      ...(versioned ? { 'LinkedIn-Version': linkedinVersion() } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
}

/** Three-step image upload on the Posts API path (spec §4c). Returns the image URN. */
async function uploadImage(accessToken: string, personUrn: string, imageUrl: string): Promise<string> {
  const init = await postJson(IMAGES_INIT_URL, accessToken, { initializeUploadRequest: { owner: personUrn } }, true)
  if (!init.ok) throw classifyHttpError(init.status, await init.text().catch(() => ''))
  const initData = (await init.json()) as { value?: { uploadUrl?: string; image?: string } }
  const uploadUrl = initData.value?.uploadUrl
  const imageUrn = initData.value?.image
  if (!uploadUrl || !imageUrn) throw new LinkedInPublishError('LinkedIn image upload init returned no uploadUrl.')

  const bin = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
  if (!bin.ok) throw new LinkedInPublishError('Could not fetch the image to upload.')
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: Buffer.from(await bin.arrayBuffer()),
    signal: AbortSignal.timeout(30_000),
  })
  if (!put.ok) throw new LinkedInPublishError(`LinkedIn image upload failed (${put.status}).`)
  return imageUrn
}

async function publishViaPostsApi(
  accessToken: string,
  personUrn: string,
  text: string,
  imageUrls: string[],
  imageAlts: string[],
): Promise<{ id: string }> {
  // Text-only is the default path; media only when the post carries it (spec §4c).
  let content: Record<string, unknown> | undefined
  if (imageUrls.length === 1) {
    const id = await uploadImage(accessToken, personUrn, imageUrls[0])
    content = { media: { id, altText: imageAlts[0] ?? '' } }
  } else if (imageUrls.length > 1) {
    const images = []
    for (let i = 0; i < imageUrls.length; i++) {
      images.push({ id: await uploadImage(accessToken, personUrn, imageUrls[i]), altText: imageAlts[i] ?? '' })
    }
    content = { multiImage: { images } }
  }

  const res = await postJson(
    POSTS_URL,
    accessToken,
    {
      author: personUrn,
      commentary: escapeLittleText(text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    },
    true,
  )
  if (!res.ok) throw classifyHttpError(res.status, await res.text().catch(() => ''))
  const id = extractPostId(res.headers)
  if (!id) throw new LinkedInPublishError('LinkedIn returned no post id header.')
  return { id }
}

async function publishViaUgc(accessToken: string, personUrn: string, text: string): Promise<{ id: string }> {
  const res = await postJson(
    UGC_URL,
    accessToken,
    {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text }, // plain text — no little-text escaping here
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    false, // Consumer host: no LinkedIn-Version header (spec §4b)
  )
  if (!res.ok) throw classifyHttpError(res.status, await res.text().catch(() => ''))
  const body = (await res.json().catch(() => ({}))) as { id?: string }
  const id = extractPostId(res.headers) ?? body.id
  if (!id) throw new LinkedInPublishError('LinkedIn returned no post id.')
  return { id }
}

/**
 * Publish a text post (+ optional images). Probes /rest/posts once per
 * instance and falls back to /v2/ugcPosts on a permission 403 (spec §4b);
 * the fallback is text-only, so images are skipped there (imageSkipped=true).
 */
export async function publishLinkedInPost(
  accessToken: string,
  personUrn: string,
  text: string,
  opts: { imageUrls?: string[]; imageAlts?: string[] } = {},
): Promise<{ id: string; imageSkipped: boolean }> {
  if (text.length > LINKEDIN_TEXT_LIMIT) throw new LinkedInPostTooLongError(LINKEDIN_TEXT_LIMIT)
  const imageUrls = (opts.imageUrls ?? []).filter(Boolean).slice(0, 9)
  const imageAlts = opts.imageAlts ?? []

  const forceUgc = process.env.LINKEDIN_FORCE_UGC === '1'
  if (!forceUgc && postsApiWorks !== false) {
    try {
      const { id } = await publishViaPostsApi(accessToken, personUrn, text, imageUrls, imageAlts)
      postsApiWorks = true
      return { id, imageSkipped: false }
    } catch (err) {
      // Only a PERMISSION failure demotes the endpoint (Default-tier probe, spec §4b);
      // auth/rate-limit/version errors propagate — falling back wouldn't help.
      if (postsApiWorks === null && err instanceof LinkedInAuthError && /posting permission/.test(err.message)) {
        console.warn(
          '[linkedin] /rest/posts denied for this tier — falling back to /v2/ugcPosts. Set LINKEDIN_FORCE_UGC=1 to pin.',
        )
        postsApiWorks = false
      } else {
        throw err
      }
    }
  }
  const { id } = await publishViaUgc(accessToken, personUrn, text)
  return { id, imageSkipped: imageUrls.length > 0 }
}
