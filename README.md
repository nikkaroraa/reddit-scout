# RedditScout 🔍

Open-source Reddit monitoring tool for indie hackers. Find pain points, track competitors, analyze sentiment, and discover opportunities.

**No API keys needed** — uses Reddit's public `.json` endpoints.

## Features

- 🎯 **Pain Point Detection** — Find posts where people need help (your next customer)
- 😊 **Sentiment Analysis** — Understand if mentions are positive, negative, or neutral
- 📊 **Competitor Tracking** — Monitor what people say about specific products
- 📰 **Daily Digest** — Summarize activity across all monitored subreddits
- 🔔 **Keyword Alerts** — Get notified when someone mentions your niche
- 📈 **Category Analysis** — Group pain points by type (pricing, features, frustration)
- 📥 **CSV Export** — Export matches for spreadsheets and analysis
- 🖥️ **Web Dashboard** — Visual interface to scan and explore results

## Install

```bash
git clone https://github.com/nickaroradev/reddit-scout.git
cd reddit-scout
npm install  # or just run directly, no deps needed
```

## Quick Start

### Scan for pain points with sentiment analysis
```bash
node scripts/scout.js pain SaaS

# Output includes sentiment:
# {
#   "title": "Frustrated with current CRM...",
#   "sentiment": { "label": "negative", "compound": -0.67 },
#   "categories": { "frustration": ["frustrated with"], "alternatives": ["looking for"] }
# }
```

### Multi-subreddit scan with CSV export
```bash
node scripts/scout.js multi "SaaS,startups,indiehackers" --pain --csv matches.csv
```

### Track competitor mentions
```bash
node scripts/scout.js competitors "notion,slack,linear" "SaaS,startups,productivity"

# Shows sentiment breakdown per competitor:
# {
#   "sentimentByCompetitor": {
#     "notion": { "total": 12, "positive": 5, "negative": 3, "neutral": 4 }
#   }
# }
```

### Generate daily digest
```bash
node scripts/scout.js digest "SaaS,startups,indiehackers" --hours 24
```

### Use the web dashboard
```bash
# Open dashboard.html in your browser
open dashboard.html

# Or serve it:
npx serve .
```

## Commands

### Scout (scan & analyze)

```bash
# Basic scan
node scripts/scout.js scan <subreddit> [--limit 25] [--sort hot|new|top]

# Search for keywords
node scripts/scout.js search <subreddit> --keywords "hiring,looking for"

# Find pain points with sentiment
node scripts/scout.js pain <subreddit>

# Get full thread with comments
node scripts/scout.js thread <reddit-url>

# Multi-subreddit scan
node scripts/scout.js multi "sub1,sub2,sub3" --pain

# Track competitors
node scripts/scout.js competitors "product1,product2" "sub1,sub2"

# Daily digest
node scripts/scout.js digest "sub1,sub2,sub3" --hours 24

# Export to CSV
node scripts/scout.js pain SaaS --csv output.csv
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
```

### Notify (for automation)

```bash
# Check alerts (default)
node scripts/notify.js

# Generate daily digest
node scripts/notify.js digest

# Check competitor mentions
node scripts/notify.js competitors
```

## Pain Signal Categories

The tool categorizes pain points into:

| Category | Example Signals |
|----------|-----------------|
| **helpSeeking** | "need help", "how do i", "anyone know", "stuck on" |
| **frustration** | "frustrated with", "hate when", "wish there was", "nightmare" |
| **alternatives** | "alternative to", "better than", "switching from", "replacement" |
| **pricing** | "too expensive", "cheaper alternative", "price hike", "overpriced" |
| **featureRequests** | "wish it had", "feature request", "missing feature" |
| **comparison** | "vs", "which is better", "deciding between", "pros and cons" |
| **hiring** | "looking to hire", "need a developer", "paid gig" |

## Sentiment Analysis

Each post is analyzed for sentiment:

- **Positive** 😊 — compound score ≥ 0.2
- **Neutral** 😐 — compound score between -0.2 and 0.2
- **Negative** 😤 — compound score ≤ -0.2

The analyzer uses a lexicon-based approach, checking for positive words (love, amazing, great) and negative words (hate, frustrated, broken).

Example output:
```json
{
  "sentiment": {
    "label": "negative",
    "compound": -0.45,
    "positive": 1,
    "negative": 3
  }
}
```

