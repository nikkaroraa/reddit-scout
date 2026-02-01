#!/usr/bin/env node

/**
 * RedditScout Test Suite
 * Run: node scripts/test.js
 */

const {
  analyzeSentiment,
  detectPainPoints,
  detectOpportunities,
  findTrending,
  toCSV,
  PAIN_SIGNALS,
  POSITIVE_WORDS,
  NEGATIVE_WORDS
} = require('./scout.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

console.log('\n🧪 RedditScout Test Suite\n');
console.log('─'.repeat(50));

// ============ SENTIMENT ANALYSIS TESTS ============

console.log('\n📊 Sentiment Analysis\n');

test('Positive sentiment detection', () => {
  const result = analyzeSentiment('I love this product! It is amazing and works great!');
  assertEqual(result.label, 'positive');
  assert(result.compound > 0, 'Compound should be positive');
});

test('Negative sentiment detection', () => {
  const result = analyzeSentiment('This is terrible. I hate it. Worst product ever.');
  assertEqual(result.label, 'negative');
  assert(result.compound < 0, 'Compound should be negative');
});

test('Neutral sentiment detection', () => {
  const result = analyzeSentiment('I bought this product yesterday.');
  assertEqual(result.label, 'neutral');
});

test('Mixed sentiment leans neutral', () => {
  const result = analyzeSentiment('I love the design but hate the price.');
  // Should be relatively neutral since positive and negative balance
  assert(Math.abs(result.compound) <= 0.5, 'Mixed sentiment should be closer to neutral');
});

test('Empty text is neutral', () => {
  const result = analyzeSentiment('');
  assertEqual(result.label, 'neutral');
  assertEqual(result.compound, 0);
});

// ============ PAIN POINT DETECTION TESTS ============

console.log('\n🎯 Pain Point Detection\n');

test('Detects help-seeking signals', () => {
  const posts = [{
    id: '1',
    title: 'Need help with my SaaS startup',
    selftext: 'Anyone know a good solution?',
    score: 10,
    numComments: 5
  }];
  
  const result = detectPainPoints(posts);
  assertEqual(result.length, 1);
  assert(result[0].signals.includes('need help'), 'Should detect "need help"');
  assert(result[0].categories.helpSeeking, 'Should categorize as helpSeeking');
});

test('Detects frustration signals', () => {
  const posts = [{
    id: '2',
    title: 'Frustrated with current tools',
    selftext: 'I hate when things break',
    score: 20,
    numComments: 10
  }];
  
  const result = detectPainPoints(posts);
  assertEqual(result.length, 1);
  assert(result[0].categories.frustration, 'Should categorize as frustration');
});

test('Detects pricing complaints', () => {
  const posts = [{
    id: '3',
    title: 'Tool X is too expensive',
    selftext: 'Looking for a cheaper alternative to this overpriced product',
    score: 15,
    numComments: 8
  }];
  
  const result = detectPainPoints(posts);
  assertEqual(result.length, 1);
  assert(result[0].categories.pricing, 'Should categorize as pricing');
});

test('Detects feature requests', () => {
  const posts = [{
    id: '4',
    title: 'Feature request: wish it had X',
    selftext: 'Missing feature that I need',
    score: 25,
    numComments: 12
  }];
  
  const result = detectPainPoints(posts);
  assertEqual(result.length, 1);
  assert(result[0].categories.featureRequests, 'Should categorize as featureRequests');
});

test('Detects comparison shopping', () => {
  const posts = [{
    id: '5',
    title: 'Product A vs Product B',
    selftext: 'Which is better for startups?',
    score: 30,
    numComments: 15
  }];
  
  const result = detectPainPoints(posts);
  assertEqual(result.length, 1);
  assert(result[0].categories.comparison, 'Should categorize as comparison');
});

test('Includes sentiment in pain points', () => {
  const posts = [{
    id: '6',
    title: 'I hate this broken tool, need help finding alternative',
    selftext: 'Terrible experience',
    score: 10,
    numComments: 5
  }];
  
  const result = detectPainPoints(posts, true);
  assertEqual(result.length, 1);
  assert(result[0].sentiment, 'Should include sentiment');
  assertEqual(result[0].sentiment.label, 'negative');
});

test('No matches for unrelated posts', () => {
  const posts = [{
    id: '7',
    title: 'Just launched my new product',
    selftext: 'Check out what I built',
    score: 50,
    numComments: 20
  }];
  
  const result = detectPainPoints(posts);
  assertEqual(result.length, 0);
});

// ============ OPPORTUNITY DETECTION TESTS ============

console.log('\n💼 Opportunity Detection\n');

test('Detects hiring posts', () => {
  const posts = [{
    id: '8',
    title: 'Looking to hire a developer',
    selftext: 'Remote position, will pay $100/hr',
    score: 20,
    numComments: 10
  }];
  
  const result = detectOpportunities(posts);
  assertEqual(result.length, 1);
  assert(result[0].signals.includes('looking to hire'), 'Should detect hiring signal');
});

test('Detects paid gig posts', () => {
  const posts = [{
    id: '9',
    title: 'Paid gig for designer',
    selftext: 'Budget is $5000',
    score: 15,
    numComments: 8
  }];
  
  const result = detectOpportunities(posts);
  assertEqual(result.length, 1);
});

// ============ TRENDING DETECTION TESTS ============

console.log('\n📈 Trending Detection\n');

test('Finds high-score posts', () => {
  const posts = [
    { id: '10', title: 'Low score', score: 5, numComments: 2 },
    { id: '11', title: 'High score', score: 100, numComments: 10 },
    { id: '12', title: 'Medium score', score: 30, numComments: 5 }
  ];
  
  const result = findTrending(posts, 50);
  assertEqual(result.length, 1);
  assertEqual(result[0].id, '11');
});

test('Finds high-comment posts', () => {
  const posts = [
    { id: '13', title: 'Low comments', score: 10, numComments: 5 },
    { id: '14', title: 'High comments', score: 10, numComments: 50 }
  ];
  
  const result = findTrending(posts, 100);
  assertEqual(result.length, 1);
  assertEqual(result[0].id, '14');
});

test('Sorts by score descending', () => {
  const posts = [
    { id: '15', title: 'Medium', score: 75, numComments: 5 },
    { id: '16', title: 'High', score: 150, numComments: 10 },
    { id: '17', title: 'Low', score: 60, numComments: 3 }
  ];
  
  const result = findTrending(posts, 50);
  assertEqual(result[0].id, '16');
  assertEqual(result[1].id, '15');
  assertEqual(result[2].id, '17');
});

// ============ CSV EXPORT TESTS ============

console.log('\n📥 CSV Export\n');

test('Generates valid CSV', () => {
  const data = [
    { id: '1', title: 'Test', score: 10 },
    { id: '2', title: 'Another', score: 20 }
  ];
  
  const csv = toCSV(data, ['id', 'title', 'score']);
  const lines = csv.split('\n');
  
  assertEqual(lines.length, 3);
  assertEqual(lines[0], 'id,title,score');
});

test('Escapes commas in values', () => {
  const data = [
    { id: '1', title: 'Hello, World', score: 10 }
  ];
  
  const csv = toCSV(data, ['id', 'title', 'score']);
  assert(csv.includes('"Hello, World"'), 'Should wrap value with comma in quotes');
});

test('Escapes quotes in values', () => {
  const data = [
    { id: '1', title: 'He said "hello"', score: 10 }
  ];
  
  const csv = toCSV(data, ['id', 'title', 'score']);
  assert(csv.includes('""hello""'), 'Should escape quotes');
});

test('Handles null/undefined values', () => {
  const data = [
    { id: '1', title: null, score: undefined }
  ];
  
  const csv = toCSV(data, ['id', 'title', 'score']);
  const lines = csv.split('\n');
  assertEqual(lines[1], '1,,');
});

test('Handles empty array', () => {
  const csv = toCSV([], ['id', 'title']);
  assertEqual(csv, '');
});

// ============ PAIN SIGNALS STRUCTURE TESTS ============

console.log('\n📋 Pain Signals Structure\n');

test('PAIN_SIGNALS has all required categories', () => {
  const requiredCategories = [
    'helpSeeking', 'frustration', 'alternatives', 'hiring',
    'pricing', 'featureRequests', 'comparison'
  ];
  
  for (const cat of requiredCategories) {
    assert(PAIN_SIGNALS[cat], `Missing category: ${cat}`);
    assert(Array.isArray(PAIN_SIGNALS[cat]), `Category ${cat} should be an array`);
    assert(PAIN_SIGNALS[cat].length > 0, `Category ${cat} should have signals`);
  }
});

test('Positive words list is populated', () => {
  assert(POSITIVE_WORDS.length > 10, 'Should have enough positive words');
});

test('Negative words list is populated', () => {
  assert(NEGATIVE_WORDS.length > 10, 'Should have enough negative words');
});

// ============ RESULTS ============

console.log('\n' + '─'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
