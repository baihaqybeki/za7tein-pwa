import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const prd = resolve(root, 'docs/product/prd')
const manifest = JSON.parse(readFileSync(resolve(prd, 'manifest.json'), 'utf8'))
const errors = []
const pending = readdirSync(resolve(prd, 'inbox')).filter((name) =>
  name !== '.gitkeep' && !manifest.revisions.some((item) => item.originalFilename === name),
)
if (pending.length) errors.push(`Unregistered PRD/BRS in inbox: ${pending.join(', ')}. Run npm run prd:intake.`)
const ids = new Set()
for (const revision of manifest.revisions) {
  if (ids.has(revision.id)) errors.push(`Duplicate revision ID: ${revision.id}`)
  ids.add(revision.id)
  const source = resolve(prd, revision.source)
  if (!existsSync(source)) errors.push(`Missing source: ${revision.id}`)
  else if (revision.sha256) {
    const hash = createHash('sha256').update(readFileSync(source)).digest('hex')
    if (hash !== revision.sha256) errors.push(`Source changed: ${revision.id}`)
  }
  for (const key of ['decisionRecord', 'milestonePlan']) {
    if (revision[key] && !existsSync(resolve(prd, revision[key]))) errors.push(`Missing ${key}: ${revision.id}`)
  }
}
const active = manifest.revisions.filter((item) => item.status === 'active')
if (active.length !== 1 || active[0]?.id !== manifest.activeRevision) errors.push('Exactly one active revision must match activeRevision')
if (active[0]) {
  const decision = readFileSync(resolve(prd, active[0].decisionRecord), 'utf8')
  const milestones = readFileSync(resolve(prd, active[0].milestonePlan), 'utf8')
  if (decision.includes('UNREVIEWED') || milestones.includes('UNREVIEWED')) errors.push('Active revision has unreviewed analysis or milestones')
}
for (const revision of manifest.revisions) {
  if (revision.supersedes && !ids.has(revision.supersedes)) errors.push(`Unknown supersedes: ${revision.id}`)
  if (revision.supersededBy && !ids.has(revision.supersededBy)) errors.push(`Unknown supersededBy: ${revision.id}`)
}

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(path, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}
const files = walk(resolve(root, 'src'))
const legacyDebt = JSON.parse(readFileSync(resolve(root, 'docs/design/legacy-debt.json'), 'utf8'))
for (const file of files.filter((path) => extname(path) === '.tsx')) {
  const relative = file.slice(root.length + 1)
  const svgBlocks = [...readFileSync(file, 'utf8').matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) =>
    createHash('sha256').update(match[0]).digest('hex'),
  )
  const approved = legacyDebt.inlineSvg[relative] ?? []
  if (JSON.stringify(svgBlocks) !== JSON.stringify(approved)) errors.push(`Inline SVG changed in ${relative}. Functional icons must use lucide-react; review decorative or brand exceptions explicitly.`)
}
for (const file of files.filter((path) => /src\/(pages|components)\//.test(path) || path.endsWith('/src/styles/_system.scss'))) {
  if (!['.tsx', '.css', '.scss'].includes(extname(file))) continue
  const relative = file.slice(root.length + 1)
  const count = (readFileSync(file, 'utf8').match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).length
  const allowed = legacyDebt.rawColors[relative] ?? 0
  if (count > allowed) errors.push(`New raw color in ${relative}: ${count} > legacy baseline ${allowed}. Use a design token or document an exception.`)
}
const tokens = readFileSync(resolve(root, 'src/styles/_tokens.scss'), 'utf8')
const defined = new Set([...tokens.matchAll(/(--[a-z][a-z0-9-]*)\s*:/g)].map((m) => m[1]))
for (const file of files.filter((path) => ['.scss', '.css', '.tsx', '.ts'].includes(extname(path)))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/(--[a-z][a-z0-9-]*)\s*:/g)) defined.add(match[1])
}
// Legacy Bootstrap selectors reference variables provided only when a Bootstrap
// button is active. Keep the ported stylesheet out of the new-token contract.
const legacyExternal = new Set(['--bs-btn-active-color', '--bs-btn-active-border-color'])
for (const file of files) {
  if (!['.scss', '.css', '.tsx', '.ts'].includes(extname(file))) continue
  const content = readFileSync(file, 'utf8')
  for (const match of content.matchAll(/var\((--[a-z][a-z0-9-]*)/g)) {
    if (!defined.has(match[1]) && !legacyExternal.has(match[1])) errors.push(`Undefined design token ${match[1]} in ${file.slice(root.length + 1)}`)
  }
}
// ── Flow specs (docs/design/flows/) ─────────────────────────────────────────
// Perilaku produk harus mengikuti PRD aktif dan flow yang sudah ada. Gate ini
// menjaga flow tetap utuh dan terikat ke revisi PRD aktif, sehingga perubahan
// kode yang menyimpang dari flow tidak bisa lolos tanpa memperbarui flow.
// Regenerasi diagram sendiri dijalankan manual: ./scripts/flows-gate.sh <slug>.
const flowsDir = resolve(root, 'docs/design/flows')
if (!existsSync(resolve(flowsDir, 'INDEX.json'))) {
  errors.push('Missing docs/design/flows/INDEX.json (business flow index)')
} else {
  const flowsIndex = JSON.parse(readFileSync(resolve(flowsDir, 'INDEX.json'), 'utf8'))
  const indexed = Object.keys(flowsIndex.flows ?? {})
  const flowFolders = readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^f\d+-/.test(entry.name))
    .map((entry) => entry.name)
  for (const slug of flowFolders) {
    if (!indexed.includes(slug)) errors.push(`Flow folder not listed in INDEX.json: ${slug}`)
    const primary = resolve(flowsDir, slug, `${slug}.json`)
    if (!existsSync(primary)) errors.push(`Missing flow spec: ${slug}/${slug}.json`)
    // Satu folder boleh punya spec tambahan (mis. <slug>.sequence.json untuk
    // orkestrasi sistem per flow). Semua spec wajib punya diagram_type.
    const specs = readdirSync(resolve(flowsDir, slug)).filter(
      (name) => name.endsWith('.json') && !name.includes('.visual-check.'),
    )
    for (const name of specs) {
      try {
        if (!JSON.parse(readFileSync(resolve(flowsDir, slug, name), 'utf8')).diagram_type) {
          errors.push(`Flow spec has no diagram_type: ${slug}/${name}`)
        }
      } catch {
        errors.push(`Flow spec invalid JSON: ${slug}/${name}`)
      }
    }
    if (!existsSync(resolve(flowsDir, slug, 'README.md'))) errors.push(`Missing flow README: ${slug}/README.md`)
  }
  for (const slug of indexed) {
    if (!flowFolders.includes(slug)) errors.push(`INDEX.json lists a missing flow folder: ${slug}`)
    const entry = flowsIndex.flows[slug] ?? {}
    if (!entry.type) errors.push(`Flow ${slug} has no diagram type in INDEX.json`)
    if (!entry.basis) errors.push(`Flow ${slug} has no requirement basis in INDEX.json`)
  }
  const flowPlan = resolve(flowsDir, 'PLAN.md')
  const planText = existsSync(flowPlan) ? readFileSync(flowPlan, 'utf8') : ''
  if (!readFileSync(resolve(flowsDir, 'INDEX.json'), 'utf8').includes(manifest.activeRevision) || !planText.includes(manifest.activeRevision)) {
    errors.push(`Flow specs are not tied to the active PRD revision ${manifest.activeRevision}; update docs/design/flows/ (INDEX.json and PLAN.md) to match`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Governance OK: ${manifest.activeRevision}; ${manifest.revisions.length} revisions; ${defined.size} tokens`)
