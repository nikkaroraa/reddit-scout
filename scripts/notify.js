#!/usr/bin/env node

/**
 * Reddit Alert Notifier - Check alerts and output formatted results
 * Designed to be called by OpenClaw cron for Telegram notifications
 * 
 * Now includes sentiment analysis and enhanced categorization
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'keyword-alerts.json');
const SEEN_FILE = path.join(DATA_DIR, 'seen-matches.json');
const COMPETITOR_FILE = path.join(DATA_DIR, 'competitors.json');
const DIGEST_FILE = path.join(DATA_DIR, 'daily-digest.json');

// Import sentiment analysis
const POSITIVE_WORDS = [
  'love', 'amazing', 'great', 'awesome', 'excellent', 'fantastic',
  'perfect', 'best', 'wonderful', 'incredible', 'brilliant', 'outstanding',
  'happy', 'satisfied', 'impressed', 'recommend', 'thank', 'thanks',
  'helpful', 'useful', 'solved', 'works great', 'game changer', 'life saver'
];

const NEGATIVE_WORDS = [
  'hate', 'terrible', 'awful', 'horrible', 'worst', 'bad', 'poor',
  'disappointed', 'frustrat', 'annoyed', 'angry', 'useless', 'broken',
  'bug', 'issue', 'problem', 'fail', 'crash', 'slow', 'expensive',
  'scam', 'waste', 'regret', 'avoid', 'sucks', 'ridiculous'
];

function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const word of POSITIVE_WORDS) {
    if (lowerText.includes(word)) positiveScore++;
  }
  
  for (const word of NEGATIVE_WORDS) {
    if (lowerText.includes(word)) negativeScore++;
  }
  
  const total = positiveScore + negativeScore;
  let compound = 0;
  if (total > 0) {
    compound = (positiveScore - negativeScore) / total;
  }
  
  let label;
  if (compound >= 0.2) label = 'positive';
  else if (compound <= -0.2) label = 'negative';
  else label = 'neutral';
  
  return { label, compound: Math.round(compound * 100) / 100 };
}

function getSentimentEmoji(label) {
  switch (label) {
    case 'positive': return '😊';
    case 'negative': return '😤';
    default: return '😐';
  }
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

async function fetchSubreddit(subreddit, limit = 25) {
  const url = `https://www.reddit.com/r/${subreddit}/new/.json?limit=${limit}`;
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
          
          const text = `${p.title} ${p.selftext || ''}`;
          const lowerText = text.toLowerCase();
          const matchedKeywords = alert.keywords.filter(kw => 
            lowerText.includes(kw.toLowerCase())
          );
          
          if (matchedKeywords.length > 0) {
            const sentiment = analyzeSentiment(text);
            
            newMatches.push({
              subreddit,
              keywords: matchedKeywords,
              title: p.title.slice(0, 100),
              url: `https://reddit.com${p.permalink}`,
              author: p.author,
              score: p.score,
              sentiment
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
  
  // Save seen posts (keep last 1000)
  saveJSON(SEEN_FILE, [...seen].slice(-1000));
  
  return newMatches;
}

async function checkCompetitors() {
  const config = loadJSON(COMPETITOR_FILE, { competitors: [], subreddits: [] });
  if (!config.competitors?.length || !config.subreddits?.length) {
    return [];
  }
  
  const seen = new Set(loadJSON(SEEN_FILE, []));
  const mentions = [];
  
  for (const subreddit of config.subreddits) {
    try {
      const posts = await fetchSubreddit(subreddit, 50);
      
      for (const post of posts) {
        const p = post.data;
        const postKey = `comp:${p.id}`;
        
        if (seen.has(postKey)) continue;
        
        const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
        const matchedCompetitors = config.competitors.filter(c => 
          text.includes(c.toLowerCase())
        );
        
        if (matchedCompetitors.length > 0) {
          const sentiment = analyzeSentiment(`${p.title} ${p.selftext || ''}`);
          
          mentions.push({
            subreddit,
            competitors: matchedCompetitors,
            title: p.title.slice(0, 100),
            url: `https://reddit.com${p.permalink}`,
            author: p.author,
            score: p.score,
            sentiment
          });
          
          seen.add(postKey);
        }
      }
      
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      // Skip errors
    }
  }
  
  saveJSON(SEEN_FILE, [...seen].slice(-1000));
  
  return mentions;
}

function formatForTelegram(matches, competitorMentions = []) {
  if (matches.length === 0 && competitorMentions.length === 0) return null;
  
  let msg = '';
  
  if (matches.length > 0) {
    msg += `🔔 **Reddit Alert** — ${matches.length} new match${matches.length > 1 ? 'es' : ''}\n\n`;
    
    for (const m of matches.slice(0, 5)) {
      const emoji = getSentimentEmoji(m.sentiment?.label);
      msg += `**r/${m.subreddit}** [${m.keywords.join(', ')}] ${emoji}\n`;
      msg += `${m.title}\n`;
      msg += `👤 u/${m.author} • ⬆️ ${m.score}\n`;
      msg += `${m.url}\n\n`;
    }
    
    if (matches.length > 5) {
      msg += `... and ${matches.length - 5} more\n\n`;
    }
  }
  
  if (competitorMentions.length > 0) {
    msg += `📊 **Competitor Mentions** — ${competitorMentions.length} new\n\n`;
    
    for (const m of competitorMentions.slice(0, 3)) {
      const emoji = getSentimentEmoji(m.sentiment?.label);
      msg += `**r/${m.subreddit}** [${m.competitors.join(', ')}] ${emoji}\n`;
      msg += `${m.title}\n`;
      msg += `${m.url}\n\n`;
    }
  }
  
  return msg;
}

async function generateDigest() {
  // Load alerts to get subreddits
  const alerts = loadJSON(ALERTS_FILE).filter(a => a.enabled);
  const subreddits = [...new Set(alerts.flatMap(a => a.subreddits))];
  
  if (subreddits.length === 0) {
    return null;
  }
  
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  const allPosts = [];
  
  for (const sub of subreddits) {
    try {
      const posts = await fetchSubreddit(sub, 100);
      
      for (const post of posts) {
        const p = post.data;
        if (p.created_utc * 1000 >= cutoff) {
          allPosts.push({
            subreddit: sub,
            title: p.title,
            url: `https://reddit.com${p.permalink}`,
            author: p.author,
            score: p.score,
            numComments: p.num_comments,
            sentiment: analyzeSentiment(`${p.title} ${p.selftext || ''}`)
          });
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      // Skip errors
    }
  }
  
  // Calculate stats
  const sentiments = allPosts.map(p => p.sentiment?.label);
  const positive = sentiments.filter(s => s === 'positive').length;
  const negative = sentiments.filter(s => s === 'negative').length;
  const neutral = sentiments.filter(s => s === 'neutral').length;
  
  const topPosts = allPosts.sort((a, b) => b.score - a.score).slice(0, 5);
  
  const digest = {
    generatedAt: new Date().toISOString(),
    period: 'Last 24 hours',
    subreddits,
    stats: {
      totalPosts: allPosts.length,
      sentiment: { positive, negative, neutral }
    },
    topPosts
  };
  
  saveJSON(DIGEST_FILE, digest);
  
  return digest;
}

function formatDigestForTelegram(digest) {
  if (!digest) return null;
  
  let msg = `📊 **Daily Reddit Digest**\n`;
  msg += `${digest.period} • ${digest.subreddits.length} subreddits\n\n`;
  
  msg += `📈 **Stats**\n`;
  msg += `• ${digest.stats.totalPosts} posts scanned\n`;
  msg += `• 😊 ${digest.stats.sentiment.positive} positive\n`;
  msg += `• 😤 ${digest.stats.sentiment.negative} negative\n`;
  msg += `• 😐 ${digest.stats.sentiment.neutral} neutral\n\n`;
  
  if (digest.topPosts.length > 0) {
    msg += `🔥 **Top Posts**\n`;
    for (const p of digest.topPosts) {
      const emoji = getSentimentEmoji(p.sentiment?.label);
      msg += `\n${emoji} **r/${p.subreddit}** (⬆️${p.score})\n`;
      msg += `${p.title.slice(0, 80)}${p.title.length > 80 ? '...' : ''}\n`;
      msg += `${p.url}\n`;
    }
  }
  
  return msg;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'digest') {
    const digest = await generateDigest();
    const formatted = formatDigestForTelegram(digest);
    
    console.log(JSON.stringify({
      type: 'digest',
      message: formatted,
      raw: digest
    }));
    return;
  }
  
  if (command === 'competitors') {
    const mentions = await checkCompetitors();
    const formatted = formatForTelegram([], mentions);
    
    console.log(JSON.stringify({
      type: 'competitors',
      matches: mentions.length,
      message: formatted,
      raw: mentions
    }));
    return;
  }
  
  // Default: check alerts + competitors
  const [matches, competitorMentions] = await Promise.all([
    checkAlerts(),
    checkCompetitors()
  ]);
  
  if (matches.length === 0 && competitorMentions.length === 0) {
    console.log(JSON.stringify({ matches: 0, competitors: 0 }));
    return;
  }
  
  const formatted = formatForTelegram(matches, competitorMentions);
  
  console.log(JSON.stringify({
    matches: matches.length,
    competitors: competitorMentions.length,
    message: formatted,
    raw: { matches, competitorMentions }
  }));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
