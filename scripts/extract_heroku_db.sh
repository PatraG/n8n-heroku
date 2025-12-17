#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/extract_heroku_db.sh <heroku-app-name> [--print]
# Fetches DATABASE_URL from Heroku and writes a .env file with n8n-compatible Postgres variables.
# If --print is provided, prints the variables to stdout instead of writing .env.

app_name="${1:-}"
print_only=false
if [[ "${2:-}" == "--print" ]]; then
  print_only=true
fi

if [[ -z "$app_name" ]]; then
  echo "Error: missing Heroku app name" >&2
  echo "Usage: $0 <heroku-app-name> [--print]" >&2
  exit 1
fi

if ! command -v heroku >/dev/null 2>&1; then
  echo "Error: heroku CLI not found. Install from https://devcenter.heroku.com/articles/heroku-cli" >&2
  exit 1
fi

DATABASE_URL=$(heroku config:get DATABASE_URL -a "$app_name")
if [[ -z "$DATABASE_URL" ]]; then
  echo "Error: DATABASE_URL not found for app '$app_name'" >&2
  exit 1
fi

# Expected format: postgres://USER:PASSWORD@HOST:PORT/DBNAME
proto=${DATABASE_URL%%://*}
if [[ "$proto" != "postgres" && "$proto" != "postgresql" ]]; then
  echo "Warning: unexpected protocol '$proto' in DATABASE_URL" >&2
fi

# Strip protocol prefix
no_proto=${DATABASE_URL#*://}
creds_host=${no_proto%@*}
host_path=${no_proto#*@}

user=${creds_host%%:*}
pass=${creds_host#*:}
host_port=${host_path%%/*}
dbname=${host_path#*/}

host=${host_port%%:*}
port=${host_port##*:}

# Fallback default port if parsing failed
if [[ -z "$port" || "$port" == "$host_port" ]]; then
  port=5432
fi

# Compose output
output=$(cat <<EOF
DB_POSTGRESDB_HOST=$host
DB_POSTGRESDB_PORT=$port
DB_POSTGRESDB_DATABASE=$dbname
DB_POSTGRESDB_USER=$user
DB_POSTGRESDB_PASSWORD=$pass
# Heroku Postgres typically requires SSL for external connections
DB_POSTGRESDB_SSL=true
DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
EOF
)

if $print_only; then
  echo "$output"
else
  # Write to .env in repo root
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
  env_file="$repo_root/.env"
  echo "$output" > "$env_file"
  echo ".env written to $env_file"
fi
