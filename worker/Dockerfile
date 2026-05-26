FROM node:20-slim

# Instala ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY worker.js ./

# Cloud Run exige que a aplicação escute na PORT (para health check)
# O worker não é um servidor HTTP, mas precisamos de um endpoint de saúde
ENV PORT=8080

CMD ["node", "worker.js"]
