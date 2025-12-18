# Import local .agents into a publisher

## Goal
Allow importing the repository's local `.agents/` directory into a specific publisher page (e.g. `/publishers/besi`) so the publisher shows agents as published in the UI.

## Approach
- Add a publisher-scoped API route that:
  - Authenticates and checks publisher edit permission.
  - Finds the nearest `.agents/` directory on the server filesystem.
  - Loads agents via `@codebuff/sdk` `loadLocalAgents()` (validated locally).
  - Overrides the `publisher` field on each loaded agent to match the target publisher.
  - Publishes via the same publish pipeline used by `/api/agents/publish`.
- Add a small UI action on the publisher page (visible only to authorized users) to trigger the import and refresh the page.

## Notes
- This is intended for local/dev seeding of agents into the DB-backed agent store.
- The publish pipeline already resolves `spawnableAgents` into fully-qualified `publisher/id@version` references.
- The import route is idempotent: it only publishes agent IDs that are not already present for the target publisher.
