#!/usr/bin/env node

/**
 * RedditScout - Fetch and analyze Reddit for trends and opportunities
 * Usage: node scout.js <command> [args] [options]
 */

const fs = require('fs');
const path = require('path');

// ============ PAIN SIGNALS (Expanded) ============

const PAIN_SIGNALS = {
  helpSeeking: [
    'looking for', 'need help', 'anyone know', 'can someone',
    'how do i', 'how can i', 'is there a', 'does anyone',
    'please help', 'stuck on', 'cant figure out', "can't figure out",
    'any advice', 'suggestions for', 'tips for', 'help me'
  ],
  frustration: [
    'frustrated', 'hate when', 'wish there was', 'struggling with',
    'annoyed by', 'sick of', 'tired of', 'fed up with',
    'drives me crazy', 'pain point', 'nightmare', 'worst part'
  ],
  alternatives: [
    'recommend', 'alternative to', 'better than', 'instead of',
    'switching from', 'moved away from', 'replacement for', 'similar to',
    'like X but', 'comparable to', 'competitor to'
  ],
  hiring: [
    'hiring', 'for hire', 'job', 'looking to hire',
    'need a developer', 'need a designer', 'looking for freelancer',
    'contract work', 'remote position', 'open position'
  ],
  // NEW: Pricing complaints
  pricing: [
    'too expensive', 'overpriced', 'price increase', 'pricing is',
    'cost too much', 'cheaper alternative', 'free alternative',
    'not worth the price', 'budget friendly', 'affordable option',
    'subscription fatigue', 'price hike', 'raised prices'
  ],
  // NEW: Feature requests
  featureRequests: [
    'wish it had', 'feature request', 'would be nice if',
    'missing feature', 'needs to add', 'should have', 'hope they add',
    'why cant', "why can't", 'feature suggestion', 'roadmap',
    'planned feature', 'coming soon'
  ],
  // NEW: Comparison shopping
  comparison: [
    'vs', 'versus', 'compared to', 'comparison', 'which is better',
    'should i use', 'should i choose', 'or should i', 'deciding between',
    'pros and cons', 'which one', 'differences between'
  ]
};

// Flatten for backwards compatibility
const ALL_PAIN_SIGNALS = Object.values(PAIN_SIGNALS).flat();

const OPPORTUNITY_SIGNALS = [
  'hiring', 'looking to hire', 'need a developer', 'need a designer',
  'looking for freelancer', 'paid gig', 'contract work', 'remote position',
  'will pay', 'budget is', 'paying', 'compensated',
  'looking for a tool', 'need a solution', 'open to suggestions'
];

// ============ SENTIMENT ANALYSIS ============

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

const NEGATION_WORDS = ['not', "don't", "doesn't", "didn't", "won't", "can't", "never", "no"];

function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  // Check for positive words
  for (const word of POSITIVE_WORDS) {
    const regex = new RegExp(`\\b${word}`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) positiveScore += matches.length;
  }
  
  // Check for negative words
  for (const word of NEGATIVE_WORDS) {
    const regex = new RegExp(`\\b${word}`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) negativeScore += matches.length;
  }
  
  // Check for negations that might flip sentiment
  for (let i = 0; i < words.length - 1; i++) {
    if (NEGATION_WORDS.includes(words[i])) {
      // Check if next word is positive (negation flips it)
      if (POSITIVE_WORDS.some(pw => words[i + 1].includes(pw))) {
        positiveScore--;
        negativeScore++;
      }
      // Check if next word is negative (negation flips it)
      if (NEGATIVE_WORDS.some(nw => words[i + 1].includes(nw))) {
        negativeScore--;
        positiveScore++;
      }
    }
  }
  
  // Calculate compound score (-1 to 1)
  const total = positiveScore + negativeScore;
  let compound = 0;
  if (total > 0) {
    compound = (positiveScore - negativeScore) / total;
  }
  
  // Determine label
  let label;
  if (compound >= 0.2) label = 'positive';
  else if (compound <= -0.2) label = 'negative';
  else label = 'neutral';
  
  return {
    label,
    compound: Math.round(compound * 100) / 100,
    positive: positiveScore,
    negative: negativeScore
  };
}

// ============ CORE FUNCTIONS ============

async function fetchReddit(url) {
  const jsonUrl = url.endsWith('.json') ? url : `${url}.json`;
  const fullUrl = jsonUrl.startsWith('http') ? jsonUrl : `https://www.reddit.com${jsonUrl}`;
  
  const res = await fetch(fullUrl, {
    headers: { 'User-Agent': 'RedditScout/1.0' }
  });
  
  if (!res.ok) throw new Error(`Reddit API error: ${res.status}`);
  return res.json();
}

