FROM n8nio/n8n:latest

USER root

# Install Tailscale - download pre-built binary
RUN mkdir -p /tmp/tailscale && \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    curl -fsSL -o /tmp/tailscale.tgz "https://pkgs.tailscale.com/stable/tailscale_latest_${ARCH}.tgz" && \
    tar -xzf /tmp/tailscale.tgz -C /tmp/tailscale && \
    find /tmp/tailscale -name "tailscale" -o -name "tailscaled" | head -2 | xargs -I {} cp {} /usr/local/bin/ && \
    chmod +x /usr/local/bin/tailscale* && \
    rm -rf /tmp/tailscale*

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]