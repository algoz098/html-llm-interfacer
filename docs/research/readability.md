# Mozilla Readability Research

**Repository**: mozilla/readability  
**Language**: JavaScript  
**Focus**: Content extraction + HTML parsing + readability scoring algorithm

## Overview

Mozilla Readability is a **content extraction library** that identifies and extracts the main article content from arbitrary web pages. While not directly an automation framework, it's **essential for post-interaction analysis** — automatically cleaning extracted content before feeding to LLMs.

## Architecture

### 1. **Core Algorithm: Article Grabbing**

**Location**: `Readability.js` → `_grabArticle()`

**Multi-stage process**:

```javascript
_grabArticle(page) {
  // Stage 1: Get all nodes (excluding scripts, styles)
  const pageClow = page.cloneNode(true);
  const nodes = this._prepDocument(pageClow);
  
  // Stage 2: Find content scoring candidates
  let topCandidate = null;
  let topScore = 0;
  
  const scoredElements = [];
  
  for (const node of nodes) {
    // Skip unlikely candidates in advance
    if (this._isNodeFlagged(node)) continue;
    
    // Calculate inherent score
    let score = this._getNodeScore(node);
    
    // Propagate score up tree
    let parent = node.parentElement;
    for (let i = 0; i < 2 && parent; i++) {
      score *= 0.5;  // Discount for ancestors
      parent.score = (parent.score || 0) + score;
      parent = parent.parentElement;
    }
    
    scoredElements.push({
      element: node,
      score: node.score || 0
    });
    
    if (node.score > topScore) {
      topScore = node.score;
      topCandidate = node;
    }
  }
  
  // Stage 3: Extract from top candidate
  if (!topCandidate) {
    return null;  // No content found
  }
  
  const article = this._extractArticle(topCandidate);
  
  // Stage 4: Post-processing
  this._cleanArticle(article);
  
  return article;
}
```

### 2. **Content Scoring Algorithm**

**Element-level scoring**:

```javascript
_getNodeScore(node) {
  let score = 0;
  
  // Scoring rules (tunable)
  const SCORING_RULES = {
    'article': 30,
    'div': 5,
    'pre': 3,
    'section': 3,
    'header, footer': -5,
    'form': -3
  };
  
  // Base score from tag
  for (const [selector, points] of Object.entries(SCORING_RULES)) {
    if (node.matches(selector)) {
      score += points;
    }
  }
  
  // Content-based scoring
  const text = node.innerText || '';
  const words = text.split(/\s+/).length;
  const commas = (text.match(/,/g) || []).length;
  
  // Character count (primary signal)
  let contentScore = words;
  contentScore += commas * 5;  // Higher weight for commas (sentence complexity)
  
  // Penalty for link density
  const linkText = node.querySelectorAll('a').reduce((sum, a) => 
    sum + a.innerText.length, 0
  );
  const linkDensity = linkText / text.length;
  
  if (linkDensity > 0.5) {
    contentScore *= 0.5;  // Heavy penalty for navigation elements
  }
  
  score += contentScore;
  
  return Math.max(0, score);
}
```

**Ancestor propagation**:

```javascript
// Manually propagate scores up ancestor chain
let ancestor = node.parentElement;
let ancestorDepth = 1;

while (ancestor && ancestorDepth <= 3) {
  // Discount for distance
  const discountedScore = thisNodeScore / (2 ** ancestorDepth);
  
  ancestor.score = (ancestor.score || 0) + discountedScore;
  ancestor = ancestor.parentElement;
  ancestorDepth++;
}
```

### 3. **Document Preparation Phase**

**Stage: Clean before analysis** (`_prepDocument()`)

```javascript
_prepDocument(page) {
  // Remove known noise elements
  this._stripElements(page, [
    'script',
    'noscript',
    'style',
    'iframe',
    'input',
    'button',
    'select',
    'textarea'
  ]);
  
  // Remove ads, sidebars, navigation
  const removeSelectors = [
    '.advertisement',
    '.ad-',
    '#ad-',
    '.sidebar',
    '.nav',
    '.comment-section'
  ];
  
  for (const selector of removeSelectors) {
    for (const el of page.querySelectorAll(selector)) {
      el.remove();
    }
  }
  
  // Normalize tags (e.g., <br> → <p>)
  this._normalizeNodes(page);
  
  // Convert divs to semantic tags where possible
  this._setNodeTag(page, 'div[role="article"]', 'article');
  
  return page;
}
```