function extractPosts(data) {
  if (!data?.data?.children) return [];
  
  return data.data.children
    .filter(c => c.kind === 't3')
    .map(c => ({
      id: c.data.id,
      title: c.data.title,
      selftext: c.data.selftext?.slice(0, 500) || '',
      score: c.data.score,
      numComments: c.data.num_comments,
      author: c.data.author,
      created: new Date(c.data.created_utc * 1000).toISOString(),
      createdUtc: c.data.created_utc,
      url: `https://reddit.com${c.data.permalink}`,
      flair: c.data.link_flair_text || null
    }));
}

function detectPainPoints(posts, includeSentiment = true) {
  return posts.filter(p => {
    const text = `${p.title} ${p.selftext}`.toLowerCase();
    return ALL_PAIN_SIGNALS.some(signal => text.includes(signal));
  }).map(p => {
    const text = `${p.title} ${p.selftext}`;
    const lowerText = text.toLowerCase();
    
    // Find which categories match
    const categories = {};
    for (const [category, signals] of Object.entries(PAIN_SIGNALS)) {
      const matched = signals.filter(s => lowerText.includes(s));
      if (matched.length > 0) {
        categories[category] = matched;
      }
    }
    
    const result = {
      ...p,
      signals: ALL_PAIN_SIGNALS.filter(s => lowerText.includes(s)),
      categories
    };
    
    if (includeSentiment) {
      result.sentiment = analyzeSentiment(text);
    }
    
    return result;
  });
}

function detectOpportunities(posts) {
  return posts.filter(p => {
    const text = `${p.title} ${p.selftext}`.toLowerCase();
    return OPPORTUNITY_SIGNALS.some(signal => text.includes(signal));
  }).map(p => ({
    ...p,
    signals: OPPORTUNITY_SIGNALS.filter(s => 
      `${p.title} ${p.selftext}`.toLowerCase().includes(s)
    )
  }));
}

function findTrending(posts, threshold = 50) {
  return posts
    .filter(p => p.score >= threshold || p.numComments >= 20)
    .sort((a, b) => b.score - a.score);
}

async function scanSubreddit(subreddit, options = {}) {
  const { limit = 25, sort = 'hot', includeSentiment = true } = options;
  const url = `/r/${subreddit}/${sort}/.json?limit=${limit}`;
  
  const data = await fetchReddit(url);
  const posts = extractPosts(data);
  
  return {
    subreddit,
    scannedAt: new Date().toISOString(),
    total: posts.length,
    posts,
    painPoints: detectPainPoints(posts, includeSentiment),
    opportunities: detectOpportunities(posts),
    trending: findTrending(posts)
  };
}

async function searchSubreddit(subreddit, keywords, options = {}) {
  const { limit = 50 } = options;
  const keywordList = keywords.split(',').map(k => k.trim().toLowerCase());
  
  const result = await scanSubreddit(subreddit, { limit, ...options });
  
  const matches = result.posts.filter(p => {
    const text = `${p.title} ${p.selftext}`.toLowerCase();
    return keywordList.some(kw => text.includes(kw));
  }).map(p => ({
    ...p,
    matchedKeywords: keywordList.filter(kw => 
      `${p.title} ${p.selftext}`.toLowerCase().includes(kw)
    ),
    sentiment: analyzeSentiment(`${p.title} ${p.selftext}`)
  }));
  
  return {
    ...result,
    keywords: keywordList,
    matches
  };
}

async function getThread(urlOrId) {
  let url = urlOrId;
  if (!url.startsWith('http')) {
    url = `https://www.reddit.com/comments/${urlOrId}`;
  }
  url = url.replace('https://reddit.com', 'https://www.reddit.com');
  
  const data = await fetchReddit(url);
  
  // data[0] is the post, data[1] is comments
  const post = data[0]?.data?.children?.[0]?.data;
  const comments = extractComments(data[1]?.data?.children || []);
  
  return {
    post: {
      id: post?.id,
      title: post?.title,
      selftext: post?.selftext,
      score: post?.score,
      author: post?.author,
      created: new Date(post?.created_utc * 1000).toISOString(),
      url: `https://reddit.com${post?.permalink}`,
      sentiment: analyzeSentiment(`${post?.title} ${post?.selftext || ''}`)
    },
    comments,
    commentCount: comments.length
  };
}

