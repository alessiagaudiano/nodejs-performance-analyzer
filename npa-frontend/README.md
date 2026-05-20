# NPA Frontend

React (Create React App) frontend for the NPA project.

## Run with Docker (recommended)

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- Docker Compose v2 (use `docker compose`)

> **Note:** If you want to connect this frontend to the API, make sure the [`npa-backend`](https://github.com/wahabmangat/npa-backend) service is running first by following its setup instructions.

### Start

From this directory:

    docker compose up --build

Open: http://localhost:3000

### Stop

    docker compose down

### Clean rebuild (when dependencies change)

Use this after adding/removing npm packages, or if the container/node_modules volume gets out of sync:

    docker compose down -v
    docker compose build --no-cache
    docker compose up

### Helpful commands

Check container status:

    docker compose ps

Follow container logs:

    docker compose logs -f frontend

Open a shell inside the container:

    docker compose exec frontend sh

## Local development (without Docker)

Install dependencies and start the dev server:

    npm ci
    npm start

Open: http://localhost:3000
