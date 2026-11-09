// Hybrid Search (BM25 + Vector) evaluation using Reciprocal Rank Fusion.
// Run with: node hybrid-eval.js
const fs = require('fs');
const path = require('path');

function loadTestSet(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  return lines.slice(1).filter(Boolean).map((line) => {
    const [query, ids] = line.split(',');
    return { query, correctIds: ids.split(';').map(Number) };
  });
}
const testSet = loadTestSet(path.join(__dirname, 'test-set.csv'));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'search-results.json'), 'utf8'));

function rrfFuse(keywordIds, semanticIds, k = 60) {
  if (!Number.isFinite(k) || k < 0) throw new TypeError('RRF k must be a non-negative finite number');
  const scores = new Map();
  const addRanks = (ids) => {
    const seen = new Set();
    ids.forEach((postId, index) => {
      if (seen.has(postId)) return;
      seen.add(postId);
      scores.set(postId, (scores.get(postId) || 0) + 1 / (k + index + 1));
    });
  };
  addRanks(keywordIds);
  addRanks(semanticIds);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .map(([postId]) => postId);
}

function rankOf(ids, correctIds, cutoff = Infinity) {
  const correct = new Set(correctIds);
  const index = ids.findIndex((id, i) => i < cutoff && correct.has(id));
  return index === -1 ? null : index + 1;
}
const reciprocalRank = (ids, correctIds) => {
  const rank = rankOf(ids, correctIds);
  return rank === null ? 0 : 1 / rank;
};
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const systems = ['keyword', 'semantic', 'hybrid'];
const reciprocalRanks = Object.fromEntries(systems.map((s) => [s, []]));
const recallHits = Object.fromEntries(systems.map((s) => [s, 0]));
const rows = [];

for (const { query, correctIds } of testSet) {
  const queryResults = results[query];
  if (!queryResults || !Array.isArray(queryResults.keyword) || !Array.isArray(queryResults.semantic)) {
    throw new Error(`Missing keyword or semantic results for query: ${query}`);
  }
  const lists = {
    keyword: queryResults.keyword,
    semantic: queryResults.semantic,
    hybrid: rrfFuse(queryResults.keyword, queryResults.semantic, 60),
  };
  for (const system of systems) {
    const rank = rankOf(lists[system], correctIds);
    reciprocalRanks[system].push(rank === null ? 0 : 1 / rank);
    if (rankOf(lists[system], correctIds, 10) !== null) recallHits[system] += 1;
  }
  rows.push({
    query,
    keyword: rankOf(lists.keyword, correctIds),
    semantic: rankOf(lists.semantic, correctIds),
    hybrid: rankOf(lists.hybrid, correctIds),
  });
}

const displayRank = (rank) => rank === null ? 'miss' : String(rank);
const format = (value) => value.toFixed(2);
console.log('| Query | Keyword rank | Semantic rank | Hybrid rank |');
console.log('|---|---:|---:|---:|');
for (const row of rows) {
  console.log(`| ${row.query} | ${displayRank(row.keyword)} | ${displayRank(row.semantic)} | ${displayRank(row.hybrid)} |`);
}
const summaries = systems.map((system) =>
  `**MRR ${format(mean(reciprocalRanks[system]))} · Recall@10 ${format(recallHits[system] / testSet.length)}**`
);
console.log(`| **Summary** | ${summaries[0]} | ${summaries[1]} | ${summaries[2]} |`);
