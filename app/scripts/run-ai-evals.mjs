import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(rootDir, "evals", "fixtures");

const taskRequirements = {
  job_parser: {
    requiredFields: ["company_name", "role_title", "application_method"],
    arrayFields: ["required_skills", "desired_skills", "key_skills"],
    enumFields: {
      application_method: ["website", "email", "unknown"],
    },
  },
  resume_parser: {
    requiredFields: ["name"],
    arrayFields: ["education", "experience", "projects", "skills"],
    enumFields: {},
  },
};

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in model output: ${candidate.slice(0, 160)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalize(value) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return value;
  return value;
}

function getValue(target, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, target);
}

function valueMatches(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (expected.every((item) => item && typeof item === "object")) {
      return expected.every((expectedItem) =>
        actual.some((actualItem) => valueMatches(actualItem, expectedItem)),
      );
    }

    const normalizedActual = actual.map(normalize);
    return expected.every((item) => normalizedActual.includes(normalize(item)));
  }

  if (expected && typeof expected === "object") {
    return Object.entries(expected).every(([key, value]) =>
      valueMatches(actual?.[key], value),
    );
  }

  return normalize(actual) === normalize(expected);
}

function flattenExpected(expected, prefix = "") {
  return Object.entries(expected).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      return flattenExpected(value, fullKey);
    }
    return [[fullKey, value]];
  });
}

function validateShape(task, output) {
  const requirements = taskRequirements[task];
  if (!requirements) return ["Unknown eval task."];

  const errors = [];
  for (const field of requirements.requiredFields) {
    if (getValue(output, field) == null || getValue(output, field) === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const field of requirements.arrayFields) {
    const value = getValue(output, field);
    if (value != null && !Array.isArray(value)) {
      errors.push(`Expected array field: ${field}`);
    }
  }

  for (const [field, allowed] of Object.entries(requirements.enumFields)) {
    const value = getValue(output, field);
    if (value != null && !allowed.includes(value)) {
      errors.push(`Invalid enum value for ${field}: ${value}`);
    }
  }

  return errors;
}

async function loadFixtures() {
  const taskDirs = await readdir(fixtureRoot, { withFileTypes: true });
  const fixtures = [];

  for (const dir of taskDirs) {
    if (!dir.isDirectory()) continue;
    const files = await readdir(path.join(fixtureRoot, dir.name), {
      withFileTypes: true,
    });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const fixturePath = path.join(fixtureRoot, dir.name, file.name);
      const raw = await readFile(fixturePath, "utf8");
      fixtures.push({ ...JSON.parse(raw), fixturePath });
    }
  }

  return fixtures;
}

function evaluateFixture(fixture) {
  let parsed;
  let jsonValid = false;
  let schemaErrors = [];

  try {
    parsed = extractJson(fixture.modelOutput);
    jsonValid = true;
    schemaErrors = validateShape(fixture.task, parsed);
  } catch (error) {
    return {
      id: fixture.id,
      task: fixture.task,
      jsonValid: false,
      schemaValid: false,
      fieldAccuracy: 0,
      matchedFields: 0,
      totalFields: flattenExpected(fixture.expected).length,
      errors: [error.message],
    };
  }

  const expectedFields = flattenExpected(fixture.expected);
  const matchedFields = expectedFields.filter(([field, expected]) =>
    valueMatches(getValue(parsed, field), expected),
  ).length;

  return {
    id: fixture.id,
    task: fixture.task,
    jsonValid,
    schemaValid: schemaErrors.length === 0,
    fieldAccuracy: matchedFields / expectedFields.length,
    matchedFields,
    totalFields: expectedFields.length,
    errors: schemaErrors,
  };
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function summarize(results) {
  const total = results.length;
  const jsonValid = results.filter((result) => result.jsonValid).length;
  const schemaValid = results.filter((result) => result.schemaValid).length;
  const averageAccuracy =
    results.reduce((sum, result) => sum + result.fieldAccuracy, 0) / total;

  return {
    total,
    jsonValid,
    schemaValid,
    averageAccuracy,
  };
}

const fixtures = await loadFixtures();
const results = fixtures.map(evaluateFixture);
const summary = summarize(results);

console.log("AI Eval Report");
console.log("==============");
console.log(`Fixtures: ${summary.total}`);
console.log(`JSON validity: ${summary.jsonValid}/${summary.total}`);
console.log(`Schema validity: ${summary.schemaValid}/${summary.total}`);
console.log(`Average field accuracy: ${percent(summary.averageAccuracy)}`);
console.log("");
console.log("Per-fixture results:");

for (const result of results) {
  const status = result.jsonValid && result.schemaValid ? "PASS" : "FAIL";
  console.log(
    `- ${status} ${result.id} (${result.task}) accuracy=${percent(result.fieldAccuracy)} fields=${result.matchedFields}/${result.totalFields}`,
  );
  for (const error of result.errors) {
    console.log(`  - ${error}`);
  }
}

if (results.some((result) => !result.jsonValid || !result.schemaValid)) {
  process.exitCode = 1;
}
