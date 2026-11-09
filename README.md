# Hybrid Search Mini Project (BM25 + Vector with RRF)

A self-contained evaluation of keyword and semantic search using **Reciprocal Rank Fusion (RRF)**. The project uses the supplied ranked-result fixtures, so it runs with Node.js and requires no database or API keys.

## Files

- `hybrid-eval.js` — RRF fusion, ranking metrics, and Markdown report generation.
- `test-set.csv` — ten queries and their correct post IDs (multiple IDs are semicolon-separated).
- `search-results.json` — top-20 keyword and semantic result lists for each query.
- `posts-dataset.csv` — source posts for checking the fixture IDs.

## Run

Requires Node.js (no third-party packages).

```bash
node hybrid-eval.js
```

## Evaluation results

```text
| Query | Keyword rank | Semantic rank | Hybrid rank |
|---|---:|---:|---:|
| my redis cache keeps showing old data | 8 | 1 | 1 |
| how do I add semantic search to a table I already have | 12 | 2 | 1 |
| redis or memcached for caching | 1 | 2 | 1 |
| why did my query get slower after I added an index | 14 | 1 | 2 |
| what does ACID actually guarantee | 2 | 1 | 1 |
| how do I keep my postgres online while changing the schema | 6 | 3 | 1 |
| my background jobs stop after every deploy | 13 | 2 | 2 |
| how do I let my database accept more writes per second | 4 | 1 | 1 |
| sql or nosql for a new product | 1 | 3 | 1 |
| why does my redis memory keep climbing | 15 | 2 | 1 |
| **Summary** | **MRR 0.33 · Recall@10 0.60** | **MRR 0.67 · Recall@10 1.00** | **MRR 0.90 · Recall@10 1.00** |
```

## Interpretation

Hybrid search is the best overall system: its MRR of 0.90 is 0.23 higher than semantic search (0.67) and 0.57 higher than keyword search (0.33). For “how do I add semantic search to a table I already have,” neither individual system ranked the correct post first (keyword ranked it 12th and semantic ranked it 2nd), but RRF combined their evidence and lifted it to rank 1. For “why does my redis memory keep climbing,” keyword search buried the correct post at rank 15 while semantic search ranked it 2nd, and fusion rescued it to rank 1. Fetching the top 20 from each search is important because the correct post would have been discarded if keyword results had been truncated to 10 before fusion. Hybrid does not put every answer at rank 1 because one system can contribute a much stronger rank signal than the other, so consensus is not always enough to overcome that lead.

## How it works

For each document, RRF adds `1 / (k + rank)` from each ranked list where it appears (`k = 60)); it uses rank positions rather than comparing raw BM25 and cosine scores. The script then computes reciprocal rank for the first correct result and Recall@10 for keyword, semantic, and hybrid lists over the same ten-query test set.
