FROM caddy:2-alpine
COPY b2b-lead-generation-site-for-a-premium-brand/project/site-v3/ /srv/
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
