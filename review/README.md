# Site Tracking — client review sketches v0.4

આ folderમાં ફક્ત `docs/requirements-v0.4-working-draft.md`ના આધારે બનાવેલા review artifacts છે.
આ final UI અથવા application implementation નથી.

## મુખ્ય files

- `site-tracking-screen-sketches-v0.4.drawio` — 18-page editable draw.io file; text, boxes, buttons અને arrows native shapes છે.
- `site-tracking-client-review-v0.4.pdf` — client સાથે સરળ review માટે 18-page PDF.
- `screen-inventory-v0.4.json` — page IDs, titles, roles અને excluded scopeની machine-readable યાદી.
- `screens/` — representative visual-check PNGs.
- `tools/generate_review.py` — draw.io XML અને matching HTML ફરી બનાવવાનું generator.

## Scope નોંધ

Confirmed flow, roles, permissions, online photo upload, review, reassignment history,
linked-Site limited access અને failure/retry બતાવ્યાં છે.

પીળાં boxesમાં રહેલી બાબતો **“નક્કી કરવાનું”** છે. ખાસ કરીને pause/reopen,
stage dependency, Site/Project status derivation, language scope, exact fields અને
linked Siteમાં basic progressની detail હજી confirmed નથી.

Materials, GPS/location, offline/sync, iOS અને Team login feature તરીકે ઉમેર્યાં નથી.

## ફરી generate કરવું

```sh
python3 review/tools/generate_review.py
```

આ command editable `.drawio`, review `.html` અને inventory `.json` ફરી બનાવે છે.
PDF export માટે Chromium/Chromeમાં generated HTML print-to-PDF કરી શકાય છે.

