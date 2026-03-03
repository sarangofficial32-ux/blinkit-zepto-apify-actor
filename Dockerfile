# Use the official Apify Playwright+Chrome image (Node 20)
FROM apify/actor-node-playwright-chrome:20

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -rf ~/.npm

# Copy source code (node_modules excluded via .dockerignore)
COPY . ./

# Run the actor
CMD npm start
