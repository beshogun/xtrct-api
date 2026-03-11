// Selectors written 2026-03-11. Sites update their markup frequently; review if extraction stops working.

import type { ScrapePreset } from './index.ts';
import { parsePrice } from './ecommerce.ts';

export const indeedJob: ScrapePreset = {
  id: 'indeed-job',
  name: 'Indeed Job Listing',
  category: 'jobs',
  description: 'Extracts job title, company, location, salary, type and description from an Indeed job posting.',
  matchDomains: ['indeed.com', 'uk.indeed.com', 'indeed.co.uk'],
  strategy: 'http',
  outputFormats: ['structured'],
  selectors: {
    title:       'h1.jobsearch-JobInfoHeader-title',
    company:     'div[data-company-name="true"] a, span.icl-u-lg-mr--sm',
    location:    'div[data-testid="job-location"], span.icl-u-xs-mt--xs',
    salary:      'div[id*="salaryInfoAndJobType"] span',
    job_type:    'span.css-k5flys',
    description: 'div#jobDescriptionText',
    posted_date: 'span[data-testid="job-age"]',
  },
};

export const linkedinJob: ScrapePreset = {
  id: 'linkedin-job',
  name: 'LinkedIn Job Listing',
  category: 'jobs',
  description: 'Extracts job title, company, location, seniority level, employment type, description and applicant count from a LinkedIn job posting. Requires Playwright due to JavaScript rendering.',
  matchDomains: ['linkedin.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '.job-details-jobs-unified-top-card__job-title' },
  outputFormats: ['structured'],
  selectors: {
    title:            '.job-details-jobs-unified-top-card__job-title h1',
    company:          '.job-details-jobs-unified-top-card__company-name a',
    location:         '.job-details-jobs-unified-top-card__bullet',
    seniority_level:  '.job-details-jobs-unified-top-card__job-insight span',
    employment_type:  '.job-details-jobs-unified-top-card__job-insight:nth-child(2) span',
    description:      '.jobs-description__content .jobs-description-content__text',
    applicant_count:  '.job-details-jobs-unified-top-card__applicant-count',
  },
};

export const glassdoorJob: ScrapePreset = {
  id: 'glassdoor-job',
  name: 'Glassdoor Job Listing',
  category: 'jobs',
  description: 'Extracts job title, company, location, salary estimate, rating and description from a Glassdoor listing.',
  matchDomains: ['glassdoor.co.uk', 'glassdoor.com'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: '[data-test="job-title"]' },
  outputFormats: ['structured'],
  selectors: {
    title:           '[data-test="job-title"]',
    company:         '[data-test="employer-name"]',
    location:        '[data-test="location"]',
    salary_estimate: '[data-test="detailSalary"]',
    rating:          '[data-test="rating-info"] span',
    description:     '[class*="JobDetails_jobDescription"]',
    pros:            'all:.v2__EIReviewsSummaryRatingAndCount',
    cons:            'all.[class*="review-details_reviewDetails"] .cons p',
  },
  postProcess(raw) {
    return {
      ...raw,
      rating: raw.rating ? parseFloat(raw.rating as string) || null : null,
    };
  },
};

export const remoteokListing: ScrapePreset = {
  id: 'remoteok-listing',
  name: 'RemoteOK Job Listing',
  category: 'jobs',
  description: 'Extracts remote job title, company, tags, salary and description from a RemoteOK listing. Requires Playwright.',
  matchDomains: ['remoteok.com', 'remoteok.io'],
  strategy: 'playwright',
  waitFor: { type: 'selector', value: 'tr.job' },
  outputFormats: ['structured'],
  selectors: {
    title:       'h2[itemprop="title"]',
    company:     '.companyLink h3',
    tags:        'all:.tag',
    salary:      '[class*="salary"]',
    description: '.description',
    url:         'a.preventLink@href',
  },
  postProcess(raw) {
    return {
      ...raw,
      salary_min: parseSalaryMin(raw.salary as string | null),
      salary_max: parseSalaryMax(raw.salary as string | null),
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSalaryMin(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/\$?([\d,]+)/);
  return m ? parsePrice(m[0]) : null;
}

function parseSalaryMax(raw: string | null): number | null {
  if (!raw) return null;
  const parts = raw.match(/\$?([\d,]+)/g);
  if (!parts || parts.length < 2) return null;
  return parsePrice(parts[parts.length - 1]);
}
