// Compile the canonical *.md prompt artifacts into bundled TS strings under lib/.
// Runs on predev/prebuild so prompts stay in sync and ship inside the serverless
// bundle (no runtime fs read on Vercel). Edit the .md, not the generated .ts.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ARTIFACTS = [
  { md: 'outloud-x-post-prompt.md', ts: 'lib/postPrompt.ts', name: 'POST_PROMPT' },
  { md: 'outloud-style-analysis-prompt.md', ts: 'lib/stylePrompt.ts', name: 'STYLE_ANALYSIS_PROMPT' },
  { md: 'outloud-intake-prompt.md', ts: 'lib/intakePrompt.ts', name: 'INTAKE_PROMPT' },
]

for (const a of ARTIFACTS) {
  const md = readFileSync(join(root, a.md), 'utf8')
  // Strip the leading HTML comment (authoring notes); keep the prompt body.
  const body = md.replace(/^<!--[\s\S]*?-->\s*/, '').trim()
  const out = `// AUTO-GENERATED from ${a.md} by scripts/build-prompt.mjs.\n// Do not edit by hand — edit the .md and run \`npm run gen:prompt\`.\nexport const ${a.name} = ${JSON.stringify(body)}\n`
  writeFileSync(join(root, a.ts), out)
  console.log('wrote %s (%d chars)', a.ts, body.length)
}
