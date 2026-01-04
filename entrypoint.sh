#!/bin/sh

# check if port variable is set or go with default
if [ -z ${PORT+x} ]; then echo "PORT variable not defined, leaving N8N to default port."; else export N8N_PORT="$PORT"; echo "N8N will start on '$PORT'"; fi

TS_AUTHKEY="${TAILSCALE_AUTHKEY:-${TAILSCALE_AUTH_KEY:-}}"
if [ -n "$TS_AUTHKEY" ]; then
  echo "Starting Tailscale..."
  /usr/local/bin/tailscaled --tun=userspace-networking --state=mem: --socket=/tmp/tailscaled.sock &

  i=0
  while [ ! -S /tmp/tailscaled.sock ] && [ $i -lt 50 ]; do
    i=$((i+1))
    sleep 0.2
  done

  /usr/local/bin/tailscale --socket=/tmp/tailscaled.sock up \
    --authkey="$TS_AUTHKEY" \
    --hostname="${TAILSCALE_HOSTNAME:-n8n-modadigi}" \
    --accept-dns=false \
    ${TAILSCALE_ADVERTISE_TAGS:+--advertise-tags="$TAILSCALE_ADVERTISE_TAGS"} \
    ${TAILSCALE_EXTRA_ARGS:-} || echo "WARNING: tailscale up failed"

  if [ "${TAILSCALE_SERVE:-true}" = "true" ]; then
    N8N_LISTEN_PORT="${N8N_PORT:-5678}"
    /usr/local/bin/tailscale --socket=/tmp/tailscaled.sock serve --bg --tcp 5678 "${N8N_LISTEN_PORT}" || true
  fi
else
  echo "TAILSCALE_AUTHKEY/TAILSCALE_AUTH_KEY not set; skipping Tailscale"
fi

# regex function
parse_url() {
  eval $(echo "$1" | sed -e "s#^\(\(.*\)://\)\?\(\([^:@]*\)\(:\(.*\)\)\?@\)\?\([^/?]*\)\(/\(.*\)\)\?#${PREFIX:-URL_}SCHEME='\2' ${PREFIX:-URL_}USER='\4' ${PREFIX:-URL_}PASSWORD='\6' ${PREFIX:-URL_}HOSTPORT='\7' ${PREFIX:-URL_}DATABASE='\9'#")
}

# prefix variables to avoid conflicts and run parse url function on arg url
PREFIX="N8N_DB_" parse_url "$DATABASE_URL"
echo "$N8N_DB_SCHEME://$N8N_DB_USER:$N8N_DB_PASSWORD@$N8N_DB_HOSTPORT/$N8N_DB_DATABASE"
# Separate host and port    
N8N_DB_HOST="$(echo $N8N_DB_HOSTPORT | sed -e 's,:.*,,g')"
N8N_DB_PORT="$(echo $N8N_DB_HOSTPORT | sed -e 's,^.*:,:,g' -e 's,.*:\([0-9]*\).*,\1,g' -e 's,[^0-9],,g')"

export DB_TYPE=postgresdb
export DB_POSTGRESDB_HOST=$N8N_DB_HOST
export DB_POSTGRESDB_PORT=$N8N_DB_PORT
export DB_POSTGRESDB_DATABASE=$N8N_DB_DATABASE
export DB_POSTGRESDB_USER=$N8N_DB_USER
export DB_POSTGRESDB_PASSWORD=$N8N_DB_PASSWORD

# kickstart nodemation
n8n