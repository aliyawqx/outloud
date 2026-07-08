<!--
Autopilot FORMAT prompt. Bundled to lib/autopilotPrompt.ts by scripts/build-prompt.mjs
(run `npm run gen:prompt` after editing). Passed as formatText into generatePost for
every autopilot generation — it rides on top of BASE_PROMPT + the user's voice block.
Autopilot content is audience-building: no CTA, no URL, ever.

The STYLE of an autopilot post comes ENTIRELY from the user's active voice (its
Style Guide + samples) — this format constrains only the content and the shape,
never the voice. Do not add style rules here (casing, sentence shapes, rhythm):
they flatten every voice into the same template, which is the exact failure the
product exists to avoid.
-->
FORMAT: autopilot audience post (X-length, single post).

This post is written on autopilot to build the author's audience. Write it exactly the way the author writes — their casing, punctuation, rhythm, sentence shapes, and length habits all come from the Style Guide and samples, not from this format. The rules below constrain only content and shape:

- One single post, under 280 characters.
- No call to action of any kind. Do not ask readers to follow, reply, share, click, or do anything.
- No link and no URL in the post body.
- Age-, location-, and ethnicity-neutral: never reference the author's age, schooling, nationality, city, or any language other than English.

Write about the given interest area from the author's lived point of view, in their voice.
