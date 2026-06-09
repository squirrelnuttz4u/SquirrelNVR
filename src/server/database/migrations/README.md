# Database Migrations

By default the server runs with `synchronize: true`, which auto-applies the
schema (zero-config first run). For production with controlled schema changes:

1. Set `DB_SYNCHRONIZE=false` in the environment.
2. Generate a migration after changing entities:
   `npm run migration:generate -- src/server/database/migrations/MyChange`
3. Apply migrations: `npm run migration:run` (or set `DB_RUN_MIGRATIONS=true`).
4. Revert the last migration: `npm run migration:revert`.
