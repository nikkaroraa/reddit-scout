# RedditScout 🔍

Fetch, analyze, and monitor Reddit for trends, pain points, and opportunities.

## Scripts

- `scout.js` — Scan subreddits, find pain points, get threads
- `scheduler.js` — Schedule posts + keyword alerts

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

### Search for keywords
```bash
node skills/reddit-scout/scripts/scout.js search <subreddit> --keywords "hiring,looking for,need help"
```

### Find pain points (people asking for help/solutions)
```bash
node skills/reddit-scout/scripts/scout.js pain <subreddit>
```

### Get full thread with comments
```bash
node skills/reddit-scout/scripts/scout.js thread <reddit-url-or-id>
```

### Multi-subreddit scan
```bash
node skills/reddit-scout/scripts/scout.js multi "SaaS,startups,Entrepreneur" --pain
```

---

## Scheduler Commands

### Schedule a post
```bash
node skills/reddit-scout/scripts/scheduler.js post add <subreddit> <title> <content> <ISO-time>
```

### List scheduled posts
```bash
node skills/reddit-scout/scripts/scheduler.js post list [pending|all]
```

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

## Output

Returns JSON with:
- `posts[]` — title, score, comments, url, author, created
- `painPoints[]` — posts where people are asking for help/solutions
- `trending[]` — high engagement posts
- `opportunities[]` — potential leads, job posts, collab requests

## Use Cases

- **Content ideas**: What's trending? What questions keep coming up?
- **Market research**: What are people frustrated with?
- **Lead gen**: Who's looking for help you can provide?
- **Alpha hunting**: Early signals in niche communities
- **Job hunting**: Monitor hiring threads

## Pain Point Signals

The tool looks for posts containing:
- "looking for", "need help", "anyone know"
- "frustrated with", "hate when", "wish there was"
- "recommend", "alternative to", "better than"
- "hiring", "for hire", "job"
