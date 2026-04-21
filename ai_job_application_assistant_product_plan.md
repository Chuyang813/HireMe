# AI Job Application Assistant — Product Plan

## 1. Document Metadata
- Product Name: AI Job Application Assistant
- Document Type: Product Plan / MVP Development Specification
- Version: 1.0
- Language: English
- Intended Audience: AI coding assistants, developers, product managers, startup builders
- Primary Goal: Build a cross-device application that helps users tailor resumes and cover letters to job postings, manage application progress, and prepare for assessments and interviews.

---

## 2. Executive Summary

This product is an AI-powered job application assistant that helps users move from job discovery to application submission and then through later hiring stages such as assessments, interviews, rejections, and offers.

The user provides a job description by pasting a job posting URL or raw text. The system parses the posting, extracts key requirements, and uses the user's uploaded base resume to generate:
- a tailored resume,
- a cover letter,
- and, if needed, a job-specific email draft.

Each job application is stored as its own structured workspace inside the app. That workspace contains the job details, generated documents, progress updates, and later-stage preparation materials such as assessment analysis and interview preparation.

The application must work across desktop and mobile devices with cloud sync.

---

## 3. Product Vision

Build a unified AI job search workspace that allows a user to:
1. Analyze a job posting quickly.
2. Generate customized application materials without fabricating experience.
3. Store all materials by job application.
4. Track progress across all applications.
5. Prepare intelligently for assessments and interviews.
6. Access everything from phone and computer with synced data.

---

## 4. Problem Statement

Job seekers typically face the following problems:
- Tailoring resumes for each role is repetitive and time-consuming.
- Cover letters and email applications require repeated manual writing.
- Application tracking is fragmented across spreadsheets, notes, and inboxes.
- Follow-up stages such as assessments and interviews are not organized in one place.
- Materials and updates are not always synchronized across devices.

This product solves those problems by combining AI document generation with job application management.

---

## 5. Target Users

### 5.1 Primary Users
- Students applying for internships and new graduate roles
- Early-career professionals applying to multiple jobs
- Career switchers who need tailored positioning for different roles

### 5.2 Secondary Users
- International students managing many applications
- Users applying to jobs that require email submissions
- Users preparing for multiple interviews at once

---

## 6. Product Goals

### 6.1 Business/Product Goals
- Reduce the time needed to apply to a job
- Increase application quality through role-specific materials
- Improve user organization and follow-up rate
- Create a sticky workflow that users return to through the full recruiting cycle

### 6.2 User Goals
- Save time
- Improve resume relevance
- Generate better cover letters
- Avoid losing track of applications
- Prepare better for interviews and assessments

---

## 7. Non-Goals for MVP

The MVP will not initially include:
- Full autonomous job searching across the web
- Automatic email sending from within the app
- Deep ATS score benchmarking against proprietary recruiter systems
- Real-time collaborative editing for teams
- Fully native mobile apps at launch
- Voice interview simulation at launch

These can be considered post-MVP features.

---

## 8. Core Product Capabilities

### 8.1 Job Input and Parsing
Users can provide:
- a job posting URL, or
- pasted job description text.

The system extracts:
- company name,
- role title,
- location,
- responsibilities,
- requirements,
- key skills,
- application method,
- whether cover letter is requested,
- whether email application is requested,
- contact email if present,
- deadline if present.

### 8.2 Resume Tailoring
Based on:
- the user's uploaded base resume,
- parsed job requirements,
- optionally the user's preferred role focus,

the system generates a tailored version of the resume.

Important rule:
- The system must not invent new experiences, employers, degrees, achievements, or skills not present in the user's source materials.
- The system may reorganize, rewrite, prioritize, and highlight relevant content.

### 8.3 Cover Letter Generation
The system generates a job-specific cover letter based on:
- the user's base resume,
- parsed job requirements,
- company and role information.

### 8.4 Email Draft Generation
If the job requires application by email, the system generates:
- email subject line,
- email body,
- suggested attachment list.

### 8.5 Application Workspace
Each job application has its own structured workspace containing:
- parsed job information,
- original job text or URL,
- tailored resume versions,
- cover letter versions,
- email drafts,
- status history,
- notes,
- later-stage interview and assessment materials.

