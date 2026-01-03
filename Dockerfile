FROM n8nio/n8n:latest

USER root

# Install Tailscale (Alpine Linux)
RUN apk add --no-cache ca-certificates iptables ip6tables \
    && wget https://pkgs.tailscale.com/stable/tailscale_latest_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tgz \
    && tar xzf tailscale_*.tgz --strip-components=1 -C /usr/local/bin \
    && rm tailscale_*.tgz

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]