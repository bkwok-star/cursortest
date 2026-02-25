#!/usr/bin/env bash
# Fix Cursor MCP tool prompts - enables auto-run for MCP tools without manual approval.
# Source: https://forum.cursor.com/t/mcp-allowlist-doesnt-work-also-cant-be-edited/135594/14
# Run with: Cursor fully quit, then: ./cursor-mcp-autorun-fix.sh

set -euo pipefail
ROOT="$HOME/Library/Application Support/Cursor"
STAMP=$(date +%Y%m%d-%H%M%S)
KEY='src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser'

echo "Fixing Cursor MCP auto-run (backing up state.vscdb first)..."

find "$ROOT/User" "$ROOT/User/profiles" -type f -name state.vscdb -print0 2>/dev/null | while IFS= read -r -d '' DB; do
  cp "$DB" "$DB.bak.$STAMP" || true
  /usr/bin/sqlite3 "$DB" "PRAGMA busy_timeout=5000; BEGIN;
    UPDATE ItemTable SET value=json_set(value,
      '$.shouldAutoContinueToolCall', 1,
      '$.yoloMcpToolsDisabled', 0,
      '$.isAutoApplyEnabled', 1
    ) WHERE key='$KEY' AND json_valid(value);
    UPDATE ItemTable SET value=json_set(value,
      '$.composerState.useYoloMode', 0,
      '$.composerState.shouldAutoContinueToolCall', 1,
      '$.composerState.yoloMcpToolsDisabled', 0,
      '$.composerState.isAutoApplyEnabled', 1,
      '$.composerState.modes4[0].autoRun', 1,
      '$.composerState.modes4[0].fullAutoRun', 1
    ) WHERE key='$KEY' AND json_valid(value);
    UPDATE ItemTable SET value=REPLACE(value,'\"mcpEnabled\": false','\"mcpEnabled\": true')
      WHERE key='$KEY' AND value LIKE '%\"mcpEnabled\": false%';
    COMMIT;"
  /usr/bin/sqlite3 -readonly "$DB" "SELECT '$DB',
    json_extract(value,'$.composerState.shouldAutoContinueToolCall'),
    json_extract(value,'$.composerState.yoloMcpToolsDisabled'),
    json_extract(value,'$.composerState.modes4[0].fullAutoRun')
    FROM ItemTable WHERE key='$KEY';"
done

echo ""
echo "Done. Restart Cursor and Jira MCP tools should auto-run without prompts."
