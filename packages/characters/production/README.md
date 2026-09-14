# Character production manifests

`*.production.json` is the machine-readable production-stage evidence used by `scripts/check-character-production.mjs`.

- `reference-preset` + `reference-only` stays at `REFERENCE`.
- `runtime-reference-model` + `runtime-procedural` stays at `BLOCKOUT`.
- A DCC rebuild that becomes a real authored character asset must use a production model kind/ID, `dcc-blender` / `dcc-maya` / `imported-reviewed`, retain its editable/import source evidence, and advance via `CHARACTER_PRODUCTION_PIPELINE.md`.
- Do not keep `kind: runtime-reference-model` on a DCC-authored production asset just to bypass migration work; that kind intentionally means review/blockout runtime geometry.
- `productionReady: true` is only valid with `RUNTIME_READY` evidence and normal Integration/Production gates still apply.

Copy `template.json` to `<stable-character-id>.production.json`, fill evidence for the current stage, and run `npm run characters:production:check` before raising the stage.
