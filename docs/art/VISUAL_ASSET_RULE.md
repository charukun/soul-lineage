# Production Visual Asset Rule

完成品として扱う主要3Dオブジェクトは `visualAssetId` を必須とする。

- `visualAssetId` は `@soul/assets` の単一 `visualAssetRegistry` で解決できること。
- registry entry は `MATERIALIZED`、ライセンス、immutable source revision/path/hash を持つこと。
- runtime primitive で主要シルエットを新造して完成品扱いしてはいけない。
- procedural geometry は `BLOCKOUT`、terrain、VFX、collision、debug の明示用途だけ許可する。
- 外部候補の探索方法は実装者に委ねる。採用条件だけをこの不変条件で固定する。

従来の Public GitHub/Web/Phase catalog はこの単一registryへ統合し、段階別catalogを新設しない。
