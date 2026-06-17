#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_IDLE_CAP_MINUTES = 15;
const MIN_SESSION_MINUTES = 5;

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  const opts = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return { cmd, opts };
}

function loadHistory(historyPath) {
  const raw = fs.readFileSync(historyPath, 'utf8');
  return raw
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

function localDateString(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localTimeString(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function parseTimeToMinutes(timeStr) {
  let total = 0;
  const hourMatch = timeStr.match(/(\d+)\s*h/);
  const minMatch = timeStr.match(/(\d+)\s*m/);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  return total;
}

function calcActiveMinutes(sortedTimestamps, idleCapMs) {
  if (sortedTimestamps.length <= 1) return MIN_SESSION_MINUTES;
  let totalMs = 0;
  for (let i = 1; i < sortedTimestamps.length; i++) {
    totalMs += Math.min(sortedTimestamps[i] - sortedTimestamps[i - 1], idleCapMs);
  }
  return Math.max(MIN_SESSION_MINUTES, Math.round(totalMs / 60000));
}

function formatDateDisplay(dateStr) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

// ─── sessions ────────────────────────────────────────────────────────────────

function sessionsCmd(opts) {
  const historyPath = opts.history || path.join(os.homedir(), '.claude', 'history.jsonl');
  const targetDate = opts.date || localDateString(Date.now());
  const idleCapMs = (parseInt(opts['idle-cap'] || DEFAULT_IDLE_CAP_MINUTES, 10)) * 60000;

  if (!fs.existsSync(historyPath)) {
    process.stderr.write(`History file not found: ${historyPath}\n`);
    process.exit(1);
  }

  const entries = loadHistory(historyPath);
  const todayEntries = entries.filter(e => e.timestamp && localDateString(e.timestamp) === targetDate);

  const sessions = {};
  for (const e of todayEntries) {
    const sid = e.sessionId;
    if (!sid) continue;
    if (!sessions[sid]) {
      sessions[sid] = { sessionId: sid, project: e.project || '', timestamps: [], prompts: [] };
    }
    sessions[sid].timestamps.push(e.timestamp);
    sessions[sid].prompts.push(typeof e.display === 'string' ? e.display : '');
  }

  const result = Object.values(sessions).map(s => {
    const sorted = [...s.timestamps].sort((a, b) => a - b);
    const activeMinutes = calcActiveMinutes(sorted, idleCapMs);
    const projectName = path.basename(s.project) || 'Unknown';
    const firstPrompt = (s.prompts[0] || '').slice(0, 100);
    return {
      sessionId: s.sessionId,
      project: projectName,
      startTime: localTimeString(sorted[0]),
      promptCount: s.prompts.length,
      activeMinutes,
      aiTime: formatDuration(activeMinutes),
      firstPrompt: firstPrompt + (firstPrompt.length === 100 ? '…' : ''),
    };
  });

  result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

// ─── write ───────────────────────────────────────────────────────────────────

function writeCmd(opts) {
  const configPath = opts.config || path.join(os.homedir(), '.ai-time-logger.json');
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`Config not found: ${configPath}\nCopy config.example.json to ${configPath} and fill in your details.\n`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  let entries;
  if (opts['entries-file']) {
    entries = JSON.parse(fs.readFileSync(opts['entries-file'], 'utf8'));
  } else if (opts.entries) {
    entries = JSON.parse(opts.entries);
  } else {
    process.stderr.write('--entries or --entries-file required\n');
    process.exit(1);
  }

  const date = opts.date || localDateString(Date.now());
  const userName = config.userName || 'Unknown';
  const dailyLogDir = config.dailyLogDir;
  const consolidatedLogPath = config.consolidatedLogPath;

  const tableRows = entries.map(e =>
    `| ${userName} | ${e.task} | ${e.aiTime} | ${e.nonAiTime} | ${date} |`
  );
  const totalMinutes = entries.reduce((sum, e) => sum + parseTimeToMinutes(e.aiTime), 0);
  const totalAiTime = formatDuration(totalMinutes);
  const dateDisplay = formatDateDisplay(date);

  const writtenPaths = {};

  // Daily file
  if (dailyLogDir) {
    fs.mkdirSync(dailyLogDir, { recursive: true });
    const dailyPath = path.join(dailyLogDir, `${date}.md`);
    const lines = [
      `# AI Time Log — ${dateDisplay}`,
      '',
      '| Name | Task | AI Time | Non-AI Time | Date |',
      '|------|------|---------|-------------|------|',
      ...tableRows,
      '',
      `**Total AI Time: ${totalAiTime}**`,
      '',
    ];
    fs.writeFileSync(dailyPath, lines.join('\n'), 'utf8');
    writtenPaths.dailyPath = dailyPath;
  }

  // Consolidated file
  if (consolidatedLogPath) {
    const consolidatedDir = path.dirname(consolidatedLogPath);
    if (!fs.existsSync(consolidatedDir)) {
      fs.mkdirSync(consolidatedDir, { recursive: true });
    }
    if (!fs.existsSync(consolidatedLogPath)) {
      const header = [
        '# AI Time Log — Consolidated',
        '',
        '| Name | Task | AI Time | Non-AI Time | Date |',
        '|------|------|---------|-------------|------|',
        '',
      ].join('\n');
      fs.writeFileSync(consolidatedLogPath, header, 'utf8');
    }
    const existing = fs.readFileSync(consolidatedLogPath, 'utf8');
    const prefix = existing.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(consolidatedLogPath, prefix + tableRows.join('\n') + '\n', 'utf8');
    writtenPaths.consolidatedPath = consolidatedLogPath;
  }

  process.stdout.write(JSON.stringify({
    success: true,
    sessionsLogged: entries.length,
    totalAiTime,
    ...writtenPaths,
  }) + '\n');
}

// ─── main ────────────────────────────────────────────────────────────────────

const { cmd, opts } = parseArgs(process.argv);
try {
  if (cmd === 'sessions') {
    sessionsCmd(opts);
  } else if (cmd === 'write') {
    writeCmd(opts);
  } else {
    process.stderr.write(
      'Usage:\n' +
      '  ai-time-logger.js sessions [--date YYYY-MM-DD] [--history PATH] [--idle-cap MINUTES]\n' +
      '  ai-time-logger.js write --config PATH (--entries JSON | --entries-file PATH) [--date YYYY-MM-DD]\n'
    );
    process.exit(1);
  }
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
