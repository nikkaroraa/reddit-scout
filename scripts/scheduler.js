#!/usr/bin/env node

/**
 * Reddit Scheduler - Schedule posts and track keyword alerts
 * Usage: node scheduler.js <command> [args]
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'scheduled-posts.json');
const ALERTS_FILE = path.join(DATA_DIR, 'keyword-alerts.json');
const HISTORY_FILE = path.join(DATA_DIR, 'post-history.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============ SCHEDULED POSTS ============

function addScheduledPost(subreddit, title, content, scheduledTime, options = {}) {
  const posts = loadJSON(SCHEDULE_FILE);
  
  const post = {
    id: generateId(),
    subreddit,
    title,
    content,
    scheduledTime: new Date(scheduledTime).toISOString(),
    createdAt: new Date().toISOString(),
    status: 'pending', // pending, posted, failed, cancelled
    flair: options.flair || null,
    nsfw: options.nsfw || false,
    spoiler: options.spoiler || false
  };
  
  posts.push(post);
  saveJSON(SCHEDULE_FILE, posts);
  
  return post;
}

function listScheduledPosts(filter = 'pending') {
  const posts = loadJSON(SCHEDULE_FILE);
  
  if (filter === 'all') return posts;
  return posts.filter(p => p.status === filter);
}

function cancelPost(id) {
  const posts = loadJSON(SCHEDULE_FILE);
  const idx = posts.findIndex(p => p.id === id);
  
  if (idx === -1) return null;
  
  posts[idx].status = 'cancelled';
  posts[idx].cancelledAt = new Date().toISOString();
  saveJSON(SCHEDULE_FILE, posts);
  
  return posts[idx];
}

function getDuePosts() {
  const posts = loadJSON(SCHEDULE_FILE);
  const now = new Date();
  
  return posts.filter(p => 
    p.status === 'pending' && 
    new Date(p.scheduledTime) <= now
  );
}

function markPosted(id, redditUrl = null) {
  const posts = loadJSON(SCHEDULE_FILE);
  const idx = posts.findIndex(p => p.id === id);
  
  if (idx === -1) return null;
  
  posts[idx].status = 'posted';
  posts[idx].postedAt = new Date().toISOString();
  if (redditUrl) posts[idx].redditUrl = redditUrl;
  saveJSON(SCHEDULE_FILE, posts);
  
  // Also add to history
  const history = loadJSON(HISTORY_FILE);
  history.push(posts[idx]);
  saveJSON(HISTORY_FILE, history);
  
  return posts[idx];
}

// ============ KEYWORD ALERTS ============

function addKeywordAlert(keywords, subreddits, options = {}) {
  const alerts = loadJSON(ALERTS_FILE);
  
  const alert = {
    id: generateId(),
    keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim()),
    subreddits: Array.isArray(subreddits) ? subreddits : subreddits.split(',').map(s => s.trim()),
    createdAt: new Date().toISOString(),
    enabled: true,
    notifyVia: options.notifyVia || 'console', // console, telegram, webhook
    lastChecked: null,
    matchCount: 0
  };
  
  alerts.push(alert);
  saveJSON(ALERTS_FILE, alerts);
  
  return alert;
}

function listAlerts(enabledOnly = true) {
  const alerts = loadJSON(ALERTS_FILE);
  if (enabledOnly) return alerts.filter(a => a.enabled);
  return alerts;
}

function toggleAlert(id, enabled) {
  const alerts = loadJSON(ALERTS_FILE);
  const idx = alerts.findIndex(a => a.id === id);
  
  if (idx === -1) return null;
  
  alerts[idx].enabled = enabled;
  saveJSON(ALERTS_FILE, alerts);
  
  return alerts[idx];
}

function removeAlert(id) {
  const alerts = loadJSON(ALERTS_FILE);
  const filtered = alerts.filter(a => a.id !== id);
  saveJSON(ALERTS_FILE, filtered);
  return filtered.length < alerts.length;
}

// ============ CHECK ALERTS (uses scout.js) ============

async function checkAlerts() {
  const alerts = loadJSON(ALERTS_FILE);
  const enabledAlerts = alerts.filter(a => a.enabled);
  
  if (enabledAlerts.length === 0) {
    return { checked: 0, matches: [] };
  }
  
  const matches = [];
  
  for (const alert of enabledAlerts) {
    for (const subreddit of alert.subreddits) {
      try {
        // Fetch subreddit
        const url = `https://www.reddit.com/r/${subreddit}/new/.json?limit=25`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'RedditScout/1.0' }
        });
        
        if (!res.ok) continue;
        
        const data = await res.json();
        const posts = data?.data?.children || [];
        
        for (const post of posts) {
          const p = post.data;
          const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
          
          const matchedKeywords = alert.keywords.filter(kw => 
            text.includes(kw.toLowerCase())
          );
          
          if (matchedKeywords.length > 0) {
            // Check if we've seen this post before
            const matchKey = `${alert.id}:${p.id}`;
            
            matches.push({
              alertId: alert.id,
              keywords: matchedKeywords,
              subreddit,
              post: {
                id: p.id,
                title: p.title,
                url: `https://reddit.com${p.permalink}`,
                author: p.author,
                created: new Date(p.created_utc * 1000).toISOString(),
                score: p.score
              }
            });
          }
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, 500));
        
      } catch (e) {
        console.error(`Error checking r/${subreddit}:`, e.message);
      }
    }
    
    // Update last checked
    const idx = alerts.findIndex(a => a.id === alert.id);
    if (idx !== -1) {
      alerts[idx].lastChecked = new Date().toISOString();
      alerts[idx].matchCount += matches.filter(m => m.alertId === alert.id).length;
    }
  }
  
  saveJSON(ALERTS_FILE, alerts);
  
  return {
    checked: enabledAlerts.length,
    matches
  };
}

// ============ CLI ============

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];
  
  let result;
  
  switch (command) {
    case 'post':
      switch (subcommand) {
        case 'add':
          // node scheduler.js post add <subreddit> <title> <content> <time>
          result = addScheduledPost(args[2], args[3], args[4], args[5]);
          break;
        case 'list':
          result = listScheduledPosts(args[2] || 'pending');
          break;
        case 'due':
          result = getDuePosts();
          break;
        case 'cancel':
          result = cancelPost(args[2]);
          break;
        case 'mark-posted':
          result = markPosted(args[2], args[3]);
          break;
        default:
          result = { error: 'Unknown post subcommand. Use: add, list, due, cancel, mark-posted' };
      }
      break;
      
    case 'alert':
      switch (subcommand) {
        case 'add':
          // node scheduler.js alert add <keywords> <subreddits>
          result = addKeywordAlert(args[2], args[3]);
          break;
        case 'list':
          result = listAlerts(args[2] !== 'all');
          break;
        case 'check':
          result = await checkAlerts();
          break;
        case 'enable':
          result = toggleAlert(args[2], true);
          break;
        case 'disable':
          result = toggleAlert(args[2], false);
          break;
        case 'remove':
          result = removeAlert(args[2]);
          break;
        default:
          result = { error: 'Unknown alert subcommand. Use: add, list, check, enable, disable, remove' };
      }
      break;
      
    case 'check':
      // Quick check for due posts and alerts
      const duePosts = getDuePosts();
      const alertResults = await checkAlerts();
      result = {
        duePosts,
        alerts: alertResults
      };
      break;
      
    default:
      console.log(`
Reddit Scheduler - Schedule posts and track keyword alerts

POSTS:
  post add <subreddit> <title> <content> <time>   Schedule a new post
  post list [pending|all]                          List scheduled posts
  post due                                         Get posts ready to publish
  post cancel <id>                                 Cancel a scheduled post
  post mark-posted <id> [reddit-url]               Mark as posted

ALERTS:
  alert add <keywords> <subreddits>                Add keyword alert (comma-separated)
  alert list [all]                                 List active alerts
  alert check                                      Check all alerts now
  alert enable <id>                                Enable an alert
  alert disable <id>                               Disable an alert
  alert remove <id>                                Remove an alert

QUICK CHECK:
  check                                            Check due posts + run alerts

Examples:
  node scheduler.js post add SaaS "My Launch" "Check out my app..." "2026-02-02T10:00:00"
  node scheduler.js alert add "looking for,need help" "SaaS,startups"
  node scheduler.js check
      `);
      process.exit(0);
  }
  
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
