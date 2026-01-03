FROM n8nio/n8n:latest

USER root

# Install Tailscale dependencies for Alpine
RUN apk add --no-cache ca-certificates iptables ip6tables curl \
    && curl -fsSL https://tailscale.com/install.sh | sh || true

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]