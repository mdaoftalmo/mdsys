#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🚀 ERP MDV — Dev Mode (backend :3001 + frontend :3000)"
cd "$ROOT"
npm run dev
