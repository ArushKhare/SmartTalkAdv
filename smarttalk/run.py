#!/usr/bin/env python3
"""
Cross-platform runner for SmartTalk
Starts both backend (FastAPI) and frontend (React)
"""

import subprocess
import sys
import os
import time
import signal
from pathlib import Path

# Colors for terminal
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'

def print_color(msg, color=Colors.GREEN):
    print(f"{color}{msg}{Colors.END}")

def check_requirements():
    """Check if required tools are installed"""
    # Check Python packages
    try:
        import uvicorn
        import fastapi
    except ImportError:
        print_color("Installing Python dependencies...", Colors.YELLOW)
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "backend/requirements.txt", "-q"])
    
    # Check Node.js
    result = subprocess.run(["node", "--version"], capture_output=True)
    if result.returncode != 0:
        print_color("Node.js not found. Please install Node.js", Colors.RED)
        sys.exit(1)

def main():
    print_color("Starting SmartTalk", Colors.GREEN)
    print("=" * 40)
    
    # Check for .env file
    env_file = Path("backend/.env")
    if not env_file.exists():
        print_color("No .env file found in backend/", Colors.YELLOW)
        print("Create backend/.env with: GOOGLE_API_KEY=your-key-here")
        
        api_key = input("Enter your GOOGLE_API_KEY (or press Enter to skip): ").strip()
        if api_key:
            env_file.write_text(f"GOOGLE_API_KEY={api_key}\n")
            print_color("Created .env file", Colors.GREEN)
        else:
            sys.exit(1)
    
    check_requirements()
    
    processes = []
    
    try:
        # Start backend
        print_color("Starting backend...", Colors.GREEN)
        backend_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
            cwd="backend",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        processes.append(backend_process)
        
        # Wait for backend to start
        time.sleep(3)
        
        # Install frontend dependencies
        print_color("Installing frontend dependencies...", Colors.YELLOW)
        subprocess.run(["npm", "install"], cwd="frontend", capture_output=True)
        
        # Start frontend
        print_color("Starting frontend...", Colors.GREEN)
        frontend_process = subprocess.Popen(
            ["npm", "start"],
            cwd="frontend",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT
        )
        processes.append(frontend_process)
        
        print()
        print("=" * 40)
        print_color("App is running!", Colors.GREEN)
        print()
        print(f"Backend:  {Colors.YELLOW}http://localhost:8000{Colors.END}")
        print(f"Frontend: {Colors.YELLOW}http://localhost:3000{Colors.END}")
        print(f"API Docs: {Colors.YELLOW}http://localhost:8000/docs{Colors.END}")
        print()
        print("Press Ctrl+C to stop")
        print("=" * 40)
        
        # Wait for processes
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print_color("\nShutting down...", Colors.YELLOW)
    finally:
        for p in processes:
            p.terminate()
            p.wait()
        print_color("Stopped", Colors.GREEN)

if __name__ == "__main__":
    main()
