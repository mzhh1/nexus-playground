# Nexus Playground - Quick Start Guide (M0)

This guide will help you quickly set up and run the Nexus Playground M0 (基础可运行版本).

## Prerequisites

- Docker & Docker Compose installed
- Node.js 18+ (for local development)
- Make (optional, for convenience commands)

## Quick Start with Docker

### 1. Setup Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.template .env
# Edit .env with your configuration (especially database passwords)
```

### 2. Start All Services

```bash
make up
# Or: docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend (port 3000)
- Frontend (port 5173)
- Nginx (port 80)

### 3. Wait for Services to be Ready

```bash
make health
# Or: curl http://localhost/api/health
```

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost
```

You'll be redirected to your nexus page at:
```
http://localhost/my-nexus.html
```

## Testing M0 Features

### Single User Flow (Default)

1. **Access your nexus**: http://localhost/my-nexus.html
   - User ID: `test_user_1` (default)

2. **Select Tic-Tac-Toe game**
   - Click "Select Game" dropdown
   - Choose "tic-tac-toe"

3. **Add second player**
   - Click "Add Human Player"
   - Enter a display name (e.g., "Player 2")

4. **Map roles**
   - Assign `player_X` to first player
   - Assign `player_O` to second player

5. **Start game**
   - Click "Start Game"

6. **Play!**
   - Click on empty cells to place your mark
   - Game updates in real-time via SSE

### Two User Flow (Same Browser)

1. **User 1** (default user):
   ```
   http://localhost/my-nexus.html
   ```

2. **User 2** (new tab with different user):
   ```
   http://localhost/?userId=test_user_2
   ```
   Then navigate to User 1's room:
   ```
   http://localhost/room.html?id=<ROOM_ID>
   ```
   (Get ROOM_ID from User 1's page)

3. **User 2 joins**:
   - Click "Join Room"
   - Enter display name

4. **User 1 starts game**:
   - Assign roles
   - Click "Start Game"

5. **Both users play**:
   - Take turns clicking cells
   - Real-time updates via SSE

## Development

### Backend Development

```bash
cd backend
npm install
npm run dev
```

Backend will run on http://localhost:3000

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on http://localhost:5173

## Useful Commands

### Using Make

```bash
make up       # Start all services
make down     # Stop all services
make logs     # View all logs
make logs-backend   # View backend logs
make logs-frontend  # View frontend logs
make ps       # Show running services
make health   # Check service health
make clean    # Stop and remove all volumes
```

### Using Docker Compose

```bash
docker-compose up -d              # Start services
docker-compose down               # Stop services
docker-compose logs -f backend    # Follow backend logs
docker-compose ps                 # List services
docker-compose restart backend    # Restart backend
```

## Troubleshooting

### Services not starting

1. Check Docker is running
2. Check ports 80, 3000, 5173, 5432, 6379 are available
3. Check logs: `make logs`

### Database connection errors

1. Wait for PostgreSQL to initialize (can take 10-20 seconds)
2. Check logs: `make logs-postgres`
3. Verify environment variables in `.env`

### Frontend can't connect to backend

1. Check Nginx is running: `docker-compose ps nginx`
2. Check backend is healthy: `curl http://localhost/api/health`
3. Check browser console for errors

### SSE not working

1. Check Nginx configuration allows SSE
2. Verify `Connection: keep-alive` in network tab
3. Check backend SSE endpoint: `curl http://localhost/api/v1/rooms/ROOM_ID/perspectives/player_X/stream`

## M0 Limitations

This is a basic runnable version (M0). The following features are simplified or not implemented:

1. **Authentication**: Uses simple X-User-Id header (no OAuth)
2. **LLM Players**: Framework exists but not functional (M2 feature)
3. **Game Snapshots**: Database structure exists but UI not implemented
4. **Multi-game Support**: Only tic-tac-toe implemented
5. **Production Optimizations**: Not optimized for scale

## Next Steps

After testing M0, you can:

1. **Add more games**: Implement new games in `games/` directory
2. **Implement OAuth**: Replace X-User-Id with proper OAuth
3. **Add LLM players**: Implement LLM executor in M2
4. **Deploy to production**: Use production Docker build
5. **Scale**: Add load balancing, CDN, etc.

## API Endpoints

### Health Check
```
GET /api/health
```

### My Nexus
```
GET  /api/v1/my-nexus
POST /api/v1/my-nexus/select-game
POST /api/v1/my-nexus/add-player
POST /api/v1/my-nexus/remove-player
POST /api/v1/my-nexus/start
POST /api/v1/my-nexus/pause
POST /api/v1/my-nexus/resume
POST /api/v1/my-nexus/stop
```

### Rooms
```
GET  /api/v1/rooms/:roomId
POST /api/v1/rooms/:roomId/join
```

### Actions
```
POST /api/v1/rooms/:roomId/actions
```

### Perspectives
```
GET /api/v1/rooms/:roomId/perspectives/:roleId
GET /api/v1/rooms/:roomId/perspectives/:roleId/stream (SSE)
```

## Support

For issues, questions, or contributions, please refer to:
- `platform_design.md` - System architecture
- `game_integration_guide.md` - Game development guide
- `backend_best_practices.md` - Backend standards
- `frontend_best_practices.md` - Frontend standards

