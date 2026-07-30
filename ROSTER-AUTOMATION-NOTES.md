# Automated job-icon recognition

The roster still synchronizes names, portraits, FC ranks, active icon URLs, and levels from the official Lodestone FC roster.

Opaque Lodestone job-icon filenames are resolved in the browser by visual comparison against the supplied local icon library. A same-origin Cloudflare Pages Function proxies the Lodestone icon so Canvas can safely decode it. Successful mappings are cached in localStorage by the opaque icon filename, so each unique job icon is normally identified only once per browser.

The matcher uses normalized luminance and edge fingerprints with a conservative confidence threshold. An uncertain match remains “Identifying…” rather than displaying a wrong job.
