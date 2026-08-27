# Development image for apps/website. Independent of the other apps'
# package.json files on purpose (see website.Dockerfile) — only its own
# workspace manifest is needed to install and run it.
FROM node:20-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json* ./
COPY apps/website/package.json apps/website/package.json

RUN npm install

COPY . .

EXPOSE 3100

CMD ["npx", "turbo", "run", "dev", "--filter=@nexa/website"]