function extractComments(children, depth = 0) {
  const comments = [];
  
  for (const child of children) {
    if (child.kind !== 't1') continue;
    
    const c = child.data;
    comments.push({
      id: c.id,
      author: c.author,
      body: c.body?.slice(0, 1000),
      score: c.score,
      depth,
      created: new Date(c.created_utc * 1000).toISOString(),
      sentiment: analyzeSentiment(c.body || '')
    });
    
    // Recurse into replies
    if (c.replies?.data?.children) {
      comments.push(...extractComments(c.replies.data.children, depth + 1));
    }
  }
  
  return comments;
}

async function multiScan(subreddits, options = {}) {
  const subs = subreddits.split(',').map(s => s.trim());
  const results = [];
  
  for (const sub of subs) {
    try {
      const result = await scanSubreddit(sub, options);
      results.push(result);
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      results.push({ subreddit: sub, error: e.message });
    }
  }
  
  // Aggregate
  const allPainPoints = results.flatMap(r => 
    (r.painPoints || []).map(p => ({ ...p, subreddit: r.subreddit }))
  );
  const allOpportunities = results.flatMap(r => 
    (r.opportunities || []).map(p => ({ ...p, subreddit: r.subreddit }))
  );
  const allTrending = results.flatMap(r => 
    (r.trending || []).map(p => ({ ...p, subreddit: r.subreddit }))
  );
  
  // Sentiment summary
  const sentimentSummary = {
    positive: allPainPoints.filter(p => p.sentiment?.label === 'positive').length,
    negative: allPainPoints.filter(p => p.sentiment?.label === 'negative').length,
    neutral: allPainPoints.filter(p => p.sentiment?.label === 'neutral').length
  };
  
  return {
    scannedAt: new Date().toISOString(),
    subreddits: subs,
    results,
    aggregated: {
      painPoints: allPainPoints.sort((a, b) => b.score - a.score).slice(0, 20),
      opportunities: allOpportunities.sort((a, b) => b.score - a.score).slice(0, 20),
      trending: allTrending.sort((a, b) => b.score - a.score).slice(0, 20),
      sentimentSummary
    }
  };
}

// ============ COMPETITOR TRACKING ============