### 8.6 Progress Tracking
The system tracks:
- total saved jobs,
- total applied jobs,
- assessments received,
- interviews received,
- rejections,
- offers,
- stage conversion rates.

### 8.7 Assessment Analysis
Users can upload or paste assessment instructions. The system analyzes:
- what is being asked,
- likely evaluation criteria,
- what to prepare,
- deadline-related action items,
- submission checklist.

### 8.8 Interview Preparation
When an application moves into interview stages, the system can generate:
- likely interview questions,
- behavioral questions,
- role-specific technical or functional questions,
- preparation checklist,
- tailored talking points using the user's resume and job description.

---

## 9. MVP Scope

The MVP should focus on the smallest complete workflow that still delivers strong value.

### 9.1 MVP Objective
Allow a user to go from job description input to generated materials to tracked application status in one system.

### 9.2 MVP Features
1. User authentication
2. Base resume upload
3. Base resume parsing
4. Job description text input
5. Basic job description parsing
6. Tailored resume generation
7. Cover letter generation
8. Email draft generation when applicable
9. Automatic creation of a job-specific application workspace
10. Status tracking for each application
11. Dashboard with key metrics
12. Cloud sync across devices through web access

### 9.3 MVP Status Values
- Saved
- Ready to Apply
- Applied
- Assessment
- Interview
- Rejected
- Offer
- Withdrawn

### 9.4 MVP Exclusions
- Voice interview simulator
- Full browser extension
- Auto-import from email inbox
- Automated application submission
- Native iOS and Android apps
- Advanced analytics by industry and geography

---

## 10. Post-MVP Features

### 10.1 Phase 2
- Job posting URL scraping and structured extraction
- Multiple base resume profiles
- Better document comparison and version history
- Assessment file upload and analysis
- Interview preparation generator
- Reminder system for deadlines and follow-ups

### 10.2 Phase 3
- Mock interview simulator
- Voice-based interview mode
- ATS-style keyword gap analysis
- Auto-generated follow-up emails
- Calendar integration
- Browser extension for one-click job import
- Native mobile apps

---

## 11. User Stories

### 11.1 Resume Generation
As a user, I want to upload my resume and paste a job description so that I can quickly generate a customized resume for that role.

### 11.2 Cover Letter
As a user, I want the app to generate a cover letter based on the job and my resume so that I can avoid rewriting from scratch.

### 11.3 Email Draft
As a user, I want an email draft when a job requires email submission so that I can copy and send it quickly.

### 11.4 Application Workspace
As a user, I want each application stored in its own workspace so that I can keep documents and updates organized.

### 11.5 Tracker
As a user, I want to see how many jobs I have applied to and how many interviews I received so that I can monitor my progress.

### 11.6 Assessment Support
As a user, I want to upload assessment instructions and receive preparation guidance so that I can respond effectively.

### 11.7 Interview Prep
As a user, I want tailored interview questions based on the job description and my resume so that I can prepare efficiently.

---

## 12. Functional Requirements

### 12.1 Authentication
- Users can sign up, sign in, and sign out.
- Users can access only their own data.
- Sessions must persist securely across devices.

### 12.2 Resume Upload
- Users can upload at least one base resume.
- Accepted formats: PDF and DOCX for MVP.
- System parses uploaded resume into structured internal representation.

### 12.3 Job Description Input
- Users can paste raw job description text.
- Users can optionally provide company and title manually if parsing is incomplete.
- URL input can exist in MVP UI, but full scraping may be post-MVP.

### 12.4 Job Parsing
The system must identify, when possible:
- company name,
- role title,
- location,
- role summary,
- required skills,
- desired skills,
- application method,
- email address,
- deadline.

### 12.5 Tailored Resume Generation
- The system must generate a new tailored resume from existing source resume data.
- The output must remain factually grounded in user-provided content.
- The output must be editable and savable.

### 12.6 Cover Letter Generation
- The system must generate a role-specific cover letter.
- The output must be editable and savable.

### 12.7 Email Draft Generation
- Trigger only when email application is detected or selected manually.
- Generate subject and body.
- Output must be editable and copyable.

### 12.8 Application Workspace Storage
For each job application, the system stores:
- job details,
- source job text,
- generated documents,
- status,
- timestamps,
- notes.

