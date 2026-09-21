# Visual Review cleanup acceptance

- Keep Motion Review as the visual reference; do not change its established presentation.
- Canonical review implementation stays under app-owned `src/review/**` domains.
- Character Studio review CSS belongs with the character review domain, not at `src/` root.
- Shared slot-picker scheduling/DOM helpers belong in `@soul/shared-ui`; app adapters keep only app-specific wiring.
- Legacy root review files are compatibility facades only and must not regain implementation.
- Preserve existing public review routes and user-visible behavior.
