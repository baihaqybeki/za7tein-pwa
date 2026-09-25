#!/usr/bin/env bash
# Gate satu flow archify dalam SATU panggilan: deliver + visual-check + buang artefak berat.
#
# Pakai:
#   scripts/flows-gate.sh f6-cashout-payout     # satu flow
#   scripts/flows-gate.sh --all                 # semua flow
#   scripts/flows-gate.sh --all --keep-shots    # jangan buang PNG (saat debug)
#
# Tipe diagram dibaca dari field `diagram_type` di JSON (workflow/dataflow/sequence/lifecycle),
# jadi tidak perlu diingat-ingat lagi.
set -uo pipefail

ARCHIFY="${ARCHIFY:-$HOME/.agents/skills/archify/bin/archify.mjs}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLOWS="$ROOT/docs/design/flows"

gate_one() {
  local slug="$1" keep="$2"
  local json="$FLOWS/$slug/$slug.json" html="$FLOWS/$slug/$slug.html"
  if [ ! -f "$json" ]; then echo "SKIP $slug (tidak ada $json)"; return 1; fi

  local type
  type="$(node -e "process.stdout.write(require('$json').diagram_type||'')")"
  if [ -z "$type" ]; then echo "SKIP $slug (diagram_type kosong)"; return 1; fi

  node "$ARCHIFY" deliver "$type" "$json" "$html" --quality showcase --json > "/tmp/$slug.d.json" 2>/dev/null
  node "$ARCHIFY" visual-check "$html" --json > "/tmp/$slug.vc.json" 2>/dev/null

  node -e '
    const fs=require("fs"), slug=process.argv[1];
    const read=p=>{try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch{return {}}};
    const d=read(`/tmp/${slug}.d.json`), v=read(`/tmp/${slug}.vc.json`);
    const val=d.validation||{}, art=d.artifact||{}, spec=d.specification||{};
    const vps=(v.containment&&v.containment.viewports)||[];
    const bad=vps.filter(x=>!x.ok||x.overflowX||x.overflowY);
    const ok=d.ok===true && val.errors===0 && v.status==="pass" && bad.length===0;
    console.log(`${ok?"PASS":"FAIL"} ${slug} ${val.checksPassed||0}/${val.checkCount||0} err=${val.errors??"?"} spec=${(spec.sha256||"").slice(0,8)} art=${(art.sha256||"").slice(0,8)} visual=${v.status||"?"} bad=${bad.length} h=${vps.map(x=>x.width+":"+x.scrollHeight).join(",")}`);
    process.exit(ok?0:1);
  ' "$slug"
  local ok=$?

  # PNG visual-check = ~670KB/flow, regenerable. Buang hanya kalau lolos; kalau gagal simpan untuk debug.
  if [ "$ok" -eq 0 ] && [ "$keep" != "1" ]; then
    find "$FLOWS/$slug" -maxdepth 1 -name '*.visual-check.*.png' -delete
  fi
  return "$ok"
}

keep=0
targets=()
for arg in "$@"; do
  case "$arg" in
    --all) for d in "$FLOWS"/f*/; do [ -f "$d/$(basename "$d").json" ] && targets+=("$(basename "$d")"); done ;;
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
