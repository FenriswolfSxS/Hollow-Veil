# Forest Ritual Rebuild

This project was rebuilt from the supplied `Hollow-Veil-New-Background(1).zip` baseline.

## New ritual engine

- `src/ritual/ForestRitual.tsx`: four-step ritual director and failure/reset flow.
- `src/ritual/ForestEngine.ts`: canvas cinematic renderer with moving fog, roots, ash, detailed wolf/demon/pale eyes, apparition compositing, camera shake, film treatment, and Web Audio analysis.
- `public/ritual/shadow-girl-source.png`: supplied shadow-girl artwork.
- `public/ritual/whisper.opus`: supplied whisper, converted for web delivery.
- `public/ritual/hidden-song.opus`: supplied hidden song, converted to Opus so every file remains below Cloudflare Pages' 25 MiB asset limit.

The original site pages and systems remain in place. The GlobalMusic context now exposes fade and resume controls so the ritual can take over and restore the normal soundtrack cleanly.
