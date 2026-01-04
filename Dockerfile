ARG TS_VERSION=1.92.3

FROM alpine:3.19 AS tailscale
ARG TS_VERSION

RUN apk add --no-cache ca-certificates curl tar
RUN curl -fsSL "https://pkgs.tailscale.com/stable/tailscale_${TS_VERSION}_amd64.tgz" \
	| tar -xz -C /tmp

FROM n8nio/n8n:latest
ARG TS_VERSION

USER root

COPY --from=tailscale /tmp/tailscale_${TS_VERSION}_amd64/tailscale /usr/local/bin/tailscale
COPY --from=tailscale /tmp/tailscale_${TS_VERSION}_amd64/tailscaled /usr/local/bin/tailscaled
RUN chmod +x /usr/local/bin/tailscale /usr/local/bin/tailscaled

WORKDIR /home/node/packages/cli
ENTRYPOINT []

COPY ./entrypoint.sh /
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]