### 12.9 Status Tracking
Users can update application status manually.
Each update creates a timeline event.

### 12.10 Dashboard
The app shows:
- total applications,
- applications by stage,
- interviews,
- rejections,
- offers,
- recent activity.

### 12.11 Assessment Analysis
Users can paste or upload assessment instructions.
The system returns:
- summary,
- key deliverables,
- preparation needs,
- action checklist.

### 12.12 Interview Preparation
Users can trigger interview prep generation.
The system returns:
- likely questions,
- preparation checklist,
- suggested talking points.

---

## 13. Non-Functional Requirements

### 13.1 Cross-Device Access
- Must function well on desktop and mobile browsers.
- Must sync user data through a cloud backend.

### 13.2 Performance
- Material generation should return within an acceptable UX window.
- Parsing and document retrieval should feel responsive.

### 13.3 Reliability
- Document storage must not lose user files.
- Versioned records should remain consistent.

### 13.4 Security
- User files must be access-controlled.
- Sensitive documents must be stored securely.
- Transport must use HTTPS.
- User data must not be exposed to other users.

### 13.5 Privacy
- User resumes and job applications are private by default.
- Any AI use must clearly indicate that generated outputs should be reviewed by the user.

### 13.6 Auditability
- Generated content should be traceable to source resume and source job description.
- Status changes should be visible in timeline history.

---

## 14. Proposed System Architecture

## 14.1 Frontend
Recommended stack:
- Next.js
- TypeScript
- Tailwind CSS
- Component library such as shadcn/ui

Reason:
- Fast web development
- Strong support for responsive design
- Easy integration with backend APIs

## 14.2 Backend
Recommended stack:
- FastAPI (preferred if Python is used for AI workflows)

Reason:
- Strong support for AI orchestration
- Easy file handling
- Clean async API structure
- Good compatibility with document parsing and LLM pipelines

## 14.3 Database
Recommended:
- PostgreSQL

Reason:
- Strong relational modeling for users, job applications, documents, events, and analytics
- Reliable for production use

## 14.4 File Storage
Recommended:
- AWS S3, Cloudflare R2, or Supabase Storage

Use cases:
- source resumes,
- generated resume files,
- cover letters,
- assessment uploads,
- exported documents.

## 14.5 Authentication
Recommended options:
- Supabase Auth
- Clerk
- Auth.js

## 14.6 AI Services Layer
Split into modular services:
- Job Parser Service
- Resume Parser Service
- Resume Tailoring Service
- Cover Letter Service
- Email Draft Service
- Assessment Analyzer Service
- Interview Prep Service

This modular approach is better than one large prompt chain because it improves maintainability and testing.

---

## 15. Data Model

### 15.1 User
Fields:
- id
- name
- email
- password_hash or auth_provider_id
- created_at
- updated_at

### 15.2 BaseResume
Fields:
- id
- user_id
- title
- source_file_url
- source_file_type
- parsed_resume_json
- created_at
- updated_at

### 15.3 JobApplication
Fields:
- id
- user_id
- base_resume_id
- company_name
- role_title
- location
- job_url
- raw_job_text
- parsed_job_json
- current_status
- created_at
- updated_at

### 15.4 ApplicationDocument
Fields:
- id
- application_id
- document_type
  - tailored_resume
  - cover_letter
  - email_draft
  - assessment_notes
  - interview_prep
- version
- title
- storage_url
- text_content
- metadata_json
- created_at

### 15.5 ApplicationTimelineEvent
Fields:
- id
- application_id
- event_type
  - created
  - status_changed
  - document_generated
  - assessment_added
  - interview_prep_generated
- old_value
- new_value
- note
- created_at

### 15.6 AssessmentRecord
Fields:
- id
- application_id
- source_text
- source_file_url
- analysis_json
- due_date
- created_at
- updated_at

### 15.7 InterviewPrepRecord
Fields:
- id
- application_id
- interview_stage
- generated_questions_json
- preparation_notes
- created_at
- updated_at

---

## 16. Suggested Folder / Workspace Logic

Although the user experience can present a “folder” metaphor, the backend should treat each job as a structured record rather than a raw filesystem directory.

