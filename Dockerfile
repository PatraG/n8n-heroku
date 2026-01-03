FROM n8nio/n8n:latest

USER root

# Install Tailscale dependencies for Alpine
RUN apk add --no-cache ca-certificates iptables ip6tables curl \
    && ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') \
    && curl -fsSL -o /tmp/tailscale.tgz "https://pkgs.tailscale.com/stable/tailscale_latest_${ARCH}.tgz" \
    && tar -xzf /tmp/tailscale.tgz -C /tmp \
    && cp /tmp/tailscale_*/tailscale /usr/local/bin/ \
    && cp /tmp/tailscale_*/tailscaled /usr/local/bin/ \
    && chmod +x /usr/local/bin/tailscale* \
    && rm -rf /tmp/tailscale*

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]