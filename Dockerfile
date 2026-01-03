FROM n8nio/n8n:latest

USER root

# Install Tailscale - try both Debian and Alpine
RUN if command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y ca-certificates curl && apt-get clean && rm -rf /var/lib/apt/lists/*; \
    else \
      apk add --no-cache ca-certificates curl; \
    fi && \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    curl -fsSL -o /tmp/tailscale.tgz "https://pkgs.tailscale.com/stable/tailscale_latest_${ARCH}.tgz" && \
    tar -xzf /tmp/tailscale.tgz -C /tmp && \
    cp /tmp/tailscale_*/tailscale /usr/local/bin/ && \
    cp /tmp/tailscale_*/tailscaled /usr/local/bin/ && \
    chmod +x /usr/local/bin/tailscale* && \
    rm -rf /tmp/tailscale*

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]