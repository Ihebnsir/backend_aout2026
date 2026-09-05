# Formation data migration report

## Result

- Real centres found: 5
- Formations seeded: 12 curated records
- Formations before seeding: 0
- Formations after seeding: 12
- Duplicates created: 0
- Invalid centre references: 0
- Mock centre IDs used: 0

## Why the original migration was blocked

The historical mock records reference string IDs (`centre-1`, `centre-2`, and `centre-3`). Those IDs are not MongoDB ObjectIds and do not identify any Centre document in the configured SkillBridge database. The Formation schema requires `centre` to reference a real Centre ObjectId, so those records were intentionally not migrated.

Arbitrary mapping from the mock centre names to real centres was intentionally avoided. This seed contains only a small curated dataset for development, demo, and testing; it does not migrate all historical mock data.

## Real centres used

The seed discovers centres at runtime and sorts them by name, city, and ObjectId. The five centres found during this run were:

| Centre | City | Domain | MongoDB ObjectId |
| --- | --- | --- | --- |
| Centre Formation Sfax | Sfax | Informatique et Télécommunications | `6a96184f415fe37c01c376d1` |
| Centre Formation Sfax | Sfax | Informatique et Télécommunications | `6a976a60dac2d95804cd08fd` |
| Centre Formation Sfax | Sfax | Informatique et Télécommunications | `6a976a9ddac2d95804cd0902` |
| Centre Formation Test | Sfax | Informatique | `6a961a92415fe37c01c376d5` |
| Tech Academy Test | Tunis | Technologie | `6a8f72631d75c9adbacb4565` |

The repeated Sfax names are separate existing Centre documents and were kept separate by their ObjectIds. No Centre document was created, deleted, or modified.

## Curated formations

The seed creates 12 formations across the real centres, covering informatique, réseaux et sécurité, bureautique, data, gestion, marketing, management, langues, design, entrepreneuriat, and employabilité. Prices are in TND and statuses use the existing Formation enum.

Titles:

- Développement web avec JavaScript et Node.js
- Administration systèmes Linux
- Réseaux Cisco et cybersécurité
- Analyse de données avec Excel avancé
- Python pour la data science
- Comptabilité pratique et gestion financière
- Marketing digital et réseaux sociaux
- Gestion de projet avec les méthodes agiles
- Français professionnel et communication
- UI/UX design et prototypage Figma
- Entrepreneuriat et création d’entreprise
- Préparation à l’emploi et techniques d’entretien

## Idempotency and verification

Each record uses an upsert filter on `(centre, title)` and `$setOnInsert`. Re-running `npm run seed:formations` therefore does not create duplicates or modify existing Formation documents. The first run inserted 12 records; a subsequent run reported 0 additional inserts and kept the total at 12.

All seeded centre values are runtime-resolved MongoDB ObjectIds from the Centre collection. The seed does not use `centre-1`, `centre-2`, or `centre-3`.