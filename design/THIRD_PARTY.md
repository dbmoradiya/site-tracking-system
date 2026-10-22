# Design tooling and assets

- Native Penpot generation: `@penpot/library` 1.2.0, official Penpot library, Mozilla Public License 2.0. [Source and license](https://github.com/penpot/penpot/tree/develop/library).
- Native editor verification: Penpot 2.18.3. The local Compose configuration is adapted from [Penpot's official Compose file](https://github.com/penpot/penpot/blob/develop/docker/images/docker-compose.yaml), with loopback bindings, generated local secrets, SMTP disabled, and telemetry disabled. It is editor infrastructure rather than the product backend.
- ZIP handling: fflate 0.8.3, MIT license. [Source](https://github.com/101arrowz/fflate).
- Browser verification and PDF export: Playwright 1.64.1, Apache 2.0 license. [Source](https://github.com/microsoft/playwright).
- Source Sans Pro fonts: sourced from Penpot's bundled fonts; SIL Open Font License text accompanies the font files.
- Noto Sans Devanagari and Noto Sans Gujarati: Google Fonts, SIL Open Font License. Font-specific license texts accompany the font files.

All site evidence illustrations are locally drawn vectors. Sample names, quantities, phone numbers and coordinate observations are illustrative design data. No actual employee location, evidence photo or voice recording was collected to prepare this delivery.

UI revision 2 was informed by the purple accents, tabbed project workspaces and compact task/register layouts shown on [Onsite's public product site](https://onsiteteams.com/). No Onsite screenshots, logos, photos, code or other assets are included in the delivery.

Native text position records follow the [Penpot 2.18.3 text shape schema](https://github.com/penpot/penpot/blob/2.18.3/common/src/app/common/types/shape/text.cljc) and [viewer renderer](https://github.com/penpot/penpot/blob/2.18.3/frontend/src/app/main/ui/shapes/text/svg_text.cljs). Glyph widths and baselines are measured locally from the bundled fonts; no external font service is used for those measurements.
