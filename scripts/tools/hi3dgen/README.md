# Hi3DGen experimental asset pipeline

This tool turns one repository-owned input image into an experimental GLB that is materialized under the project Asset Origin and registered for RINNE review.

## Contract

- Runtime/build never calls the upstream generation provider.
- Generated geometry is `experimental-review` and `productionEligible: false`.
- Provider/model/source revisions, license evidence, input hashes, raw/output hashes, byte length, triangle count, bounds, generation time and postprocess report are recorded.
- The current Hi3DGen provider accepts one image. The request schema already uses an image array so a future multi-view provider can be added without changing callers.
- Public inference requires explicit `consentToPublicInference: true`.
- Provider adapters are isolated in `provider.py`; postprocess/materialization are provider-independent.

## Run

Prerequisites: Python 3.11+, Blender with its glTF importer dependencies, network access for the selected provider.

```bash
python -m pip install -r scripts/tools/hi3dgen/requirements.txt
python scripts/tools/hi3dgen/pipeline.py --request scripts/tools/hi3dgen/sample.request.json
```

On Ubuntu 24.04 the task runner used:

```bash
sudo apt-get install -y blender python3-numpy
```

The command writes immutable Asset Origin payloads below `apps/review/public/library/experimental/hi3dgen/`, updates `apps/review/public/library/manifest.json`, writes the source archive under `assets/generated/hi3dgen/`, and updates both generated asset catalogs under `packages/assets/generated/`.

Open `/review-objects?generated=1` in the RINNE review surface to select the first generated asset automatically.

## Failure receipts

Each run writes stage events plus `failure.json` or `receipt.json` below `.artifacts/hi3dgen/<run>/`. A failed provider call, download, Blender postprocess, GLB inspection, provenance check, manifest write, or registration is therefore distinguishable.

## Detachability

This scaffold compensates for the current lack of a built-in image-to-GLB generator in the repository toolchain. Replace `create_provider()` with another adapter, or remove this tool entirely once an equivalent trusted generation capability can provide the same materialized bytes and provenance contract.
