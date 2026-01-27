# AI Instructions: Maintaining the Changelog

This project maintains a user-facing changelog in `static/changelog.json`.

**Rule:** When implementing NEW FEATURES or significant changes, you **MUST** add a new entry to the START of the `static/changelog.json` array.

## Format
```json
{
  "version": "x.x",             // Increment version number appropriately
  "date": "YYYY-MM-DD HH:MM",   // Current System Time
  "desc": "Short description of the change"
}
```

## Example
If you just added a "Dark Mode" toggle:
1. Read `static/changelog.json`
2. Prepend the new entry:
```json
[
  { "version": "1.6", "date": "2026-01-23 12:00", "desc": "Added Dark Mode toggle" },
  ... existing entries ...
]
```
3. Save the file.

**Do not ask the user if you should update the changelog. Just do it as part of the feature implementation task.**
