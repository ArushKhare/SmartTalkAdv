#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SmartTalk${NC}"
echo "================================"

# Check for .env file
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}No .env file found in backend/${NC}"
    echo "Create backend/.env with: GOOGLE_API_KEY=your-key-here"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}Starting backend...${NC}"
cd backend
pip install -r requirements.txt -q
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo -e "${GREEN}Starting frontend...${NC}"
cd frontend
npm install --silent
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}App is running!${NC}"
echo ""
echo -e "Backend:  ${YELLOW}http://localhost:8000${NC}"
echo -e "Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "API Docs: ${YELLOW}http://localhost:8000/docs${NC}"
echo ""
echo "Press Ctrl+C to stop"
echo -e "${GREEN}================================${NC}"

# Wait for both processes
wait
