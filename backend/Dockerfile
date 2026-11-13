FROM node:22.13-alpine AS build
WORKDIR /workspace/backend
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22.13-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/backend
COPY --from=build /workspace/backend/package.json ./package.json
COPY --from=build /workspace/backend/node_modules ./node_modules
COPY --from=build /workspace/backend/dist ./dist
COPY drizzle ./drizzle
EXPOSE 4000
CMD ["npm", "start"]
