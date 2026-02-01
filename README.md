# RedditScout 🔍

Open-source Reddit monitoring tool for indie hackers. Find pain points, track keywords, discover opportunities.

**No API keys needed** — uses Reddit's public `.json` endpoints.

## Why?

Reddit killed new OAuth2 app registrations, so auto-posting is dead for most of us. But **monitoring** still works perfectly. This tool helps you:

- 🎯 **Find pain points** — Posts where people need help (your next customer)
- 🔔 **Keyword alerts** — Get notified when someone mentions your niche
- 📊 **Trend analysis** — See what's hot across multiple subreddits
- 💼 **Opportunity detection** — Hiring posts, collab requests, leads

## Install

```bash
git clone https://github.com/nickaroradev/reddit-scout.git
cd reddit-scout
npm install  # or just run directly, no deps needed
```

## Quick Start

### Scan a subreddit for pain points
```bash
node scripts/scout.js pain SaaS
```

### Multi-subreddit scan
```bash
node scripts/scout.js multi "SaaS,startups,indiehackers" --pain
```

### Set up keyword alerts
```bash
node scripts/scheduler.js alert add "looking for,need help,hiring" "SaaS,forhire"
```

### Check alerts
```bash
node scripts/scheduler.js alert check
```

## Commands

### Scout (scan & analyze)

```bash
# Scan subreddit
node scripts/scout.js scan <subreddit> [--limit 25] [--sort hot|new|top]

# Search for keywords
node scripts/scout.js search <subreddit> --keywords "hiring,looking for"

# Find pain points
node scripts/scout.js pain <subreddit>

# Get full thread with comments
node scripts/scout.js thread <reddit-url>

# Multi-subreddit scan
node scripts/scout.js multi "sub1,sub2,sub3" --pain
```

### Scheduler (alerts & posts)

```bash
# Add keyword alert
node scripts/scheduler.js alert add "keyword1,keyword2" "subreddit1,subreddit2"

# List alerts
node scripts/scheduler.js alert list

# Check all alerts for matches
node scripts/scheduler.js alert check

# Schedule a post (for manual posting reminder)
node scripts/scheduler.js post add <subreddit> <title> <content> <ISO-datetime>

# List scheduled posts
node scripts/scheduler.js post list
```

### Notify (for automation)

```bash
# Check alerts and output formatted results (for cron/webhooks)
node scripts/notify.js
```

## Pain Point Signals

The tool looks for posts containing:
- "looking for", "need help", "anyone know"
- "frustrated with", "hate when", "wish there was"
- "recommend", "alternative to", "better than"
- "hiring", "for hire", "job"

## Use Cases

### 🎯 Lead Generation
Monitor r/forhire, r/startups for people looking for developers/designers.

### 📝 Content Ideas
Scan r/SaaS, r/Entrepreneur for trending topics and common questions.

### 🔍 Competitor Research
Track mentions of competitor names, find complaints.

### 💼 Job Hunting
Monitor r/remotejobs, r/cscareerquestions for opportunities.

### 🚀 Launch Feedback
Find threads asking for product recommendations in your niche.

## Automation

### Cron job (check every 30 min)
```bash
*/30 * * * * cd /path/to/reddit-scout && node scripts/notify.js >> /tmp/reddit-scout.log
```

### With OpenClaw/Clawdbot
Add a cron job that runs `notify.js` and sends matches to Telegram.

## How It Works

Reddit exposes JSON endpoints for any page:
```
reddit.com/r/SaaS/.json → subreddit posts
reddit.com/r/SaaS/comments/xyz/.json → full thread + comments
```

No authentication needed. Rate limit ~60 requests/minute.

## Limitations

- **No auto-posting** — Reddit blocked new OAuth2 apps
- **Read-only** — Can monitor but not interact
- **Rate limits** — Be nice, don't hammer the API

## License

MIT — do whatever you want with it.

## Credits

Built with [OpenClaw](https://github.com/openclaw/openclaw). 

Found this useful? Star the repo ⭐
