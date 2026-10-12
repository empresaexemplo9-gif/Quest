FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
# npm run stack:start verifies dependencies against the lockfile before building.
# pg and its dependencies are pure JavaScript; the image can build without network access.
COPY --chown=node:node node_modules ./node_modules
COPY --chown=node:node server ./server
COPY --chown=node:node api ./api
COPY --chown=node:node public ./public
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server/index.js"]
