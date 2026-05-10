#!/bin/bash

# Kill process running on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process running on port 3000"

# Run pnpm dev
pnpm dev