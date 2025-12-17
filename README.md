# n8n-heroku

# Heroku Postgres → n8n env

- Overview: Fetch `DATABASE_URL` from Heroku and convert to n8n Postgres env vars.

## Prerequisites
- Heroku CLI installed and logged in: `heroku login`
- Know your Heroku app name (e.g., `my-n8n-app`)

## Quick Use
Run the helper script to generate a `.env` in the repo root:

```bash
./scripts/extract_heroku_db.sh <heroku-app-name>
```

This writes the following variables:
- `DB_POSTGRESDB_HOST`
- `DB_POSTGRESDB_PORT`
- `DB_POSTGRESDB_DATABASE`
- `DB_POSTGRESDB_USER`
- `DB_POSTGRESDB_PASSWORD`
- `DB_POSTGRESDB_SSL=true`
- `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false`

To print instead of writing `.env`:

```bash
./scripts/extract_heroku_db.sh <heroku-app-name> --print
```

Note: `.env` is ignored by git via `.gitignore` so credentials are not committed.

## Manual steps (alternative)
If you prefer manual extraction:

```bash
DATABASE_URL=$(heroku config:get DATABASE_URL -a <heroku-app-name>)

DB_POSTGRESDB_USER=$(echo "$DATABASE_URL" | sed -E 's#^postgres(|ql)://([^:]+):.*#\2#')
DB_POSTGRESDB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's#^postgres(|ql)://[^:]+:([^@]+)@.*#\2#')
DB_POSTGRESDB_HOST=$(echo "$DATABASE_URL" | sed -E 's#^postgres(|ql)://[^@]+@([^:/]+).*#\2#')
DB_POSTGRESDB_PORT=$(echo "$DATABASE_URL" | sed -E 's#^postgres(|ql)://[^@]+@[^:]+:([0-9]+)/.*#\2#')
DB_POSTGRESDB_DATABASE=$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')

export DB_POSTGRESDB_SSL=true
export DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
```

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://dashboard.heroku.com/new?template=https://github.com/PatraG/n8n-heroku/tree/main)

## n8n - Free and open fair-code licensed node based Workflow Automation Tool.

This is a [Heroku](https://heroku.com/)-focused container implementation of [n8n](https://n8n.io/).

Use the **Deploy to Heroku** button above to launch n8n on Heroku. When deploying, make sure to check all configuration options and adjust them to your needs. It's especially important to set `N8N_ENCRYPTION_KEY` to a random secure value. 

Refer to the [Heroku n8n tutorial](https://docs.n8n.io/hosting/server-setups/heroku/) for more information.

If you have questions after trying the tutorials, check out the [forums](https://community.n8n.io/).
