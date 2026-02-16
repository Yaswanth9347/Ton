#!/bin/bash

# JMJ Management System - Startup Script
# Supports: dev (default), docker, and stop modes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ${CYAN}JMJ Management System${NC}                   ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

print_header

# ─── Parse arguments ───────────────────────────────────────
MODE="dev"
SKIP_SEED=false

usage() {
    echo "Usage: ./start.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  dev         Start in development mode (default)"
    echo "              Runs DB in Docker, backend & frontend locally"
    echo "  docker      Start everything in Docker containers"
    echo "  stop        Stop all running services and containers"
    echo "  --no-seed   Skip database seeding on first run"
    echo "  -h, --help  Show this help message"
    echo ""
}

for arg in "$@"; do
    case "$arg" in
        dev)        MODE="dev" ;;
        docker)     MODE="docker" ;;
        stop)       MODE="stop" ;;
        --no-seed)  SKIP_SEED=true ;;
        -h|--help)  usage; exit 0 ;;
        *)          echo -e "${RED}Unknown option: $arg${NC}"; usage; exit 1 ;;
    esac
done

# ─── Stop mode ─────────────────────────────────────────────
if [ "$MODE" = "stop" ]; then
    echo -e "${YELLOW}Stopping all services...${NC}"
    pkill -f "nodemon src/app.js" 2>/dev/null || true
    pkill -f "node src/app.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    fuser -k 3002/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
    docker compose down 2>/dev/null || true
    echo ""
    echo -e "${GREEN}✓ All services stopped${NC}"
    echo ""
    echo -e "${YELLOW}To also remove the database volume:${NC}"
    echo -e "  docker compose down -v"
    exit 0
fi

# ─── Check Docker ──────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# ─── Full Docker mode ─────────────────────────────────────
if [ "$MODE" = "docker" ]; then
    echo -e "${YELLOW}Building and starting all containers...${NC}"
    docker compose up --build -d
    echo ""
    echo -e "${GREEN}✓ All containers are up${NC}"
    echo ""
    echo -e "${CYAN}Access:${NC}"
    echo -e "  Application:  http://localhost:8085"
    echo -e "  Backend API:  http://localhost:3005/api"
    echo ""
    echo -e "${YELLOW}View logs:${NC}   docker compose logs -f"
    echo -e "${YELLOW}Stop:${NC}        ./start.sh stop"
    exit 0
fi

# ─── Development mode ─────────────────────────────────────
echo -e "${CYAN}Mode: Development${NC}"
echo ""

# ─── Cleanup Function ─────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping application and containers...${NC}"
    # Kill the concurrently process (npm run dev)
    pkill -P $$ || true
    
    # Stop the postgres container
    echo -e "${YELLOW}Stopping PostgreSQL container...${NC}"
    docker compose stop postgres
    
    echo -e "${GREEN}✓ Cleanup complete. Application stopped.${NC}"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Kill any existing dev processes on our ports
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
pkill -f "nodemon src/app.js" 2>/dev/null || true
pkill -f "node src/app.js" 2>/dev/null || true
fuser -k 3002/tcp 2>/dev/null || true
fuser -k 3005/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
fuser -k 8085/tcp 2>/dev/null || true
sleep 1
echo -e "${GREEN}✓ Ports cleared${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing root dependencies...${NC}"
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create .env if not exists
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend .env from example...${NC}"
    cp backend/.env.example backend/.env
fi
echo -e "${GREEN}✓ Environment configured${NC}"

# Start PostgreSQL container
echo -e "${YELLOW}Starting PostgreSQL container...${NC}"
docker compose up -d postgres

# Wait for PostgreSQL to be healthy
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
RETRIES=30
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -e "${YELLOW}  Waiting for database... ($RETRIES attempts remaining)${NC}"
    RETRIES=$((RETRIES-1))
    sleep 1
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}Error: PostgreSQL failed to start${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Run migrations and seed if database is fresh
echo -e "${YELLOW}Checking database state...${NC}"
ROLES_EXIST=$(docker compose exec -T postgres psql -U postgres -d attendance_db -tAc \
    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'roles');" 2>/dev/null || echo "f")

if [ "$ROLES_EXIST" != "t" ]; then
    echo -e "${YELLOW}Running database migrations...${NC}"
    npm run migrate
    echo -e "${GREEN}✓ Migrations complete${NC}"

    if [ "$SKIP_SEED" = false ]; then
        echo -e "${YELLOW}Seeding database with sample data...${NC}"
        npm run seed
        echo -e "${GREEN}✓ Database seeded${NC}"
    fi
else
    echo -e "${GREEN}✓ Database already initialized${NC}"
fi

# ─── Start application ────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}JMJ is running${NC}                          ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Local Access:${NC}"
echo -e "  Frontend:  http://localhost:5173"
echo -e "  Backend:   http://localhost:3002"
echo ""

LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -n "$LOCAL_IP" ]; then
    echo -e "${CYAN}Network Access (other devices on LAN):${NC}"
    echo -e "  Frontend:  http://${LOCAL_IP}:5173"
    echo -e "  Backend:   http://${LOCAL_IP}:3002"
    echo ""
fi

echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Unset potentially conflicting environment variables
unset DB_PORT

# Start backend and frontend concurrently
npm run dev
