---
File path: web/src/app/api/agents/publish/publish-agent-definitions.ts
Line ranges modified: 1-374 (new file)
Description: Extracted the publish pipeline into a reusable function that validates agent definitions, enforces publisher constraints, determines versions, resolves spawnable subagents, and inserts agent config rows transactionally.

---
File path: web/src/app/api/agents/publish/route.ts
Line ranges modified: 1-86
Description: Simplified the publish API route to focus on request parsing and authentication, delegating the core publish logic to publish-agent-definitions.

---
File path: web/src/app/api/publishers/[id]/import-local-agents/route.ts
Line ranges modified: 1-114 (new file)
Description: Added a publisher-scoped API route that loads the nearest `.agents/` directory, forces `publisher` to match the target publisher, rewrites cross-publisher spawn references to local when applicable, and publishes only missing agent IDs via the shared publish pipeline.

---
File path: web/src/app/publishers/[id]/components/import-local-agents-button.tsx
Line ranges modified: 1-101 (new file)
Description: Added a client-side button that calls the import-local-agents API route and refreshes the publisher page, showing progress, success, and error messaging.

---
File path: web/src/app/publishers/[id]/components/index.ts
Line ranges modified: 1-2 (new file)
Description: Added a barrel export for publisher page components.

---
File path: web/src/app/publishers/[id]/page.tsx
Line ranges modified: 1-15; 83-84; 173-196
Description: Added permission-aware UI for importing local agents (shows Import button only for authorized users) and wired it into the publisher header layout.

---
File path: docs/tasks/frontend/18-12-2025/import-local-agents-to-publisher/notes.md
Line ranges modified: 1-18 (new file)
Description: Captured task goals, approach, and implementation notes for importing local `.agents/` into a publisher.
