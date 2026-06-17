---
name: ai-time-logger
description: >
  Log AI time usage from today's Claude Code sessions to a Markdown file.
  Use when the user says: "log my ai time", "record my ai usage", "ai time log",
  "track ai time today", "how long did I spend on ai", "log today's ai sessions",
  "update the ai time tracker", "log my claude usage", "time log", or
  "how much time did I spend using ai today". Reads ~/.claude/history.jsonl,
  calculates active time per session (idle gaps capped at 15 min), interactively
  collects a task name and non-AI time estimate for each session, then writes a
  daily log file and appends to a shared consolidated log.
allowed-tools: [Bash, Read, Write]
version: 1.1.0
---

# AI Time Logger

This skill logs your AI productivity impact by reading your Claude Code session
history, calculating active time, and writing a structured Markdown table that
you and your team can use to track AI vs non-AI effort.

The shared consolidated log lives in this skill's Git repository — everyone on
the team clones the repo once, and each log entry is committed and pushed so the
table stays in sync across the team.

---

## Step 1 — Check config

Check that `~/.ai-time-logger.json` exists:

```bash
cat ~/.ai-time-logger.json
```

If the file is missing, tell the user:

> Config not found at `~/.ai-time-logger.json`.
> Copy `config.example.json` from the skill directory and fill in your details:
>
> ```bash
> cp ~/.claude/skills/ai-time-logger/config.example.json ~/.ai-time-logger.json
> ```
>
> Then edit it with your `userName` and optionally `dailyLogDir`, and run the command again.

Stop.

---

## Step 2 — Pull latest from Git

If the skill directory is a Git repo (check with `git -C $HOME/.claude/skills/ai-time-logger status`), pull before writing so the consolidated log is up to date:

```bash
git -C $HOME/.claude/skills/ai-time-logger pull
```

If pull fails (e.g. no remote configured yet), warn the user but continue — do not stop.

---

## Step 3 — Get today's sessions

Run:

```bash
node $HOME/.claude/skills/ai-time-logger/scripts/ai-time-logger.js sessions
```

If the output is `[]`, tell the user: "No Claude Code sessions found for today." Stop.

If the command fails, show the error and stop.

---

## Step 4 — Present sessions and collect task info

For each session object in the JSON array, present it to the user clearly:

---
**Session [N of TOTAL]**
- Started: [startTime]
- Project: [project]
- Prompts sent: [promptCount]
- Active AI time: [aiTime]
- First prompt: "[firstPrompt]"

Then ask **two questions** (one at a time):
1. What was the task for this session? (one-line description — or type **skip** to exclude this session from the log)
2. If not skipped: How long would this have taken without AI? (e.g. `30m`, `2h`, `half a day`)

If the user answers "skip" (or "s", "ignore", "personal", "exclude") to Q1, do not include this session in the entries and move to the next session.

Wait for both answers before moving to the next session.

Hold all answers in memory. Build a list of entry objects in this shape (skipped sessions are not included):
```json
[
  {
    "task": "<user's answer>",
    "aiTime": "<from sessions output>",
    "nonAiTime": "<user's answer>"
  }
]
```

---

## Step 5 — Write the log

Once all sessions are named, write the entries to a temp file and call the write subcommand.

**5a.** Use the Write tool to create `/tmp/ai-time-entries.json` with the entries array you built in Step 4.

**5b.** Resolve the consolidated log path. If config has `"useGitRepo": true` (or the key is absent and the skill dir is a git repo), use:

```
$HOME/.claude/skills/ai-time-logger/logs/ai-time-log.md
```

Otherwise use `consolidatedLogPath` from config.

**5c.** Run:

```bash
node $HOME/.claude/skills/ai-time-logger/scripts/ai-time-logger.js write \
  --config ~/.ai-time-logger.json \
  --entries-file /tmp/ai-time-entries.json \
  --consolidated $HOME/.claude/skills/ai-time-logger/logs/ai-time-log.md
```

(Omit `--consolidated` if using `consolidatedLogPath` from config instead.)

If the command fails, show the error message to the user.

---

## Step 6 — Commit and push

If the skill directory is a Git repo, commit the updated consolidated log and push:

```bash
git -C $HOME/.claude/skills/ai-time-logger add logs/ai-time-log.md
git -C $HOME/.claude/skills/ai-time-logger commit -m "AI time log: $(date +%Y-%m-%d) — [userName]"
git -C $HOME/.claude/skills/ai-time-logger push
```

Replace `[userName]` with the value from config.

If push fails, tell the user:
> Push failed — someone may have pushed since your pull. Run:
> ```bash
> git -C ~/.claude/skills/ai-time-logger pull --rebase && git -C ~/.claude/skills/ai-time-logger push
> ```

---

## Step 7 — Confirm

Parse the JSON output from Step 5c and report to the user:

> Logged **[sessionsLogged] sessions** — **[totalAiTime] total AI time** today.
>
> - Daily log: `[dailyPath]`
> - Consolidated log pushed to Git ✓

If `dailyPath` is null (not configured), omit that line.

---

## Notes

- Sessions are today's only. To log a different day: ask the user and add `--date YYYY-MM-DD` to both commands.
- The `nonAiTime` field is the user's honest estimate — accept any format they give (e.g. "2 hours", "half a day", "30m").
- Never skip a session. If the user can't remember a task, prompt them with the first prompt as a hint.
- Never write to the files yourself — always use the script. This ensures the format stays consistent for all team members.
