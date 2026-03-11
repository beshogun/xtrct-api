// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.

import type { ScrapePreset } from './index.ts';
import { parseCount } from './ecommerce.ts';

export const twitterProfile: ScrapePreset = {
  id: 'twitter-profile',
  name: 'X / Twitter Profile',
  category: 'social',
  description: 'Extracts display name, bio, follower/following counts and tweet count from an X (Twitter) profile page. Requires Playwright. Most data requires the user to be logged in; results may be incomplete for logged-out requests.',
  matchDomains: ['twitter.com', 'x.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-testid="UserName"]' },
  outputFormats: ['structured'],
  selectors: {
    name:        '[data-testid="UserName"] span:first-child',
    handle:      '[data-testid="UserName"] span:last-child',
    bio:         '[data-testid="UserDescription"]',
    followers:   'a[href$="/followers"] span span',
    following:   'a[href$="/following"] span span',
    tweet_count: '[data-testid="primaryColumn"] h2 + div span',
    location:    '[data-testid="UserLocation"] span',
    website:     '[data-testid="UserUrl"] a@href',
  },
  postProcess(raw) {
    return {
      ...raw,
      followers:   parseCount(raw.followers as string | null),
      following:   parseCount(raw.following as string | null),
    };
  },
};

export const youtubeVideo: ScrapePreset = {
  id: 'youtube-video',
  name: 'YouTube Video',
  category: 'social',
  description: 'Extracts video title, channel name, view count, like count, description and tags from a YouTube video page. Requires Playwright.',
  matchDomains: ['youtube.com', 'www.youtube.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'h1.ytd-watch-metadata' },
  outputFormats: ['structured'],
  selectors: {
    title:       'h1.ytd-watch-metadata yt-formatted-string',
    channel:     'ytd-channel-name yt-formatted-string a',
    views:       'span.view-count',
    likes:       'like-button-view-model button',
    description: 'ytd-text-inline-expander yt-attributed-string',
    tags:        'all:meta[property="og:video:tag"]@content',
    published:   'ytd-video-primary-info-renderer #info-strings yt-formatted-string',
    thumbnail:   'meta[property="og:image"]@content',
  },
  postProcess(raw) {
    return {
      ...raw,
      views: parseCount(raw.views as string | null),
    };
  },
};
