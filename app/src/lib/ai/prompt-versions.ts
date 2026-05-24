export const PROMPT_VERSIONS = {
  'job-parser':     '1.0',
  'resume-parser':  '1.0',
  'assessment':     '1.0',
  'evidence':       '2.0',
  'cover-letter':   '2.0',
  'resume-tailor':  '2.0',
  'email-draft':    '2.1',
  'interview-prep': '1.0',
  'resume-score':   '1.0',
  'embedding':      '1.0',
} as const;

export type PromptType = keyof typeof PROMPT_VERSIONS;
