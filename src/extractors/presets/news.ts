// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.

import type { ScrapePreset } from './index.ts';
import { parseCount } from './ecommerce.ts';

export const genericArticle: ScrapePreset = {
  id: 'article',
  name: 'Generic News Article',
  category: 'news',
  description: 'Extracts title, author, publish date, body text, tags and OG image from a generic news article. Covers most news sites using common semantic markup.',
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'h1',
    author:         'all:[rel="author"], all:[class*="author"], all:[itemprop="author"]',
    published_date: 'time@datetime',
    // Try narrowly scoped selectors; "article p" is a broad fallback
    body:           'all:.article-body p, all:.article__body p, all:.entry-content p, all:article p',
    tags:           'all:a[rel="tag"]',
    image:          'meta[property="og:image"]@content',
    description:    'meta[name="description"]@content',
  },
};

export const hnPost: ScrapePreset = {
  id: 'hn-post',
  name: 'Hacker News Post',
  category: 'news',
  description: 'Extracts title, points, comment count, author and linked URL from a Hacker News submission.',
  matchDomains: ['news.ycombinator.com'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:          'a.titlelink, a.storylink',
    points:         'span.score',
    comments_count: '.subtext a:last-child',
    author:         'a.hnuser',
    url:            'a.titlelink@href, a.storylink@href',
  },
  postProcess(raw) {
    return {
      ...raw,
      points:         parseCount(raw.points as string | null),
      comments_count: parseCount(raw.comments_count as string | null),
    };
  },
};

export const redditPost: ScrapePreset = {
  id: 'reddit-post',
  name: 'Reddit Post',
  category: 'news',
  description: 'Extracts post title, subreddit, author, score, comment count and body from a Reddit post. Requires Playwright due to JavaScript rendering.',
  matchDomains: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1' },
  outputFormats: ['structured'],
  selectors: {
    title:         'h1',
    subreddit:     'a[href*="/r/"][data-testid="subreddit-name"]',
    author:        'a[href*="/user/"]',
    score:         'faceplate-number[pretty=""]',
    comment_count: 'a[href*="/comments/"] faceplate-number',
    body:          '.usertext-body, [slot="text-body"]',
    url:           'meta[property="og:url"]@content',
  },
  postProcess(raw) {
    return {
      ...raw,
      score:         parseCount(raw.score as string | null),
      comment_count: parseCount(raw.comment_count as string | null),
    };
  },
};
