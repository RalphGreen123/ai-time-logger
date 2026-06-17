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

| Name | Tool | User Story | Task | Explanation | Role | Helped With | AI Time | Non-AI Time | Date |
|------|------|------------|------|-------------|------|-------------|---------|-------------|------|
| Ralph Green | Claude | DIGIX-86186 | Build data ingestion solution | Generated architecture options and evaluated trade-offs | Dev | Analysis, Development | 1h 20m | 4h | 2026-06-17 |

**Total AI Time: 1h 20m**
```

## Requirements

- [Claude Code](https://claude.ai/code) installed
- Node.js 18 or later (already a Claude Code requirement)

## Install

Clone the repo **directly into your Claude Code skills directory** — this is important because the shared log lives in the repo itself:

```bash
git clone https://github.com/RalphGreen123/ai-time-logger ~/.claude/skills/ai-time-logger
```

Then set up your personal config:

```bash
cp ~/.claude/skills/ai-time-logger/config.example.json ~/.ai-time-logger.json
```

Edit `~/.ai-time-logger.json`:

```json
{
  "userName": "Your Name",
  "useGitRepo": true,
  "dailyLogDir": "/full/path/to/your/local/ai-logs",
  "idleThresholdMinutes": 15
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `userName` | Yes | Your name as it appears in the log table |
| `role` | Yes | Your role: `Dev`, `QA`, `DevOps`, `Support`, or `Other — <name>`. Used as default, overridable per session. |
| `useGitRepo` | No | Set `true` to use the repo's `logs/ai-time-log.md` as the shared log (recommended) |
| `dailyLogDir` | No | Local directory for personal daily log files (one per day) |
| `consolidatedLogPath` | No | Override the consolidated log path (only needed if not using Git repo mode) |
| `idleThresholdMinutes` | No | Minutes of inactivity before a gap stops counting (default: 15) |

> **Note:** Use full absolute paths — JSON does not expand `~`. Use `/Users/yourname/...` on Mac/Linux.

Restart Claude Code. The skill is now available.

### How the shared log works

- The consolidated log lives at `logs/ai-time-log.md` in this repo
- Each time you log, the skill pulls the latest version, appends your rows, commits, and pushes
- Everyone on the team clones the same repo, so the table grows as each person logs their time
- If two people push at the same time: `git pull --rebase && git push` resolves it

## Usage

Say any of the following to Claude Code:

- `log my ai time`
- `ai time log`
- `record my ai usage today`
- `track ai time today`

Claude will walk you through naming each session and estimating non-AI time, then write the logs.

## Team setup

Each team member installs the skill by cloning the same repo. The consolidated log (`logs/ai-time-log.md`) lives in the repo — everyone appends to it via git pull/push, so all rows accumulate in one place.

**For each team member:**

1. Clone the repo into the Claude Code skills directory:
   ```bash
   git clone https://github.com/RalphGreen123/ai-time-logger ~/.claude/skills/ai-time-logger
   ```

2. Set up personal config:
   ```bash
   cp ~/.claude/skills/ai-time-logger/config.example.json ~/.ai-time-logger.json
   ```
   Edit `~/.ai-time-logger.json` — set `userName`, `role`, and optionally `dailyLogDir`.

3. Restart Claude Code.

**GitHub access:** Team members need read/write access to `https://github.com/RalphGreen123/ai-time-logger` to push their log entries. Add them as collaborators in GitHub repo settings.

**Windows users:** Use full Windows paths in config, e.g. `C:\\Users\\yourname\\...`

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
