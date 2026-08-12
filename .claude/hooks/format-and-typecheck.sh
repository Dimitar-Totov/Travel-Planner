#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: reads the tool_input JSON from stdin,
# formats the edited file, then type-checks the project.
input=$(cat)
file=$(node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.tool_input && d.tool_input.file_path || '')" <<< "$input")

if [ -n "$file" ] && [ -f "$file" ]; then
  npx prettier --write "$file"
fi

npx tsc --noEmit
