# Site Tracking — client review sketches v0.4

This folder contains review artifacts based only on
`docs/requirements-v0.4-working-draft.md`. They are not final UI or an
application implementation.

All web and Android interface labels are English only. No other product
language or localization is supported.

## Main files

- `site-tracking-screen-sketches-v0.4.drawio` — 18-page editable draw.io file; text, boxes, buttons and arrows are native shapes.
- `site-tracking-client-review-v0.4.pdf` — 18-page client-review PDF.
- `screen-inventory-v0.4.json` — machine-readable page IDs, titles, roles and excluded scope.
- `screens/` — representative visual-check PNGs.
- `tools/generate_review.py` — generator for the draw.io XML and matching HTML.

## Scope note

The sketches cover the confirmed flow, roles, permissions, online photo
uploads, reviews, assignment history, linked-Site access limits, and explicit
upload failure/retry.

Yellow boxes mark decisions that are still pending: pause/reopen behavior,
stage dependencies, Site/Project status derivation, exact fields, and the
amount of basic progress shown for another Coordinator's linked Site.

Materials, GPS/location, offline/sync, iOS and Team login are not included as
features.

## Regenerate

```sh
python3 review/tools/generate_review.py
```

This regenerates the editable `.drawio`, review `.html` and inventory `.json`.
Print the generated HTML to PDF with Chromium or Chrome to refresh the PDF.