async function trackCompetitors(competitors, subreddits, options = {}) {
  const competitorList = competitors.split(',').map(c => c.trim().toLowerCase());
  const subs = subreddits.split(',').map(s => s.trim());
  const { limit = 100 } = options;
  
  const mentions = [];
  
  for (const sub of subs) {
    try {
      const url = `/r/${sub}/new/.json?limit=${limit}`;
      const data = await fetchReddit(url);
      const posts = extractPosts(data);
      
      for (const post of posts) {
        const text = `${post.title} ${post.selftext}`.toLowerCase();
        const matchedCompetitors = competitorList.filter(c => text.includes(c));
        
        if (matchedCompetitors.length > 0) {
          mentions.push({
            ...post,
            subreddit: sub,
            competitors: matchedCompetitors,
            sentiment: analyzeSentiment(`${post.title} ${post.selftext}`),
            context: extractCompetitorContext(text, matchedCompetitors)
          });
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      // Skip errors
    }
  }
  
  // Group by competitor
  const byCompetitor = {};
  for (const comp of competitorList) {
    byCompetitor[comp] = mentions.filter(m => m.competitors.includes(comp));
  }
  
  // Sentiment breakdown
  const sentimentByCompetitor = {};
  for (const [comp, posts] of Object.entries(byCompetitor)) {
    sentimentByCompetitor[comp] = {
      total: posts.length,
      positive: posts.filter(p => p.sentiment?.label === 'positive').length,
      negative: posts.filter(p => p.sentiment?.label === 'negative').length,
      neutral: posts.filter(p => p.sentiment?.label === 'neutral').length
    };
  }
  
  return {
    scannedAt: new Date().toISOString(),
    competitors: competitorList,
    subreddits: subs,
    totalMentions: mentions.length,
    mentions: mentions.sort((a, b) => b.score - a.score),
    byCompetitor,
    sentimentByCompetitor
  };
}

function extractCompetitorContext(text, competitors) {
  // Extract ~50 chars around each competitor mention
  const contexts = [];
  for (const comp of competitors) {
    const idx = text.indexOf(comp);
    if (idx !== -1) {
      const start = Math.max(0, idx - 30);
      const end = Math.min(text.length, idx + comp.length + 30);
      contexts.push('...' + text.slice(start, end) + '...');
    }
  }
  return contexts;
}

// ============ DAILY DIGEST ============

async function generateDailyDigest(subreddits, options = {}) {
  const subs = subreddits.split(',').map(s => s.trim());
  const { hours = 24, limit = 100 } = options;
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  
  const allPosts = [];
  const allPainPoints = [];
  const allOpportunities = [];
  
  for (const sub of subs) {
    try {
      const url = `/r/${sub}/new/.json?limit=${limit}`;
      const data = await fetchReddit(url);
      const posts = extractPosts(data);
      
      // Filter to last 24h
      const recentPosts = posts.filter(p => p.createdUtc * 1000 >= cutoff);
      
      allPosts.push(...recentPosts.map(p => ({ ...p, subreddit: sub })));
      
      const painPoints = detectPainPoints(recentPosts);
      allPainPoints.push(...painPoints.map(p => ({ ...p, subreddit: sub })));
      
      const opportunities = detectOpportunities(recentPosts);
      allOpportunities.push(...opportunities.map(p => ({ ...p, subreddit: sub })));
      
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      // Skip errors
    }
  }
  
  // Top posts by engagement
  const topPosts = allPosts
    .sort((a, b) => (b.score + b.numComments * 2) - (a.score + a.numComments * 2))
    .slice(0, 10);
  
  // Category breakdown
  const categoryBreakdown = {};
  for (const pp of allPainPoints) {
    for (const cat of Object.keys(pp.categories || {})) {
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }
  }
  
  // Sentiment overview
  const sentimentOverview = {
    positive: allPainPoints.filter(p => p.sentiment?.label === 'positive').length,
    negative: allPainPoints.filter(p => p.sentiment?.label === 'negative').length,
    neutral: allPainPoints.filter(p => p.sentiment?.label === 'neutral').length
  };
  
  // Subreddit stats
  const subredditStats = {};
  for (const sub of subs) {
    const subPosts = allPosts.filter(p => p.subreddit === sub);
    subredditStats[sub] = {
      posts: subPosts.length,
      totalScore: subPosts.reduce((sum, p) => sum + p.score, 0),
      avgScore: Math.round(subPosts.reduce((sum, p) => sum + p.score, 0) / (subPosts.length || 1)),
      painPoints: allPainPoints.filter(p => p.subreddit === sub).length,
      opportunities: allOpportunities.filter(p => p.subreddit === sub).length
    };
  }
  
  const digest = {
    generatedAt: new Date().toISOString(),
    period: `Last ${hours} hours`,
    subreddits: subs,
    summary: {
      totalPosts: allPosts.length,
      totalPainPoints: allPainPoints.length,
      totalOpportunities: allOpportunities.length,
      sentimentOverview,
      categoryBreakdown
    },
    subredditStats,
    highlights: {
      topPosts,
      topPainPoints: allPainPoints.sort((a, b) => b.score - a.score).slice(0, 10),
      topOpportunities: allOpportunities.sort((a, b) => b.score - a.score).slice(0, 5)
    }
  };
  
  return digest;
}

// ============ CSV EXPORT ============

function toCSV(data, fields) {
  if (!Array.isArray(data) || data.length === 0) return '';
  
  const headers = fields || Object.keys(data[0]);
  const rows = [headers.join(',')];
  
  for (const item of data) {
    const row = headers.map(h => {
      let val = item[h];
      if (val === null || val === undefined) val = '';
      if (typeof val === 'object') val = JSON.stringify(val);
      // Escape quotes and wrap in quotes if contains comma or quote
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val}"`;
      }
      return val;
    });
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}

function exportMatchesToCSV(matches, outputPath) {
  const fields = [
    'id', 'subreddit', 'title', 'author', 'score', 'numComments',
    'created', 'url', 'sentiment', 'signals', 'categories'
  ];
  
  const flatMatches = matches.map(m => ({
    ...m,
    sentiment: m.sentiment?.label || '',
    signals: (m.signals || []).join('; '),
    categories: Object.keys(m.categories || {}).join('; ')
  }));
  
  const csv = toCSV(flatMatches, fields);
  
  if (outputPath) {
    fs.writeFileSync(outputPath, csv);
    return { exported: matches.length, path: outputPath };
  }
  
  return csv;
}

// ============ CLI ============

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse options
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') options.limit = parseInt(args[++i]);
    if (args[i] === '--sort') options.sort = args[++i];
    if (args[i] === '--keywords') options.keywords = args[++i];
    if (args[i] === '--pain') options.painOnly = true;
    if (args[i] === '--json') options.json = true;
    if (args[i] === '--csv') options.csv = args[++i];
    if (args[i] === '--competitors') options.competitors = args[++i];
    if (args[i] === '--hours') options.hours = parseInt(args[++i]);
    if (args[i] === '--no-sentiment') options.includeSentiment = false;
  }
  
  let result;
  
  switch (command) {
    case 'scan':
      result = await scanSubreddit(args[1], options);
      break;
      
    case 'search':
      result = await searchSubreddit(args[1], options.keywords || args[2], options);
      break;
      
    case 'pain':
      result = await scanSubreddit(args[1], { ...options, limit: options.limit || 100 });
      result = { 
        subreddit: result.subreddit,
        painPoints: result.painPoints,
        count: result.painPoints.length,
        sentimentSummary: {
          positive: result.painPoints.filter(p => p.sentiment?.label === 'positive').length,
          negative: result.painPoints.filter(p => p.sentiment?.label === 'negative').length,
          neutral: result.painPoints.filter(p => p.sentiment?.label === 'neutral').length
        }
      };
      
      // Export to CSV if requested
      if (options.csv) {
        const csvResult = exportMatchesToCSV(result.painPoints, options.csv);
        result.csvExport = csvResult;
      }
      break;
      
    case 'thread':
      result = await getThread(args[1]);
      break;
      
    case 'multi':
      result = await multiScan(args[1], options);
      if (options.painOnly) {
        result = {
          scannedAt: result.scannedAt,
          subreddits: result.subreddits,
          painPoints: result.aggregated.painPoints,
          opportunities: result.aggregated.opportunities,
          sentimentSummary: result.aggregated.sentimentSummary
        };
      }
      
      // Export to CSV if requested
      if (options.csv && result.aggregated?.painPoints) {
        const csvResult = exportMatchesToCSV(result.aggregated.painPoints, options.csv);
        result.csvExport = csvResult;
      } else if (options.csv && result.painPoints) {
        const csvResult = exportMatchesToCSV(result.painPoints, options.csv);
        result.csvExport = csvResult;
      }
      break;
      
    case 'competitors':
      // node scout.js competitors "slack,discord,teams" "SaaS,startups"
      result = await trackCompetitors(args[1], args[2], options);
      
      if (options.csv) {
        const csvResult = exportMatchesToCSV(result.mentions, options.csv);
        result.csvExport = csvResult;
      }
      break;
      
    case 'digest':
      // node scout.js digest "SaaS,startups,indiehackers" --hours 24
      result = await generateDailyDigest(args[1], options);
      break;
      
    case 'export':
      // Export previous scan results to CSV
      // node scout.js export <json-file> <csv-output>
      const jsonData = JSON.parse(fs.readFileSync(args[1], 'utf8'));
      const dataToExport = jsonData.painPoints || jsonData.matches || jsonData.mentions || [];
      result = exportMatchesToCSV(dataToExport, args[2]);
      break;
      
    default:
      console.log(`
RedditScout - Monitor Reddit for opportunities

Commands:
  scan <subreddit>              Scan subreddit for posts
  search <subreddit> --keywords "word1,word2"   Search for keywords
  pain <subreddit>              Find pain points / help requests  
  thread <url-or-id>            Get full thread with comments
  multi "sub1,sub2,sub3"        Scan multiple subreddits
  competitors "comp1,comp2" "sub1,sub2"   Track competitor mentions
  digest "sub1,sub2,sub3"       Generate daily digest (last 24h summary)
  export <json-file> <csv-out>  Export JSON results to CSV

Options:
  --limit <n>         Number of posts (default: 25)
  --sort <type>       hot, new, top (default: hot)
  --pain              Only show pain points and opportunities
  --json              Output raw JSON
  --csv <file>        Export results to CSV file
  --hours <n>         For digest: hours to look back (default: 24)
  --no-sentiment      Skip sentiment analysis

Pain Signal Categories:
  - helpSeeking: "need help", "how do i", "anyone know"
  - frustration: "frustrated with", "hate when", "wish there was"
  - alternatives: "alternative to", "better than", "switching from"
  - pricing: "too expensive", "cheaper alternative", "price hike"
  - featureRequests: "wish it had", "feature request", "missing feature"
  - comparison: "vs", "which is better", "deciding between"
  - hiring: "looking to hire", "need a developer"
      `);
      process.exit(0);
  }
  
  console.log(JSON.stringify(result, null, 2));
}

// Only run CLI if called directly
if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

// Export for testing
module.exports = {
  analyzeSentiment,
  detectPainPoints,
  detectOpportunities,
  findTrending,
  extractPosts,
  toCSV,
  PAIN_SIGNALS,
  POSITIVE_WORDS,
  NEGATIVE_WORDS
};