Each application workspace should contain:
- Job Details
- Documents
- Timeline
- Notes
- Assessment
- Interview Prep

Frontend may visually display:
- Company / Role card
- Sub-tabs or sections
- Generated assets grouped by type and version

---

## 17. AI Workflow Specifications

### 17.1 Job Parsing Workflow
Input:
- raw job text or page content

Output:
- structured job JSON

Steps:
1. Clean source text
2. Extract role metadata
3. Identify responsibilities and requirements
4. Detect application method
5. Extract key skills and keywords
6. Return normalized structure

### 17.2 Resume Parsing Workflow
Input:
- uploaded resume file

Output:
- structured resume JSON

Steps:
1. Extract plain text from file
2. Segment into sections
3. Identify education, experience, projects, skills
4. Normalize into structured format

### 17.3 Resume Tailoring Workflow
Input:
- parsed base resume
- parsed job description

Output:
- tailored resume text and exportable file

Rules:
- preserve factual truth
- prioritize relevant points
- improve wording and role alignment
- do not fabricate content

### 17.4 Cover Letter Workflow
Input:
- parsed resume
- parsed job description

Output:
- customized cover letter

### 17.5 Email Draft Workflow
Input:
- parsed job description
- tailored document references

Output:
- email subject
- email body
- attachment suggestions

### 17.6 Assessment Analysis Workflow
Input:
- pasted text or uploaded file

Output:
- summary,
- expected deliverables,
- evaluation criteria guess,
- action plan,
- checklist

### 17.7 Interview Prep Workflow
Input:
- job application record
- parsed job description
- tailored resume

Output:
- likely questions,
- categorized prep list,
- key talking points

---

## 18. API Surface (Suggested)

### 18.1 Auth
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- GET /auth/me

### 18.2 Resumes
- POST /resumes/upload
- GET /resumes
- GET /resumes/{id}
- DELETE /resumes/{id}

### 18.3 Job Applications
- POST /applications
- GET /applications
- GET /applications/{id}
- PATCH /applications/{id}
- PATCH /applications/{id}/status

### 18.4 Documents
- POST /applications/{id}/generate-resume
- POST /applications/{id}/generate-cover-letter
- POST /applications/{id}/generate-email
- GET /applications/{id}/documents

### 18.5 Assessment
- POST /applications/{id}/assessment/analyze
- GET /applications/{id}/assessment

### 18.6 Interview Prep
- POST /applications/{id}/interview-prep/generate
- GET /applications/{id}/interview-prep

### 18.7 Dashboard
- GET /dashboard/summary

---

## 19. UX / Screen Plan

### 19.1 Dashboard
Displays:
- total applications
- by-status counts
- recent applications
- upcoming tasks
- recent timeline events

### 19.2 Resume Management
Displays:
- uploaded base resumes
- upload button
- set default resume
- delete or replace

### 19.3 New Application Page
Inputs:
- job text
- optional job URL
- optional company and role
- base resume selector

Actions:
- parse job
- generate materials
- create workspace

### 19.4 Application Detail Page
Sections:
- Job Info
- Tailored Resume
- Cover Letter
- Email Draft
- Status Timeline
- Notes
- Assessment
- Interview Prep

### 19.5 Tracker Page
Displays:
- all applications in table/list
- filters by status
- search by company or role
- quick status update

---

## 20. MVP Development Plan

## 20.1 Phase 0 — Planning and Foundation
Tasks:
- finalize scope
- define data model
- choose stack
- create repo
- create deployment environments
- define AI prompt contracts and guardrails

Deliverables:
- architecture diagram
- schema draft
- API spec draft
- UI wireframe draft

## 20.2 Phase 1 — Core Backend and Auth
Tasks:
- set up backend service
- set up database
- implement auth
- implement base entities
- implement file upload pipeline

Deliverables:
- working auth
- database migrations
- resume upload endpoint
- application CRUD endpoints

## 20.3 Phase 2 — Resume and Job Parsing
Tasks:
- document parsing for PDF/DOCX
- resume normalization pipeline
- job text parsing pipeline
- structured JSON output design

Deliverables:
- resume parser working
- job parser working
- internal parsed JSON models