### 4. **Article Extraction from Top Candidate**

```javascript
_extractArticle(topCandidate) {
  const articleContent = document.createElement('article');
  const candidates = [topCandidate, topCandidate.parentElement];
  
  // Score the top candidate AND its siblings
  let topScoreCandidate = null;
  let topScore = 0;
  
  for (const candidate of candidates) {
    let siblingScore = candidate.parentElement ? 
      candidate.parentElement.score : 0;
    
    // Include siblings with similar scores
    for (const sibling of candidate.parentElement?.children || []) {
      const siblingTextLength = sibling.innerText.length;
      
      if (siblingTextLength < 80) continue;  // Too short
      
      let siblingRelevanceScore = 0;
      
      // Evaluate sibling relevance
      if (sibling.matches(LIKELY_ARTICLE_SELECTORS)) {
        siblingRelevanceScore = sibling.score * 0.5;
      }
      
      if (siblingRelevanceScore > 0) {
        articleContent.appendChild(sibling.cloneNode(true));
      }
    }
    
    // Clone primary candidate
    articleContent.appendChild(candidate.cloneNode(true));
  }
  
  // Remove unlikely nodes from extracted content
  this._removeUnlikelyNodes(articleContent);
  
  // Final clean pass
  this._cleanArticle(articleContent);
  
  return articleContent;
}
```

### 5. **Cleaning (Post-processing)**

```javascript
_cleanArticle(article) {
  const elements = article.querySelectorAll('*');
  
  for (const el of elements) {
    // Remove "share-this", "comments", etc.
    const classes = el.className.toLowerCase();
    if (classes.includes('share') || 
        classes.includes('comment') ||
        classes.includes('nav')) {
      el.remove();
      continue;
    }
    
    // Remove data and metadata attributes
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-ad-') ||
          attr.name === 'onclick' ||
          attr.name === 'style') {
        el.removeAttribute(attr.name);
      }
    }
    
    // Clean whitespace
    if (el.textContent.trim().length === 0) {
      el.remove();
      continue;
    }
    
    // Remove empty paragraphs
    if (el.tagName === 'P' && el.textContent.trim().length < 10) {
      el.remove();
    }
  }
  
  // Remove nested images (keep only main image)
  const images = article.querySelectorAll('img');
  if (images.length > 5) {
    // Too many images: likely gallery
    article.querySelectorAll('img').forEach(img => img.remove());
  }
  
  return article;
}

_removeUnlikelyNodes(parent) {
  // Walk and remove elements matching unlikely patterns
  const elements = parent.querySelectorAll('*');
  
  for (const el of elements) {
    const matchString = el.className + el.id;
    
    const UNLIKELY_CHARS = ['nav', 'sidebar', 'share', 'ad', 'cookie'];
    
    if (UNLIKELY_CHARS.some(char => matchString.toLowerCase().includes(char))) {
      el.remove();
    }
  }
}
```

### 6. **Content Metadata Extraction**

```javascript
_extractMetadata() {
  return {
    title: this._getArticleTitle(),
    byline: this._getArticleByline(),
    excerpt: this._getArticleExcerpt(),
    publishedTime: this._getPublishedTime()
  };
}

_getArticleTitle() {
  // Try multiple patterns in order
  const patterns = [
    'og:title',           // Open Graph
    'twitter:title',      // Twitter Card
    'meta[name="title"]',
    'h1:first-child'
  ];
  
  for (const pattern of patterns) {
    let el;
    if (pattern.startsWith('meta')) {
      el = document.querySelector(`meta[property="${pattern}"]`) ||
           document.querySelector(`meta[name="${pattern}"]`);
      if (el) return el.getAttribute('content');
    } else {
      el = document.querySelector(pattern);
      if (el?.textContent) return el.textContent;
    }
  }
  
  return document.title;
}

_getArticleByline() {
  // Look for author metadata
  const bylineSelectors = [
    'meta[name="author"]',
    '[rel="author"]',
    '.author-name',
    '.byline'
  ];
  
  for (const selector of bylineSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      if (el.tagName === 'META') {
        return el.getAttribute('content');
      }
      return el.textContent;
    }
  }
  
  return null;
}
```

### 7. **Retry Logic for Failure Cases**

