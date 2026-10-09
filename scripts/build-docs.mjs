#!/usr/bin/env node
/**
 * Bangun situs dokumentasi FLOW saja (tanpa kode aplikasi).
 *
 * Langkah:
 *   1. Regenerasi artefak archify  -> ./scripts/flows-gate.sh --all
 *   2. Salin docs/design/flows/    -> dist-docs/
 *
 * `index.html` di dalamnya adalah dashboard flow; tiap <slug>/<slug>.html
 * adalah diagramnya. Output statis, tanpa dependency runtime.
 *
 * Pakai:
 *   node scripts/build-docs.mjs              # regenerate + salin
 *   node scripts/build-docs.mjs --skip-gate  # salin saja (artefak sudah ada)
 *
 * Deploy: arahkan host statis (mis. Vercel project kedua) ke:
 *   Build Command    : npm run docs:build
 *   Output Directory : dist-docs
 * Preview lokal: npm run docs:serve -- --root dist-docs
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = resolve(ROOT, 'docs/design/flows')
const OUT = resolve(ROOT, 'dist-docs')
const skipGate = process.argv.includes('--skip-gate')

console.log('== bangun dokumentasi flow ==')

if (!skipGate) {
  const gate = spawnSync('./scripts/flows-gate.sh', ['--all'], { cwd: ROOT, stdio: 'inherit' })
  if (gate.status !== 0) {
    console.error('flows-gate gagal — artefak tidak lengkap; build dibatalkan')
    process.exit(gate.status ?? 1)
  }
} else {
  console.log('  (lewati flows-gate — memakai artefak yang ada)')
}

if (!existsSync(resolve(SRC, 'index.html'))) {
  console.error(`Tidak ada ${SRC}/index.html — jalankan tanpa --skip-gate`)
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
cpSync(SRC, OUT, {
  recursive: true,
  // Buang hanya screenshot visual-check (berat, regenerable). HTML/JSON/README ikut.
  filter: (src) => !src.endsWith('.png'),
})

const flows = readdirSync(OUT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^f\d+-/.test(e.name))
  .map((e) => e.name)
console.log(`OK  ${flows.length} flow -> ${OUT}`)
console.log('    preview: npm run docs:serve -- --root dist-docs')
