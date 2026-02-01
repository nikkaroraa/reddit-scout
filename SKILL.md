# RedditScout 🔍

Fetch, analyze, and monitor Reddit for trends, pain points, competitor mentions, and opportunities.

## Scripts

- `scout.js` — Scan subreddits, find pain points, track competitors, export CSV
- `scheduler.js` — Schedule posts + keyword alerts
- `notify.js` — Check alerts and generate digests
- `test.js` — Run test suite

## How It Works

Uses Reddit's `.json` endpoint — no auth needed, full thread data.

```
reddit.com/r/subreddit/.json → structured JSON
reddit.com/r/subreddit/comments/id/.json → full thread + comments
```

---

## Scout Commands

### Scan a subreddit
```bash
node skills/reddit-scout/scripts/scout.js scan <subreddit> [--limit 25] [--sort hot|new|top]
```

### Find pain points with sentiment analysis
```bash
node skills/reddit-scout/scripts/scout.js pain <subreddit>
# Returns posts categorized by: helpSeeking, frustration, pricing, featureRequests, etc.
# Each post includes sentiment: { label: "positive"|"negative"|"neutral", compound: -1 to 1 }
```

### Multi-subreddit scan with CSV export
```bash
node skills/reddit-scout/scripts/scout.js multi "SaaS,startups,Entrepreneur" --pain --csv output.csv
```

### Track competitor mentions
```bash
node skills/reddit-scout/scripts/scout.js competitors "notion,slack,linear" "SaaS,startups"
# Returns mentions grouped by competitor with sentiment breakdown
```

### Generate daily digest
```bash
node skills/reddit-scout/scripts/scout.js digest "SaaS,startups,indiehackers" --hours 24
# Summarizes: total posts, sentiment overview, top posts, category breakdown
```

### Search for keywords
```bash
node skills/reddit-scout/scripts/scout.js search <subreddit> --keywords "hiring,looking for,need help"
```

### Get full thread with comments
```bash
node skills/reddit-scout/scripts/scout.js thread <reddit-url-or-id>
```

### Export to CSV
```bash
node skills/reddit-scout/scripts/scout.js pain SaaS --csv matches.csv
```

---

## Scheduler Commands

### Add keyword alert
```bash
node skills/reddit-scout/scripts/scheduler.js alert add "keyword1,keyword2" "sub1,sub2"
```

### Check all alerts
```bash
node skills/reddit-scout/scripts/scheduler.js alert check
```

### Quick check (due posts + alerts)
```bash
node skills/reddit-scout/scripts/scheduler.js check
```

---

## Notify Commands (for automation)

```bash
# Check alerts + competitors
node skills/reddit-scout/scripts/notify.js

# Generate daily digest
node skills/reddit-scout/scripts/notify.js digest

# Check competitor mentions only
node skills/reddit-scout/scripts/notify.js competitors
```

---

## Pain Signal Categories

| Category | Signals |
|----------|---------|
| helpSeeking | "need help", "how do i", "anyone know" |
| frustration | "frustrated with", "hate when", "wish there was" |
| alternatives | "alternative to", "better than", "switching from" |
| pricing | "too expensive", "cheaper alternative", "price hike" |
| featureRequests | "wish it had", "feature request", "missing feature" |
| comparison | "vs", "which is better", "deciding between" |
| hiring | "looking to hire", "need a developer" |

---

## Output

Returns JSON with:
- `posts[]` — title, score, comments, url, author, created
- `painPoints[]` — posts with signals, categories, and sentiment
- `trending[]` — high engagement posts
- `opportunities[]` — potential leads, job posts
- `sentimentSummary` — positive/negative/neutral counts

## Use Cases

- **Content ideas**: What's trending? What questions keep coming up?
- **Market research**: What are people frustrated with?
- **Lead gen**: Who's looking for help you can provide?
- **Competitor intel**: What do people say about competitors?
- **Pricing research**: Find pricing complaints
- **Feature ideas**: What features are people requesting?

---

## Web Dashboard

Open `dashboard.html` in a browser for a visual interface to scan and explore results.

## Running Tests

```bash
node skills/reddit-scout/scripts/test.js
```
