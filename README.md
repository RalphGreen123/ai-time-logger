# AI Time Logger — Claude Code Skill

Track how long you spend working with AI each day, and estimate the time saved vs doing the same work without it. Logs to a local daily file and a shared consolidated Markdown table your whole team can contribute to.

## What it does

1. Reads your Claude Code session history (`~/.claude/history.jsonl`)
2. Groups sessions by ID and calculates active time, capping idle gaps at 15 minutes
3. Shows you each session (project, start time, first prompt) and asks you to name the task and estimate the non-AI equivalent time
4. Writes a daily Markdown log and appends a row to a shared consolidated table

**Sample output:**

```markdown
# AI Time Log — 17 Jun 2026

| Name | Task | AI Time | Non-AI Time | Date |
|------|------|---------|-------------|------|
| Ralph Green | Morning briefing | 45m | 15m | 2026-06-17 |
| Ralph Green | Build AI time logger skill | 1h 20m | 4h | 2026-06-17 |

**Total AI Time: 2h 05m**
```

## Requirements

- [Claude Code](https://claude.ai/code) installed
- Node.js 18 or later (already a Claude Code requirement)

## Install

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/ai-time-logger

# 2. Copy the skill into your Claude Code skills directory
cp -r ai-time-logger ~/.claude/skills/ai-time-logger

# 3. Set up your config
cp ai-time-logger/config.example.json ~/.ai-time-logger.json
```

Then edit `~/.ai-time-logger.json`:

```json
{
  "userName": "Your Name",
  "dailyLogDir": "/path/to/your/local/ai-logs",
  "consolidatedLogPath": "/path/to/shared/OneDrive/ai-time-log.md",
  "idleThresholdMinutes": 15
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `userName` | Yes | Your name as it appears in the log table |
| `dailyLogDir` | No | Local directory for daily log files (one per day) |
| `consolidatedLogPath` | No | Path to the shared consolidated log (OneDrive, SharePoint, etc.) |
| `idleThresholdMinutes` | No | Minutes of inactivity before a gap stops counting (default: 15) |

At least one of `dailyLogDir` or `consolidatedLogPath` must be set.

> **Note:** Use full absolute paths in the config — JSON does not expand `~`. Use `/Users/yourname/...` on Mac/Linux or `C:\Users\yourname\...` on Windows.

4. Restart Claude Code. The skill is now available.

## Usage

Say any of the following to Claude Code:

- `log my ai time`
- `ai time log`
- `record my ai usage today`
- `track ai time today`

Claude will walk you through naming each session and estimating non-AI time, then write the logs.

## Team setup

Each team member installs the skill individually and points `consolidatedLogPath` at the same shared file (e.g. a OneDrive or SharePoint folder everyone can access). Each person's rows are appended to the same table. The file is plain Markdown — anyone can edit it directly.

## How active time is calculated

For each session, Claude Code logs the timestamp of every message you send. Active time is calculated as the sum of gaps between consecutive messages, with each gap capped at `idleThresholdMinutes`. This excludes time you were away from the keyboard. The minimum logged time for any session is 5 minutes.

## Script CLI (advanced)

You can run the underlying script directly if needed:

```bash
# See today's sessions as JSON
node ~/.claude/skills/ai-time-logger/scripts/ai-time-logger.js sessions

# See sessions for a specific date
node ~/.claude/skills/ai-time-logger/scripts/ai-time-logger.js sessions --date 2026-06-16

# Write from a JSON entries file
node ~/.claude/skills/ai-time-logger/scripts/ai-time-logger.js write \
  --config ~/.ai-time-logger.json \
  --entries-file /path/to/entries.json
```

## License

MIT