## Web Dashboard

Open `dashboard.html` in your browser for a visual interface:

![Dashboard Screenshot](https://via.placeholder.com/800x400?text=RedditScout+Dashboard)

Features:
- Scan multiple subreddits at once
- View pain points with sentiment highlighting
- Track competitor mentions
- See category breakdown
- Export to CSV

## CSV Export

Export matches for spreadsheet analysis:

```bash
# Export pain points
node scripts/scout.js pain SaaS --csv pain-points.csv

# Export competitor mentions
node scripts/scout.js competitors "notion,slack" "SaaS" --csv competitors.csv
```

Output columns:
- id, subreddit, title, author, score, numComments
- created, url, sentiment, signals, categories

## Competitor Tracking

Monitor what people say about specific products:

```bash
# Set up tracking in data/competitors.json
{
  "competitors": ["notion", "slack", "linear", "asana"],
  "subreddits": ["SaaS", "startups", "productivity", "Entrepreneur"]
}

# Run competitor check
node scripts/notify.js competitors
```

Results include:
- Mentions grouped by competitor
- Sentiment breakdown (positive/negative/neutral)
- Context snippets around mentions

## Daily Digest

Get a summary of the last 24 hours:

```bash
node scripts/scout.js digest "SaaS,startups,indiehackers"
```

Includes:
- Total posts scanned
- Sentiment overview
- Category breakdown
- Top posts by engagement
- Top pain points

## Automation

### Cron job (check every 30 min)
```bash
*/30 * * * * cd /path/to/reddit-scout && node scripts/notify.js >> /tmp/reddit-scout.log
```

### Daily digest (9 AM)
```bash
0 9 * * * cd /path/to/reddit-scout && node scripts/notify.js digest >> /tmp/reddit-digest.log
```

### With OpenClaw
Add a cron job that runs `notify.js` and sends matches to Telegram.

## Use Cases

### 🎯 Lead Generation
Monitor r/forhire, r/startups for people looking for developers/designers.
```bash
node scripts/scout.js pain forhire --limit 50
```

### 📝 Content Ideas
Scan for trending topics and common questions.
```bash
node scripts/scout.js digest "SaaS,Entrepreneur,startups" --hours 48
```

### 🔍 Competitor Research
Track what people say about competitors, find their weaknesses.
```bash
node scripts/scout.js competitors "competitor1,competitor2" "SaaS,startups"
```

### 💰 Pricing Intelligence
Find complaints about competitor pricing.
```bash
node scripts/scout.js search SaaS --keywords "too expensive,overpriced,cheaper"
```

### 🚀 Launch Feedback
Find threads asking for product recommendations in your niche.
```bash
node scripts/scout.js search SaaS --keywords "recommend,alternative to,looking for"
```

## How It Works

Reddit exposes JSON endpoints for any page:
```
reddit.com/r/SaaS/.json → subreddit posts
reddit.com/r/SaaS/comments/xyz/.json → full thread + comments
```

No authentication needed. Rate limit ~60 requests/minute.

## Project Structure

```
reddit-scout/
├── scripts/
│   ├── scout.js      # Main CLI tool
│   ├── scheduler.js  # Alerts and post scheduling
│   ├── notify.js     # Notification runner
│   └── test.js       # Test suite
├── data/
│   ├── keyword-alerts.json   # Alert configurations
│   ├── competitors.json      # Competitor tracking config
│   ├── seen-matches.json     # Deduplication
│   └── daily-digest.json     # Last digest
├── dashboard.html    # Web dashboard (single file)
├── package.json
├── SKILL.md          # OpenClaw skill definition
└── README.md
```

## Running Tests

```bash
node scripts/test.js

# Output:
# 🧪 RedditScout Test Suite
# ✅ Positive sentiment detection
# ✅ Negative sentiment detection
# ...
# 📊 Results: 25 passed, 0 failed
```

## Limitations

- **No auto-posting** — Reddit blocked new OAuth2 apps
- **Read-only** — Can monitor but not interact
- **Rate limits** — Be nice, don't hammer the API

## License

MIT — do whatever you want with it.

## Credits

Built with [OpenClaw](https://github.com/openclaw/openclaw). 

Found this useful? Star the repo ⭐
