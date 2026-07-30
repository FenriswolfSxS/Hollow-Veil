# Roster parser verification

This build uses the official Hollow Veil Lodestone member row as the source of truth.

Verified field contract:

- FC rank comes only from the member row rank element.
- Level comes only from the member row level element.
- Job is resolved from the class/job icon in that same member row.
- If the icon does not expose a readable job identifier, the parser makes one profile-page fallback request and reads the current class/job block.
- The original Lodestone job icon URL is displayed directly when available.
- Old roster caches are invalidated by cache schema version 7.

Expected live values visible on the official roster at build time include:

- Yuki Hitomi — Warden — level 100
- Feyre Nyxaris — Veilkeeper — level 100
- Sevrok Darkstar — Watcher — level 92
- Inari Hitomi — Echo — level 33

The test fixture in `scripts/verify-roster-parser.mjs` checks rank, class/job, level, portrait, and profile URL extraction for both image-based and CSS-background job icons.