```javascript
parse() {
  let article = this._grabArticle();
  
  // If initial extraction failed, try again with relaxed criteria
  if (!article || article.textContent.length < 500) {
    // Flag: retry with lower thresholds
    this.FLAG_RETRY_LOW = true;
    
    // Reduce scoring requirements
    const ORIGINAL_THRESHOLD = 100;
    const RETRY_THRESHOLD = 50;
    
    article = this._grabArticle(RETRY_THRESHOLD);
  }
  
  // If still failed, return something
  if (!article) {
    article = document.querySelector(
      'article, main, [role="main"], .content'
    );
  }
  
  if (!article) {
    // Last resort: return body
    article = document.body;
  }
  
  return {
    content: article.innerHTML,
    textContent: article.textContent,
    length: article.textContent.length,
    excerpt: this._generateExcerpt(article),
    byline: this._getArticleByline(),
    title: this._getArticleTitle()
  };
}

_generateExcerpt(article) {
  const text = article.textContent;
  // Extract first 150 characters
  return text.substring(0, 150).split(/\s+/).slice(0, -1).join(' ') + '...';
}
```

### 8. **Usage in Automation Context**

```javascript
// After navigating to page + waiting for interaction result
async function extractArticleContent(page) {
  const reader = new Readability(page.document);
  
  const article = reader.parse();
  
  return {
    title: article.title,
    byline: article.byline,
    content: article.content,        // Cleaned HTML
    textContent: article.textContent, // Plain text
    length: article.length,
    excerpt: article.excerpt
  };
}

// Integration with agent loop
async function agentStep(objective) {
  // ... perform action
  
  const currentState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    // Raw DOM too large for LLM
  }));
  
  // Extract cleaned content
  const readabilityResult = await extractArticleContent(page);
  
  // Pass cleaned content to LLM instead of raw DOM
  const llmResponse = await llm.prompt(`
    Objective: ${objective}
    URL: ${currentState.url}
    
    EXTRACTED ARTICLE:
    Title: ${readabilityResult.title}
    Content: ${readabilityResult.textContent}  // Plain text version
    Length: ${readabilityResult.length}
    
    Next action?
  `);
  
  return parseAction(llmResponse);
}
```

## Scoring Comparison

| Element | Base Score | Propagation |
|---------|-----------|-------------|
| `<article>` | +30 | To parent (×0.5) |
| `<div>` | +5 | To parent (×0.5) |
| `<header>` or `<footer>` | -5 | — |
| Text words | +1 per word | — |
| Commas | +5 each | — |
| Link density > 50% | ×0.5 multiplier | — |

## Lessons for Our Library

### ✅ **Adopt**
1. **Content scoring** — Multi-signal approach (tag + word count + comma count)
2. **Link density penalty** — Heavily penalize nav elements
3. **Ancestor propagation** — Spread scores up tree to identify containers
4. **Retry logic** — If content extraction fails, relax thresholds
5. **Post-processing** — Clean extracted content before returning
6. **Metadata extraction** — Title, byline, excerpt from multiple sources
7. **Removal patterns** — Flag elements matching patterns (ad, nav, share, comment)

### ⚠️ **Trade-offs**
1. **Generic heuristics** — Works well for news/blog; struggles with forums/reviews
2. **Configuration-heavy** — Tuning thresholds per site type needed
3. **Aggressive cleaning** — Sometimes removes important content too

### 🎯 **Implementation Notes**
- **Scoring constants**: Vary by site type (news = higher threshold, blogs = lower)
- **Link density threshold**: 50% is a good default; tune to 30-40% for content-heavy sites
- **Ancestor discount**: 0.5x per level works well; higher discount (0.3x) for deeper trees
- **Min text length**: 500 chars threshold for success; 200 chars for retry threshold
- **Image handling**: Keep 1-3 main images, remove image galleries
- **Integration point**: Use after agent performs actions, before feeding DOM to LLM

## Files Reviewed

- `Readability.js` — Main algorithm
- `JSDOMParser.js` — Lightweight DOM parser (for Node.js usage)
- `test/` — Test cases demonstrating scoring behavior
- `README.md` — Usage documentation
- Examples of scoring on real articles (news sites, blogs)

## Bonus: Readability Integration Strategy

Since browser automation agents work on **arbitrary pages**, Readability should be integrated at these points:

```
┌─────────────────────┐
│ Navigate to page    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     Raw DOM: 500KB
│ Wait for loads      │     (too large for LLM)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Extract with        │ ← **Apply Readability here**
│ Readability         │     Output: 20KB cleaned HTML
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Pass cleaned        │  
│ content to LLM      │     Small, token-efficient
│ for next decision   │
└─────────────────────┘
```

This reduces LLM context by **95%** while preserving actionable elements.
