#!/usr/bin/env bash
# Gate flow archify: SATU flow = semua spec di foldernya.
# Diagram utama `<slug>.json` + opsional sequence sistem `<slug>.sequence.json`.
# Tipe diagram dibaca dari field `diagram_type` tiap spec.
#
# Pakai:
#   scripts/flows-gate.sh f6-cashout-payout     # satu flow (semua spec)
#   scripts/flows-gate.sh --all                 # semua flow
#   scripts/flows-gate.sh --all --keep-shots    # jangan buang PNG (saat debug)
set -uo pipefail

ARCHIFY="${ARCHIFY:-$HOME/.agents/skills/archify/bin/archify.mjs}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLOWS="$ROOT/docs/design/flows"

gate_spec() {
  local slug="$1" json="$2" keep="$3"
  local base type html
  base="$(basename "$json" .json)"
  case "$base" in *.visual-check) return 0 ;; esac

  type="$(node -e "process.stdout.write(require('$json').diagram_type||'')" 2>/dev/null)"
  if [ -z "$type" ]; then echo "SKIP $slug/$base (diagram_type kosong)"; return 1; fi
  html="${json%.json}.html"

  node "$ARCHIFY" deliver "$type" "$json" "$html" --quality showcase --json > "/tmp/$base.d.json" 2>/dev/null
  node "$ARCHIFY" visual-check "$html" --json > "/tmp/$base.vc.json" 2>/dev/null

  node -e '
    const fs=require("fs"), slug=process.argv[1], base=process.argv[2];
    const read=p=>{try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch{return {}}};
    const d=read(`/tmp/${base}.d.json`), v=read(`/tmp/${base}.vc.json`);
    const val=d.validation||{}, art=d.artifact||{}, spec=d.specification||{};
    const vps=(v.containment&&v.containment.viewports)||[];
    const bad=vps.filter(x=>!x.ok||x.overflowX||x.overflowY);
    const ok=d.ok===true && val.errors===0 && v.status==="pass" && bad.length===0;
    console.log(`${ok?"PASS":"FAIL"} ${slug}/${base} ${val.checksPassed||0}/${val.checkCount||0} err=${val.errors??"?"} spec=${(spec.sha256||"").slice(0,8)} art=${(art.sha256||"").slice(0,8)} visual=${v.status||"?"} bad=${bad.length}`);
    process.exit(ok?0:1);
  ' "$slug" "$base"
  local ok=$?

  # PNG visual-check (~670KB/spec) regenerable. Buang hanya kalau lolos.
  if [ "$ok" -eq 0 ] && [ "$keep" != "1" ]; then
    find "$(dirname "$json")" -maxdepth 1 -name "${base}.visual-check.*.png" -delete
  fi
  return "$ok"
}

gate_one() {
  local slug="$1" keep="$2"
  local dir="$FLOWS/$slug"
  if [ ! -d "$dir" ]; then echo "SKIP $slug (folder tidak ada)"; return 1; fi

  local pass=0 fail=0 json
  for json in "$dir"/*.json; do
    [ -f "$json" ] || continue
    case "$(basename "$json")" in *.visual-check.json) continue ;; esac
    if gate_spec "$slug" "$json" "$keep"; then pass=$((pass+1)); else fail=$((fail+1)); fi
  done
  if [ $((pass + fail)) -eq 0 ]; then echo "SKIP $slug (tidak ada spec)"; return 1; fi
  return $(( fail > 0 ? 1 : 0 ))
}

keep=0
targets=()
for arg in "$@"; do
  case "$arg" in
    --all) for d in "$FLOWS"/f*/; do [ -d "$d" ] && targets+=("$(basename "$d")"); done ;;
    --keep-shots) keep=1 ;;
    -*) echo "opsi tak dikenal: $arg" >&2; exit 2 ;;
    *) targets+=("$arg") ;;
  esac
done
if [ "${#targets[@]}" -eq 0 ]; then echo "pakai: scripts/flows-gate.sh <slug>|--all [--keep-shots]" >&2; exit 2; fi

fail=0
for slug in "${targets[@]}"; do gate_one "$slug" "$keep" || fail=$((fail+1)); done
[ "${#targets[@]}" -gt 1 ] && echo "RINGKAS: $(( ${#targets[@]} - fail ))/${#targets[@]} pass"
exit $(( fail > 0 ? 1 : 0 ))
