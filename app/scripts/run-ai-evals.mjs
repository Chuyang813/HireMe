#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const JOB_PARSER_SYSTEM = `You are a job description parser. Extract structured information from job descriptions.
Return valid JSON with these fields:
- title: string (job title)
- company: string (company name, empty string if not found)
- skills: string[] (required technical skills, deduplicated)
- description: string (summary of the role in 2-3 sentences)
- location: string (job location or "Remote")
- jobType: string ("full-time", "part-time", "contract", "internship")`;

async function parseJobWithGemini(jobDescription) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: JOB_PARSER_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: jobDescription }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return JSON.parse(text);
}

function evaluate(fixture, output) {
  const results = [];

  for (const field of (fixture.expected.requiredFields ?? [])) {
    const present = output[field] !== undefined && output[field] !== null && output[field] !== '';
    results.push({ check: `field:${field}`, pass: present });
  }

  if (fixture.expected.titleContains) {
    results.push({
      check: 'title_contains',
      pass: output.title?.toLowerCase().includes(fixture.expected.titleContains.toLowerCase()) ?? false,
    });
  }

  if (fixture.expected.companyContains) {
    results.push({
      check: 'company_contains',
      pass: output.company?.toLowerCase().includes(fixture.expected.companyContains.toLowerCase()) ?? false,
    });
  }

  if (fixture.expected.minSkillCount) {
    results.push({
      check: 'min_skills',
      pass: Array.isArray(output.skills) && output.skills.length >= fixture.expected.minSkillCount,
    });
  }

  if (fixture.expected.descriptionMinLength) {
    results.push({
      check: 'description_length',
      pass: (output.description?.length ?? 0) >= fixture.expected.descriptionMinLength,
    });
  }

  return results;
}

const fixtureDir = join(__dirname, 'evals/fixtures/job-parser');
const fixtures = readdirSync(fixtureDir)
  .filter(f => f.endsWith('.json'))
  .sort()
  .map(f => JSON.parse(readFileSync(join(fixtureDir, f), 'utf8')));

console.log(`Running eval on ${fixtures.length} fixtures...\n`);

let totalPass = 0, totalFail = 0;
const failures = [];

for (const fixture of fixtures) {
  try {
    const output = await parseJobWithGemini(fixture.input.jobDescription);
    const results = evaluate(fixture, output);

    const pass = results.filter(r => r.pass).length;
    const fail = results.filter(r => !r.pass).length;
    totalPass += pass;
    totalFail += fail;

    const status = fail === 0 ? '✓' : '✗';
    console.log(`${status} [${fixture.id}] ${pass}/${pass + fail}`);
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    ✗ ${r.check}`);
      failures.push({ fixture: fixture.id, check: r.check });
    });

    // Rate limit: 1 req/sec to avoid hitting free tier limits
    await new Promise(r => setTimeout(r, 1100));
  } catch (e) {
    console.log(`✗ [${fixture.id}] ERROR: ${e.message}`);
    totalFail++;
    failures.push({ fixture: fixture.id, check: 'parse_error', error: e.message });
  }
}

const total = totalPass + totalFail;
const pct = total > 0 ? Math.round(totalPass / total * 100) : 0;
console.log(`\n${'='.repeat(40)}`);
console.log(`Overall: ${totalPass}/${total} checks passed (${pct}%)`);
console.log(`Fixtures: ${fixtures.length}`);
if (failures.length > 0) {
  console.log('\nFailing checks:');
  failures.forEach(f => console.log(`  ${f.fixture} → ${f.check}${f.error ? ': ' + f.error : ''}`));
}
process.exit(pct >= 75 ? 0 : 1);