## 20.4 Phase 3 — AI Material Generation
Tasks:
- tailored resume generation
- cover letter generation
- email draft generation
- document save and versioning

Deliverables:
- end-to-end generation flow
- saved generated documents per application

## 20.5 Phase 4 — Frontend Application Management
Tasks:
- dashboard page
- new application flow
- application detail page
- status updates
- tracker page

Deliverables:
- complete user-facing MVP flow

## 20.6 Phase 5 — Assessment and Interview Support
Tasks:
- assessment text input and analysis
- interview prep generation
- workspace section integration

Deliverables:
- enhanced post-application workflow

## 20.7 Phase 6 — Polish and Deployment
Tasks:
- responsive design improvements
- error states
- loading states
- export improvements
- security review
- deploy production version

Deliverables:
- production-ready MVP release candidate

---

## 21. Suggested Sprint Breakdown

### Sprint 1
- auth
- database schema
- file upload
- basic frontend shell

### Sprint 2
- base resume parsing
- job description input and parsing
- application creation flow

### Sprint 3
- resume generation
- cover letter generation
- email draft generation

### Sprint 4
- application detail page
- status timeline
- tracker dashboard

### Sprint 5
- assessment analysis
- interview prep
- polishing and QA

---

## 22. Acceptance Criteria for MVP

The MVP is successful if a user can:
1. Create an account and sign in.
2. Upload a base resume.
3. Paste a job description.
4. Generate a tailored resume.
5. Generate a cover letter.
6. Generate an email draft when relevant.
7. Save all generated materials in a job-specific workspace.
8. Update the application status.
9. View application statistics in a dashboard.
10. Access the same data from phone and desktop browser.

---

## 23. Risks and Mitigations

### 23.1 AI Hallucination Risk
Risk:
- The system may generate false claims in resumes or letters.

Mitigation:
- Use source-grounded generation only.
- Add validation rules.
- Add strong prompt constraints.
- Show user warning to review before use.

### 23.2 Job Parsing Inconsistency
Risk:
- Job descriptions vary widely across websites.

Mitigation:
- Prioritize pasted text in MVP.
- Use optional manual correction fields.
- Add URL scraping later with fallback.

### 23.3 Resume Parsing Errors
Risk:
- PDF/DOCX extraction may misread formatting.

Mitigation:
- Normalize into internal sections.
- Allow user edit/correction.
- Start with simpler templates.

### 23.4 Scope Creep
Risk:
- Too many features delay launch.

Mitigation:
- Strict MVP definition.
- Defer mock interviews, browser extensions, and native mobile apps.

### 23.5 Privacy Risk
Risk:
- Sensitive personal data is stored.

Mitigation:
- Enforce access control.
- Encrypt sensitive storage where appropriate.
- Publish privacy expectations clearly.

---

## 24. Recommended Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- FastAPI
- Python

### Database
- PostgreSQL

### Storage
- Supabase Storage or S3-compatible storage

### Auth
- Supabase Auth or Clerk

### Hosting
- Vercel for frontend
- Railway / Render / Fly.io for backend and database

### AI / Parsing
- LLM provider API
- Resume parsing utilities
- PDF/DOCX text extraction libraries

---

## 25. Future Expansion Ideas

- Browser extension to import jobs from LinkedIn, Greenhouse, Lever
- Gmail integration for application email drafting and follow-ups
- Calendar integration for interviews and deadlines
- Auto-reminders and follow-up suggestions
- Role-specific resume templates
- Voice-based interview practice
- Offer comparison workspace
- Analytics by role type, location, and company category

---

## 26. Build Order Recommendation

If only one version is built initially, build in this order:
1. Auth
2. Resume upload and parsing
3. Job text input and parsing
4. Resume and cover letter generation
5. Workspace and status tracking
6. Dashboard
7. Assessment and interview preparation

This order ensures the product reaches user-visible value quickly.

---

## 27. Final Summary

The product should begin as a responsive web application that supports the highest-value workflow:
- upload resume,
- paste job description,
- generate tailored application materials,
- save everything in a job-specific workspace,
- track progress.

This MVP is realistic, valuable, and expandable. After launch, the strongest next features are URL job import, assessment analysis, interview preparation, reminders, and advanced AI assistance.

