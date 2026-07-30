# Roster parser: source-of-truth rules

The API now reads each Lodestone FC member anchor as one isolated record.

1. Rank is read from the same member row and must match a Hollow Veil rank.
2. Level is read from the same row after the rank.
3. The active class/job icon is the small icon between the rank and level.
4. The member's `/class_job/` page is fetched and used as an icon-to-text dictionary.
5. If necessary, the profile header fallback reads the exact `24x24` active icon and `LV` value shown by Lodestone.
6. No job is inferred from the first icon in a character's full class list.
7. Cached entries from earlier parser versions are automatically rejected.

This means Unknown Wolf resolves from one member row as Wanderer / Reaper / 96, and the same logic is applied to every member.
