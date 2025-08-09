# drawDB Docker Setup

This document provides a quick overview of the Docker deployment for drawDB.

## Quick Start

1. **Prerequisites**: Docker and Docker Compose installed
2. **Start**: `./docker-start.sh`
3. **Access**: http://localhost
4. **Stop**: `./docker-stop.sh`

## Architecture

- **Frontend**: Nginx serving built React app (Port 80)
- **Backend**: Node.js API server (Port 3001)
- **Database**: SQLite with persistent volume mapping

## Files Created

### Docker Configuration
- `Dockerfile.backend` - Backend container definition
- `Dockerfile.frontend` - Frontend container with Nginx
- `docker-compose.yml` - Multi-container orchestration
- `docker/nginx.conf` - Nginx configuration with API proxy
- `docker/docker-entrypoint.sh` - Backend initialization script
- `.dockerignore` - Build optimization

### Management Scripts
- `docker-start.sh` - Start all services
- `docker-stop.sh` - Stop all services  
- `docker-restart.sh` - Restart all services
- `docker.env` - Environment variables template

## Volume Mapping

Local directories mapped to containers for persistence:

```
./data/sqlite/     -> /app/data/        (SQLite database files)
./data/config/     -> /app/config/      (Configuration files)
```

## Key Features

✅ **Persistent Data**: SQLite database survives container restarts
✅ **Network Access**: Accessible from other machines
✅ **Health Checks**: Automatic service monitoring
✅ **Production Ready**: Optimized Nginx frontend serving
✅ **Easy Management**: Simple start/stop scripts
✅ **Environment Config**: Customizable via environment variables

## Customization

Copy `docker.env` to `.env` and modify as needed:

```bash
cp docker.env .env
# Edit .env with your preferences
```

### Common Configuration Examples

**Custom Ports**:
```bash
FRONTEND_PORT=8080
BACKEND_PORT=3001
```

**Custom Volume Paths**:
```bash
# Store data in a different location on host
HOST_DATA_DIR=/var/lib/drawdb/data
HOST_CONFIG_DIR=/var/lib/drawdb/config

# Use different container paths (advanced - affects internal app paths)
CONTAINER_DATA_DIR=/app/database
CONTAINER_CONFIG_DIR=/app/settings
# Note: When using custom container dirs, database paths are automatically set to:
# SQLITE_DB_PATH=/app/database/drawdb.sqlite
# CONFIG_DB_PATH=/app/settings/config.sqlite
```

**Disable Rate Limiting** (for development or trusted environments):
```bash
RATE_LIMIT_ENABLED=false
```

**High Traffic Configuration**:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=900000
```

**Development Setup**:
```bash
FRONTEND_PORT=3000
BACKEND_PORT=3001
RATE_LIMIT_ENABLED=false
```

**Production Setup**:
```bash
FRONTEND_PORT=80
BACKEND_PORT=3001
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
ENCRYPTION_KEY=your-secure-production-key

# Production data storage
HOST_DATA_DIR=/var/lib/drawdb/data
HOST_CONFIG_DIR=/var/lib/drawdb/config
```

## Docker Management

### Available Scripts

- **Start**: `./docker-start.sh` - Start containers with health checks
- **Stop**: `./docker-stop.sh` - Stop all containers gracefully
- **Restart**: `./docker-restart.sh` - Stop and start containers
- **Rebuild**: `./docker-rebuild.sh` - Rebuild containers after code changes
- **Quick Rebuild**: `./docker-quick-rebuild.sh` - Fast rebuild for minor changes
- **Force Rebuild**: `./docker-rebuild.sh --force` - Complete rebuild with cleanup

### When to Use Each Script

- **Code Changes**: Use `./docker-rebuild.sh` to pick up new code
- **Minor Updates**: Use `./docker-quick-rebuild.sh` for faster rebuilds
- **Major Changes**: Use `./docker-rebuild.sh --force` for complete cleanup
- **Daily Usage**: Use `./docker-start.sh`, `./docker-stop.sh`, `./docker-restart.sh`

## Troubleshooting

- **View logs**: `docker-compose logs -f`
- **Check status**: `docker-compose ps`  
- **Rebuild**: `./docker-restart.sh`
- **Access containers**: `docker-compose exec backend sh`

This setup provides a robust, production-ready deployment of drawDB with persistent data storage.
