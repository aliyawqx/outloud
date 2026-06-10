// THE posting seam (free path). We do NOT auto-post via the API (writes are paid
// and need write scope). Instead we hand back an X web-intent link that opens the
// composer prefilled as a reply to the target post; the user reviews and posts it
// from their own session. Swap in a true API auto-reply behind postReply() later.

export type ReplyTarget = { tweetId: string; text: string }

/** X web-intent URL that opens the composer prefilled and set to reply to a post. */
export function replyIntentUrl(tweetId: string, text: string): string {
  const params = new URLSearchParams({ in_reply_to: tweetId, text })
  return `https://x.com/intent/tweet?${params.toString()}`
}

/** The posting boundary. Free tier: returns a web-intent link to open + post. */
export function postReply(target: ReplyTarget): { mode: 'intent'; url: string } {
  return { mode: 'intent', url: replyIntentUrl(target.tweetId, target.text) }
}
