#!/bin/bash

# SquirrelNVR Setup Script
# This script installs and configures SquirrelNVR on a Linux system

set -e

echo "═══════════════════════════════════════════════════════"
echo "  SquirrelNVR Setup"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "⚠ This script should be run as root or with sudo"
   exit 1
fi

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "✗ Node.js is not installed"
    echo "Please install Node.js 18 or higher"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "✗ Node.js version is too old ($(node -v))"
    echo "Please install Node.js 18 or higher"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠ FFmpeg is not installed"
    echo "Installing FFmpeg..."

    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y ffmpeg
    elif command -v yum &> /dev/null; then
        yum install -y ffmpeg
    else
        echo "✗ Unable to install FFmpeg automatically"
        echo "Please install FFmpeg manually"
        exit 1
    fi
fi

echo "✓ FFmpeg detected"

# Install dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

echo ""
echo "Building server..."
npm run build:server

echo ""
echo "Installing client dependencies..."
cd client
npm install

echo ""
echo "Building client..."
npm run build
cd ..

# Create directories
echo ""
echo "Creating data directories..."
mkdir -p data
mkdir -p logs
mkdir -p recordings/{hls,snapshots,thumbnails}

# Copy environment file
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created"
    echo "⚠ Please edit .env file to configure your settings"
fi

# Create systemd service (Linux)
echo ""
echo "Creating systemd service..."

cat > /etc/systemd/system/squirrel-nvr.service << EOF
[Unit]
Description=SquirrelNVR - IP Camera NVR System
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
StandardOutput=append:$(pwd)/logs/output.log
StandardError=append:$(pwd)/logs/error.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo "✓ Systemd service created"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SquirrelNVR Setup Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Edit .env file to configure your settings"
echo "  2. Start the service:"
echo "     sudo systemctl start squirrel-nvr"
echo "  3. Enable autostart:"
echo "     sudo systemctl enable squirrel-nvr"
echo "  4. View logs:"
echo "     sudo journalctl -u squirrel-nvr -f"
echo ""
echo "Default login:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "⚠ Please change the default password after first login!"
echo ""
