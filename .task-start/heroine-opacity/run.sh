set -euo pipefail
OUT=generated/heroine-opacity
mkdir -p "$OUT"
phase=${1:?explicit task phase required}
if [ "$phase" = before ] || [ "$phase" = after ]; then
  server=''
  cleanup() {
    if [ -n "$server" ]; then
      kill "$server" 2>/dev/null || true
      for i in $(seq 1 20); do kill -0 "$server" 2>/dev/null || break; sleep .1; done
      kill -KILL "$server" 2>/dev/null || true
      wait "$server" 2>/dev/null || true
      server=''
    fi
  }
  trap cleanup EXIT
  (cd apps/character-studio && npm run predev && exec ../../node_modules/.bin/vite --host 127.0.0.1 --port 5177 --strictPort) > "$OUT/$phase-vite.log" 2>&1 &
  server=$!
  for i in $(seq 1 60); do if curl -fsS http://127.0.0.1:5177/ >/dev/null; then break; fi; sleep 1; done
  timeout --kill-after=5 570 node assets/characters/heroine-dawn/observe-opacity.mjs "$OUT/$phase" > "$OUT/$phase-browser.log" 2>&1 || { tail -80 "$OUT/$phase-browser.log"; tail -40 "$OUT/$phase-vite.log"; exit 1; }
  cat "$OUT/$phase-browser.log"
elif [ "$phase" = repair ]; then
  SOURCE=$(python3 -c "import json;print(json.load(open('apps/review/public/library/provenance/heroine-dawn-v1.json'))['sourcePath'])")
  blender --background assets/characters/heroine-dawn/source/HeroineDawn.blend --python-exit-code 1 --python assets/characters/heroine-dawn/opacity.py -- --source "$SOURCE" --out "$OUT/candidate" > "$OUT/repair.log" 2>&1 || { tail -100 "$OUT/repair.log"; exit 1; }
  python3 .task-start/heroine-opacity/materialize.py "$OUT"
elif [ "$phase" = render ]; then
  blender --background "$OUT/candidate/HeroineDawn.blend" --python-exit-code 1 --python-expr "import bpy; bpy.context.scene.world = bpy.context.scene.world or bpy.data.worlds.new('Inspection World')" --python scripts/blender/inspect-protagonist-villager-female-v1.py -- --out "$OUT/dcc-after" > "$OUT/dcc-after.log" 2>&1 || { tail -80 "$OUT/dcc-after.log"; exit 1; }
elif [ "$phase" = deliver ]; then
  python3 .task-start/heroine-opacity/deliver.py
  node --test packages/characters/tests/female-protagonist-source.test.mjs > "$OUT/preflight-tests.log" 2>&1 || { cat "$OUT/preflight-tests.log"; exit 1; }
else
  echo "Unknown task phase: $phase" >&2; exit 2
fi
