# Formations data migration report

## Status

**FORMATIONS DATA MIGRATION BLOCKED**

The migration was intentionally not executed because the real MongoDB contains no Centre documents matching the mock formation references. No formation documents were inserted and no existing data was modified.

## Source analysis

- Source: `react_juillet/src/data/mockFormations.js`
- Records found: 8
- Records structurally transformable: 8
- Invalid source records: 0
- Records skipped: 8, because their required Centre references could not be resolved safely

## Backend contract

- Backend: `backend_aout2026/app.js`
- Model: `src/models/Formation.js`
- Required fields: `centre`, `title`, `price`, `duration`
- Valid statuses: `pending`, `confirmed`, `in-progress`, `completed`
- Centre relation: `Formation.centre` is a required MongoDB ObjectId referencing `Centre`

## Mock to MongoDB mapping

| Mock field | Formation field | Decision |
| --- | --- | --- |
| `title` | `title` | Preserved |
| `description` | `description` | Preserved when present; source records have no description |
| `price` | `price` | Preserved as Number |
| `duration` | `duration` | Preserved |
| `category` | `category` | Preserved |
| `categorie` | `categorie` | Preserved |
| `status` | `status` | Preserved; all 8 values are valid backend enum values |
| `offreStage` | `offreStage` | Preserved as Boolean |
| `entreprisesPartenaires` | `entreprisesPartenaires` | Preserved as string array |
| `startDate` | `startDate` | Preserved as Date-compatible ISO string |
| `endDate` | `endDate` | Preserved as Date-compatible ISO string |
| `progress` | `progress` | Preserved as Number |
| `image` | `image` | Preserved as URL string |
| `centreId` | `centre` | Requires a real Centre ObjectId; not guessed |
| `id` | Mongo `_id` | Omitted; mock IDs are not valid Mongo IDs and are not used as `_id` |
| `learnerId` | None | Omitted; no Formation model field |
| `maxPlaces` / `availablePlaces` | None | Omitted; unsupported by Formation schema |
| `program` / `mode` / `bookingSessions` | None | Omitted; unsupported by Formation schema |
| `averageRating` / `reviewCount` / `trending` | None | Omitted; unsupported by Formation schema |

## Centre-reference mapping

Expected mappings from the mock source:

- `centre-1` -> `Tech Academy Tunis`
- `centre-2` -> `Digital Design Institute`
- `centre-3` -> `Business Skills Center`

Actual matching Centre documents found in MongoDB: **0**.

The database currently contains centres named `Tech Academy Test`, `Centre Formation Sfax`, and `Centre Formation Test`. These were not treated as equivalent because that would assign formations to arbitrary real accounts.

## Migration script

- Location: `backend_aout2026/scripts/seedFormations.js`
- Command: `npm run seed:formations`
- Behavior: validates all records, resolves Centres by exact name, aborts before insertion when any reference is unresolved, then inserts only missing `(centre, title)` pairs.
- Idempotency design: existing matching `(centre, title)` records are skipped; the script never uses mock IDs as Mongo `_id` and never drops or resets collections.

## Execution and verification

- The script was not run against MongoDB because its preflight would correctly block on unresolved Centre references; no writes were attempted.
- Real API before migration: `GET /api/formations` returned `200` with `data: []` and valid pagination.
- No real formation ID was available for detail verification.
- Invalid formation ID endpoint returned `400`.
- API verification of a migrated formation, duplicate count, and second-run idempotency is pending Centre mapping.
- Frontend formation service test passed.
- Frontend production build passed.

## Remaining frontend mock usages

`mockFormations` remains used by legacy dashboard, admin statistics, favorites, export, search, and presentation components. It was not deleted or migrated in this task. The main formation service and public listing/detail flow already read from `/api/formations`.

## Next action required

Provide an intentional mapping from each mock centre to an existing real Centre document, or create the corresponding Centres through the existing backend workflow. Then rerun `npm run seed:formations`, verify the count, rerun it to confirm no duplicates, and test the API/frontend flows.
