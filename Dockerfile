FROM n8nio/n8n:latest

USER root

# Install Tailscale
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    iptables \
    iproute2 \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]