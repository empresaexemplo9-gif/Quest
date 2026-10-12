FROM node:24-trixie-slim@sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63
WORKDIR /app
COPY --chown=node:node . /app
ENV NODE_ENV=production LD_LIBRARY_PATH=/app/runtime-libs QUEST_RO_BIND=0.0.0.0
USER node
EXPOSE 3005
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s CMD node -e "fetch('http://127.0.0.1:3005/api/readiness').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "deploy/ragnarok/supervisor.mjs"]
