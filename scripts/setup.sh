#!/usr/bin/env bash
# Setup sekali per clone: pasang git hooks + pastikan skill agent (archify, atlas-owner) ada.
#
# Dipanggil otomatis oleh `npm install` lewat "prepare"; bisa juga manual:
#   npm run setup
#
# Aman diulang (idempotent) dan tidak memblokir install kalau offline — skill
# yang belum ada hanya dilewati dengan peringatan, bukan error.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$HOME/.agents/skills"
OPENCODE_SKILLS="$HOME/.config/opencode/skills"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { printf '%b\n' "  ${GREEN}ok${NC}   $1"; }
warn() { printf '%b\n' "  ${YELLOW}warn${NC} $1"; }
fail() { printf '%b\n' "  ${RED}FAIL${NC} $1"; }

echo "== setup repo (hooks + skill agent) =="

# 1. Git hooks — murah & offline.
if [ "$(git -C "$ROOT" config core.hooksPath 2>/dev/null || true)" = ".githooks" ]; then
  ok "git hooksPath = .githooks"
else
  git -C "$ROOT" config core.hooksPath .githooks && ok "git hooksPath = .githooks"
fi

# 2. Skill agent global + symlink ke direktori opencode.
#    ATLAS & ARCHIFY di .rules.json / scripts menunjuk path symlink ini.
install_skill() {
  local name="$1" repo="$2"
  if [ -d "$SKILLS_DIR/$name" ]; then
    ok "skill $name"
  elif npx --yes skills@latest add "$repo" -g --skill "$name" --agent opencode -y >/dev/null 2>&1; then
    ok "skill $name terpasang"
  else
    fail "skill $name belum ada (butuh jaringan?) — jalankan: npx skills add $repo -g --skill $name"
    return 1
  fi
  mkdir -p "$OPENCODE_SKILLS"
  ln -sfn "$SKILLS_DIR/$name" "$OPENCODE_SKILLS/$name"
}
install_skill archify tt-a1i/archify
install_skill atlas-owner argasokataman-code/atlas-owner

# 3. Atlas integrity (kalau CLI + folder atlas ada).
ATLAS="$OPENCODE_SKILLS/atlas-owner/scripts/atlas.mjs"
if [ -f "$ATLAS" ] && [ -d "$ROOT/atlas" ]; then
  if node "$ATLAS" check >/dev/null 2>&1; then
    ok "atlas check"
  else
    warn "atlas check gagal — jalankan: npm run atlas -- check"
  fi
fi

# 4. Archify — dipakai scripts/flows-gate.sh untuk regenerate diagram flow.
if [ -f "$SKILLS_DIR/archify/bin/archify.mjs" ]; then
  ok "archify CLI"
else
  warn "archify CLI tidak ditemukan — diagram flow tidak bisa di-regenerate"
fi

echo "Setup selesai."
