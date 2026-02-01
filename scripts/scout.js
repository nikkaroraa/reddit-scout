#!/usr/bin/env node

/**
 * RedditScout - Fetch and analyze Reddit for trends and opportunities
 * Usage: node scout.js <command> [args] [options]
 */

const PAIN_SIGNALS = [
  'looking for', 'need help', 'anyone know', 'can someone',
  'frustrated', 'hate when', 'wish there was', 'struggling with',
  'recommend', 'alternative to', 'better than', 'instead of',
  'how do i', 'how can i', 'is there a', 'does anyone',
  'hiring', 'for hire', 'job', 'looking to hire',
  'please help', 'stuck on', 'cant figure out', "can't figure out"
];

const OPPORTUNITY_SIGNALS = [
  'hiring', 'looking to hire', 'need a developer', 'need a designer',
  'looking for freelancer', 'paid gig', 'contract work', 'remote position',
  'will pay', 'budget is', 'paying', 'compensated'
];

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
      url: `https://reddit.com${c.data.permalink}`,
      flair: c.data.link_flair_text || null
    }));
}

function detectPainPoints(posts) {
  return posts.filter(p => {
    const text = `${p.title} ${p.selftext}`.toLowerCase();
    return PAIN_SIGNALS.some(signal => text.includes(signal));
  }).map(p => ({
    ...p,
    signals: PAIN_SIGNALS.filter(s => 
      `${p.title} ${p.selftext}`.toLowerCase().includes(s)
    )
  }));
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
  const { limit = 25, sort = 'hot' } = options;
  const url = `/r/${subreddit}/${sort}/.json?limit=${limit}`;
  
  const data = await fetchReddit(url);
  const posts = extractPosts(data);
  
  return {
    subreddit,
    scannedAt: new Date().toISOString(),
    total: posts.length,
    posts,
    painPoints: detectPainPoints(posts),
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
    )
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
      url: `https://reddit.com${post?.permalink}`
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
      created: new Date(c.created_utc * 1000).toISOString()
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
  
  return {
    scannedAt: new Date().toISOString(),
    subreddits: subs,
    results,
    aggregated: {
      painPoints: allPainPoints.sort((a, b) => b.score - a.score).slice(0, 20),
      opportunities: allOpportunities.sort((a, b) => b.score - a.score).slice(0, 20),
      trending: allTrending.sort((a, b) => b.score - a.score).slice(0, 20)
    }
  };
}

// CLI
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
      result = await scanSubreddit(args[1], { ...options, limit: 100 });
      result = { 
        subreddit: result.subreddit,
        painPoints: result.painPoints,
        count: result.painPoints.length 
      };
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
          opportunities: result.aggregated.opportunities
        };
      }
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

Options:
  --limit <n>     Number of posts (default: 25)
  --sort <type>   hot, new, top (default: hot)
  --pain          Only show pain points and opportunities
  --json          Output raw JSON
      `);
      process.exit(0);
  }
  
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
