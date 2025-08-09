# drawDB - Ubuntu Setup Guide

This guide will walk you through setting up drawDB on Ubuntu systems with database storage support.

## Prerequisites

### System Requirements
- Ubuntu 18.04 LTS or newer
- At least 2GB RAM
- 1GB free disk space

### Required Software

#### 1. Node.js (v18 or newer)

Install Node.js using NodeSource repository:

```bash
# Update package index
sudo apt update

# Install curl if not already installed
sudo apt install -y curl

# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### 2. Git

```bash
sudo apt install -y git
```

#### 3. Build Tools (for native dependencies)

```bash
sudo apt install -y build-essential python3 python3-pip
```

#### 4. Additional Dependencies

```bash
# For SQLite and other native modules
sudo apt install -y sqlite3 libsqlite3-dev

# For potential SSL/TLS requirements
sudo apt install -y ca-certificates

# For networking tools used by the startup script
sudo apt install -y net-tools curl
```

## Installation

### Docker Installation (Recommended)

#### Prerequisites for Docker Setup

1. **Install Docker**:
```bash
# Update package index
sudo apt update

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group (optional, avoids using sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

2. **Install Docker Compose**:
```bash
# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

3. **Clone and Run**:
```bash
git clone https://github.com/drawdb-io/drawdb.git
cd drawdb

# Start with Docker
./docker-start.sh
```

### Manual Installation (Development)

For development or if you prefer not to use Docker:

#### 1. Clone the Repository

```bash
git clone https://github.com/drawdb-io/drawdb.git
cd drawdb
```

### 2. Install Dependencies

Install backend dependencies:
```bash
cd server
npm install
cd ..
```

Install frontend dependencies:
```bash
npm install
```

### 3. Initialize Database

The startup script will automatically initialize the database, but you can do it manually:

```bash
cd server
npm run init-db
cd ..
```

## Running drawDB

### Option 1: Docker (Recommended for Production)

The easiest way to run drawDB with persistent data storage:

```bash
./docker-start.sh
```

This will:
- Build and start both frontend and backend containers
- Map local `./data/` folder for SQLite database persistence
- Make the application available at http://localhost
- Backend API available at http://localhost:3001

To stop:
```bash
./docker-stop.sh
```

**Requirements for Docker setup:**
- Docker installed
- Docker Compose installed

### Option 2: Development Mode (Quick Start)

Use the provided startup script for development:

```bash
./start-database-mode.sh
```

This script will:
- Stop any existing processes
- Start the backend server on port 3001
- Start the frontend development server on port 5173 (configurable via FRONTEND_DEV_PORT)
- Make both services accessible from the network

### Manual Start

If you prefer to start services manually:

#### Backend Server
```bash
cd server
node server.js &
cd ..
```

#### Frontend Server
```bash
npm run dev -- --host 0.0.0.0
```

## Accessing drawDB

### Docker Deployment
- **Local Access**: http://localhost
- **Network Access**: http://YOUR_IP_ADDRESS
- **Backend API**: http://localhost:3001 or http://YOUR_IP_ADDRESS:3001

### Development Mode
- **Local Access**: http://localhost:5173 (or custom FRONTEND_DEV_PORT)
- **Network Access**: http://YOUR_IP_ADDRESS:5173 (or custom FRONTEND_DEV_PORT)
- **Backend API**: http://localhost:3001 or http://YOUR_IP_ADDRESS:3001

To find your IP address:
```bash
ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1
```

## Stopping Services

### Docker Deployment
```bash
./docker-stop.sh
```

### Development Mode
```bash
pkill -f 'node.*server.js' && pkill -f 'vite'
```

## Docker Management

### Managing Docker Containers

1. **Start services**:
```bash
./docker-start.sh
```

2. **Stop services**:
```bash
./docker-stop.sh
```

3. **Restart services**:
```bash
./docker-restart.sh
```

4. **Rebuild after code changes**:
```bash
# Standard rebuild (recommended for code changes)
./docker-rebuild.sh

# Quick rebuild (faster for minor changes)
./docker-quick-rebuild.sh

# Force rebuild with cleanup (for major changes)
./docker-rebuild.sh --force
```

5. **View logs**:
```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# View frontend logs only
docker-compose logs -f frontend
```

5. **Check container status**:
```bash
docker-compose ps
```

### Data Persistence

Your SQLite database and configuration files are stored in:
- **Database**: `./data/sqlite/drawdb.sqlite`
- **Configuration**: `./data/config/config.sqlite`

These directories are automatically created and mapped to the containers, ensuring your data persists even when containers are stopped or updated.

### Updating Docker Images

To update to the latest version:
```bash
# Pull latest code
git pull

# Rebuild and restart containers
./docker-restart.sh
```

## Troubleshooting

### Common Issues

#### 1. Permission Denied Errors

If you get permission errors when running the startup script:
```bash
chmod +x start-database-mode.sh
```

#### 2. Port Already in Use

If ports 3001 or 5173 (or custom ports) are already in use:
```bash
# Check what's using the ports
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :5173

# Kill processes using the ports
sudo pkill -f 'node.*server.js'
sudo pkill -f 'vite'
```

#### 3. Node.js Version Issues

Ensure you're using Node.js v18 or newer:
```bash
node --version
```

If you need to update Node.js, follow the installation steps above.

#### 4. Native Module Compilation Errors

If you encounter errors with native modules (like SQLite3):
```bash
# Install additional build tools
sudo apt install -y make g++ python3-dev

# Rebuild native modules
cd server
npm rebuild
cd ..

# For frontend
npm rebuild
```

#### 5. Network Access Issues

If you can't access drawDB from other machines:

1. Check firewall settings:
```bash
sudo ufw status
sudo ufw allow 5173  # Or your custom FRONTEND_DEV_PORT
sudo ufw allow 3001
```

2. Verify the services are bound to all interfaces:
```bash
sudo netstat -tulpn | grep :5173
sudo netstat -tulpn | grep :3001
```

3. **Common Issue**: Loading page hangs when accessing from remote machines:
   
   This happens when the frontend can't reach the backend API. The startup script should automatically configure this, but if you're having issues:

   a. Stop the services:
   ```bash
   pkill -f 'node.*server.js' && pkill -f 'vite'
   ```

   b. Get your machine's IP address:
   ```bash
   ip addr show | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -1
   ```

   c. Set the backend URL and restart:
   ```bash
   export VITE_BACKEND_URL="http://YOUR_IP_ADDRESS:3001"
   ./start-database-mode.sh
   ```

   d. Verify in browser console (F12) that API calls are going to the correct IP address.

4. **Testing Network Connectivity**:
   
   From the remote machine, test if you can reach the backend directly:
   ```bash
   curl http://198.19.249.161:3001/api/health
   ```
   
   Should return: `{"status":"ok","timestamp":"...","initialized":true,"connected":true}`

### Log Files

Check log files for debugging:
- Backend logs: `/tmp/drawdb-backend.log`
- Frontend output: Check the terminal where you started the services

### Database Issues

If you encounter database problems:

1. Check if SQLite database exists:
```bash
ls -la server/drawdb.sqlite
```

2. Reinitialize the database:
```bash
cd server
rm -f drawdb.sqlite
npm run init-db
cd ..
```

3. Check database permissions:
```bash
chmod 644 server/drawdb.sqlite
```

## Development Mode

The development script now uses the same environment configuration as Docker for consistency:

### Quick Start Development
```bash
./start-database-mode.sh
```

**Environment Configuration**:
- **Automatic Loading**: Script loads from `.env` → `docker.env` → defaults
- **Development Paths**: Database files stored in `./server/` directory  
- **Same Variables**: Rate limiting, encryption, and other settings work identically
- **Network Access**: Automatically configures frontend proxy for remote access

**Development vs Docker Paths**:
```bash
# Development (.env)
SQLITE_DB_PATH=./server/drawdb.sqlite
CONFIG_DB_PATH=./server/config.sqlite
FRONTEND_DEV_PORT=5173
PORT=3001

# Docker (docker.env) 
SQLITE_DB_PATH=/app/data/drawdb.sqlite  # → volume mapped to ./data/sqlite/
CONFIG_DB_PATH=/app/config/config.sqlite  # → volume mapped to ./data/config/
FRONTEND_PORT=80
BACKEND_PORT=3001
```

**Custom Port Configuration**:
To use different ports, modify your `.env` file:
```bash
# Custom development ports
FRONTEND_DEV_PORT=8080  # Vite dev server port
PORT=4000               # Backend API port

# Restart development services to pick up changes
./start-database-mode.sh
```

### Manual Development (Advanced)
For development purposes, you can also run the services separately:

```bash
# Backend Development
cd server
npm run dev  # Uses nodemon for auto-restart

# Frontend Development (separate terminal)
npm run dev
```

## Production Deployment

For production deployment on Ubuntu:

1. Install PM2 for process management:
```bash
sudo npm install -g pm2
```

2. Create a PM2 ecosystem file:
```bash
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'drawdb-backend',
    script: 'server/server.js',
    cwd: '/path/to/drawdb',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF
```

3. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

4. For the frontend, build and serve with nginx or similar:
```bash
npm run build
# Configure nginx to serve the dist folder
```

## Configuration

### Environment Variables

You can configure drawDB using environment variables:

```bash
export PORT=3001                           # Backend port
export ENCRYPTION_KEY=your-secret-key     # For encrypting sensitive data
export RATE_LIMIT_ENABLED=false           # Disable rate limiting
export RATE_LIMIT_MAX_REQUESTS=1000       # Max requests per window
export RATE_LIMIT_WINDOW_MS=900000        # Time window in milliseconds
```

For Docker deployments, copy `docker.env` to `.env` and modify:
```bash
cp docker.env .env
# Edit .env with your preferred settings
```

### Database Configuration

The default setup uses SQLite. To configure other databases, use the web interface after starting drawDB.

## Security Considerations

1. Change default encryption keys in production
2. Configure firewall rules appropriately
3. Use HTTPS in production environments
4. Regularly update Node.js and dependencies

## Getting Help

- **GitHub Issues**: https://github.com/drawdb-io/drawdb/issues
- **Documentation**: Check the main README.md file
- **Community**: Join the project discussions

## System Service (Optional)

To run drawDB as a system service:

1. Create a systemd service file:
```bash
sudo tee /etc/systemd/system/drawdb.service > /dev/null << EOF
[Unit]
Description=drawDB Application
After=network.target

[Service]
Type=forking
User=ubuntu
WorkingDirectory=/home/ubuntu/drawdb
ExecStart=/home/ubuntu/drawdb/start-database-mode.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

2. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable drawdb
sudo systemctl start drawdb
```

3. Check service status:
```bash
sudo systemctl status drawdb
```

---

**Note**: This guide assumes a standard Ubuntu installation. Adjust paths and commands as needed for your specific setup. 