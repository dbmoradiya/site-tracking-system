# FIELDWORK — Design delivery

## Start here

- **Browser review:** http://127.0.0.1:4173
- **Native Penpot:** [fieldwork-designs.penpot](deliverables/fieldwork-designs.penpot)
- **Screen review PDF:** [design-review.pdf](deliverables/design-review.pdf)
- **User journeys and complete inventory:** [user-journeys.md](deliverables/user-journeys.md)
- **Checks and traceability:** [coverage-report.md](deliverables/coverage-report.md)

The delivery contains 152 screen/state designs (80 manager, 72 employee), 9 user journeys, 7 foundation/component boards, five prototype entry flows, shared semantic colors, typography, DTCG tokens and six reusable native components. All core workflows and recovery states are represented.

## Open in Penpot

1. Open your Penpot workspace.
2. Choose Import and select `fieldwork-designs.penpot`.
3. Open pages **00 Foundations**, **01 Manager web**, **02 Employee mobile**, and **03 End-to-end journeys**.
4. Start a prototype flow (manager sign-in, daily operations, employee sign-in, assigned work, or offline recovery).
5. Use Penpot comments and workspace sharing for your client.

A local Penpot instance is available at http://localhost:9001 on this machine. Its local test-account credentials are in the ignored, permission-restricted file `design/.runtime/penpot-credentials.json`; they are never committed or embedded in deliverables. This local editor is separate infrastructure from the product's confirmed Spring Boot/SQLite stack. Localhost URLs are accessible only on this machine; no cloud workspace or external client-sharing URL has been published. The .penpot file can be imported into your own hosted workspace for that.

## Restart the browser review

Run `npm run design:review` from the repository root, then visit http://127.0.0.1:4173. The gallery supports screen search, role switching, prototype hotspots, guided journey starting points, preview sizing, and locally saved/exportable review notes. Notes are browser-local; they are not sent to a server or Penpot comments.

## Standalone client package

The ZIP contains the native Penpot file, PDF, browser gallery, SVGs and fonts. Import the native file into Penpot or open the PDF directly. To run the gallery without the repository, extract the ZIP, open a terminal in its fieldwork-client-review folder, and run `python3 -m http.server 4173 --bind 127.0.0.1`. Then visit http://127.0.0.1:4173.

## Design conventions

- FIELDWORK is a working product name, not a finalized brand decision.
- Desktop artboards use a 1440px canvas; mobile uses a 412px canvas with full content height where scrolling is needed.
- Source Sans Pro supports the main interface; Noto Sans Devanagari/Gujarati support localized examples. Font license texts accompany the delivery.
- Sample records and vector evidence are illustrative. They are not real site photos or collected location observations.
- Status is written explicitly, not communicated by color alone. Overdue is separate from workflow state.
- No employee password change, no stock movement from draft allocations, no audio replacing required photo evidence, and no GPS re-capture at later photo sync.

## Verification and limits

19 design-contract tests pass. All 152 rendered screens were measured with no text overflow findings. Read the coverage report for the precise scope. Runtime backend/device checks are intentionally not claimed: this delivery designs the application rather than implementing it. English canonical designs and 14 localized examples are ready for review; full translation and native-device testing follow during implementation.

## Tool provenance

Native files are built with Penpot's official [@penpot/library](https://github.com/penpot/penpot/tree/develop/library), then independently inspected and imported into the local Penpot application. The native format and prototype metadata follow [Penpot's file format documentation](https://help.penpot.dev/technical-guide/developer/data-model/penpot-file-format/). Private local-account state is excluded from the repository.
