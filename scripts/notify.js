#!/usr/bin/env node

/**
 * Reddit Alert Notifier - Check alerts and output formatted results
 * Designed to be called by OpenClaw cron for Telegram notifications
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'keyword-alerts.json');
const SEEN_FILE = path.join(DATA_DIR, 'seen-matches.json');

function loadJSON(file, defaultVal = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}
  return defaultVal;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function fetchSubreddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/new/.json?limit=25`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RedditScout/1.0' }
  });
  
  if (!res.ok) return [];
  
  const data = await res.json();
  return data?.data?.children || [];
}

async function checkAlerts() {
  const alerts = loadJSON(ALERTS_FILE).filter(a => a.enabled);
  const seen = new Set(loadJSON(SEEN_FILE, []));
  const newMatches = [];
  
  for (const alert of alerts) {
    for (const subreddit of alert.subreddits) {
      try {
        const posts = await fetchSubreddit(subreddit);
        
        for (const post of posts) {
          const p = post.data;
          const postKey = `${p.id}`;
          
          // Skip if we've seen this post
          if (seen.has(postKey)) continue;
          
          const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
          const matchedKeywords = alert.keywords.filter(kw => 
            text.includes(kw.toLowerCase())
          );
          
          if (matchedKeywords.length > 0) {
            newMatches.push({
              subreddit,
              keywords: matchedKeywords,
              title: p.title.slice(0, 100),
              url: `https://reddit.com${p.permalink}`,
              author: p.author,
              score: p.score
            });
            
            // Mark as seen
            seen.add(postKey);
          }
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 300));
        
      } catch (e) {
        // Silently skip errors
      }
    }
  }
  
  // Save seen posts
  saveJSON(SEEN_FILE, [...seen].slice(-1000)); // Keep last 1000
  
  return newMatches;
}

function formatForTelegram(matches) {
  if (matches.length === 0) return null;
  
  let msg = `🔔 **Reddit Alert** — ${matches.length} new match${matches.length > 1 ? 'es' : ''}\n\n`;
  
  for (const m of matches.slice(0, 5)) { // Max 5 per notification
    msg += `**r/${m.subreddit}** [${m.keywords.join(', ')}]\n`;
    msg += `${m.title}\n`;
    msg += `👤 u/${m.author} • ⬆️ ${m.score}\n`;
    msg += `${m.url}\n\n`;
  }
  
  if (matches.length > 5) {
    msg += `... and ${matches.length - 5} more`;
  }
  
  return msg;
}

async function main() {
  const matches = await checkAlerts();
  
  if (matches.length === 0) {
    // No matches, output nothing (cron will just skip)
    console.log(JSON.stringify({ matches: 0 }));
    return;
  }
  
  const formatted = formatForTelegram(matches);
  
  // Output as JSON for the cron job to parse
  console.log(JSON.stringify({
    matches: matches.length,
    message: formatted,
    raw: matches
  }));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
