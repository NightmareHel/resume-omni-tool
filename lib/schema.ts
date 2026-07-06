import { sqliteTable, text, real, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const jobs = sqliteTable(
  'jobs',
  {
    id:          text('id').primaryKey(),
    source:      text('source').notNull(),
    external_id: text('external_id').notNull(),
    title:       text('title').notNull(),
    company:     text('company').notNull(),
    location:    text('location'),
    remote:      integer('remote').default(0),
    url:         text('url').notNull().unique(),
    description: text('description'),
    salary_min:  real('salary_min'),
    salary_max:  real('salary_max'),
    posted_at:   text('posted_at'),
    scraped_at:  text('scraped_at').notNull(),
    fit_score:   real('fit_score'),
    fit_grade:   text('fit_grade'),
    fit_summary: text('fit_summary'),
    status:      text('status').default('new').notNull(),
    // Sponsorship + seniority classification (computed at scrape time)
    sponsor_status:    text('sponsor_status'),   // blocked | confirmed | likely | possible | unlikely | unknown
    sponsor_evidence:  text('sponsor_evidence'), // verbatim JD phrase that triggered the verdict
    sponsor_lca_count: integer('sponsor_lca_count'),
    years_required:    integer('years_required'),
    entry_level:       integer('entry_level'),   // 1 = entry, 0 = not, null = undetermined
    everify:           integer('everify'),       // 1 = E-Verify mentioned in JD
  },
  (t) => [uniqueIndex('jobs_source_external_id').on(t.source, t.external_id)]
);

export const applications = sqliteTable('applications', {
  id:                text('id').primaryKey(),
  job_id:            text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  status:            text('status').default('draft').notNull(),
  applied_at:        text('applied_at'),
  submission_method: text('submission_method'),
  resume_text:       text('resume_text'),
  cover_letter:      text('cover_letter'),
  form_data:         text('form_data'),
  screenshot_path:   text('screenshot_path'),
  notes:             text('notes'),
  keyword_gap:       text('keyword_gap'), // JSON KeywordGapResult from tailor
  created_at:        text('created_at').notNull(),
  updated_at:        text('updated_at').notNull(),
});

// Aggregated H-1B filing history per employer, from DOL LCA disclosure
// files (primary, current) and USCIS Data Hub CSVs (backfill).
export const sponsor_history = sqliteTable(
  'sponsor_history',
  {
    employer_norm:  text('employer_norm').notNull(),
    employer_raw:   text('employer_raw').notNull(),
    fy:             integer('fy').notNull(),
    total_lcas:     integer('total_lcas').default(0).notNull(),
    new_employment: integer('new_employment').default(0),
    tech_lcas:      integer('tech_lcas').default(0),
    median_wage:    integer('median_wage'),
    source:         text('source').notNull(), // 'dol' | 'uscis'
  },
  (t) => [uniqueIndex('sponsor_history_employer_fy').on(t.employer_norm, t.fy, t.source)]
);

export const profile = sqliteTable('profile', {
  id:                text('id').primaryKey(),
  full_name:         text('full_name'),
  email:             text('email'),
  phone:             text('phone'),
  location:          text('location'),
  linkedin_url:      text('linkedin_url'),
  github_url:        text('github_url'),
  portfolio_url:     text('portfolio_url'),
  summary:           text('summary'),
  experience:        text('experience'),
  education:         text('education'),
  skills:            text('skills'),
  target_roles:      text('target_roles'),
  target_locations:  text('target_locations'),
  salary_min:        real('salary_min'),
  updated_at:        text('updated_at').notNull(),
});

export const email_threads = sqliteTable('email_threads', {
  id:              text('id').primaryKey(),
  application_id:  text('application_id').references(() => applications.id),
  job_id:          text('job_id').references(() => jobs.id),
  subject:         text('subject'),
  from_email:      text('from_email'),
  from_name:       text('from_name'),
  received_at:     text('received_at').notNull(),
  snippet:         text('snippet'),
  classification:  text('classification').default('other').notNull(),
  action_required: integer('action_required').default(0),
  read:            integer('read').default(0),
});

export const scrape_runs = sqliteTable('scrape_runs', {
  id:           text('id').primaryKey(),
  started_at:   text('started_at').notNull(),
  completed_at: text('completed_at'),
  sources:      text('sources'),
  jobs_found:   integer('jobs_found').default(0),
  jobs_new:     integer('jobs_new').default(0),
  status:       text('status').default('running').notNull(),
  error:        text('error'),
});
