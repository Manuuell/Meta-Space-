FROM node:22-bookworm-slim

WORKDIR /app

# Instala primero las dependencias para aprovechar la cache de Docker cuando
# solo cambia el juego. onnxruntime-node es opcional para desarrollo, pero se
# instala en produccion porque genera las voces de los personajes.
COPY package.json package-lock.json ./
RUN npm ci --include=optional

COPY . ./

# El descargador fija la revision de Supertonic 2 y comprueba las huellas de
# los modelos antes de incorporarlos a la imagen.
RUN npm run voces \
    && npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force \
    && chown -R node:node /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787

USER node

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "creator-server.ts"]
