# HireMe 技术总结

这份文档用于投简历、写项目经历、准备面试时参考。内容偏向“怎么把项目讲清楚”，不是完整技术文档。

## 项目一句话

HireMe 是一个 AI 求职申请助手，帮助用户上传基础简历、解析职位信息、生成定制简历/求职信/邮件草稿，并按职位维度管理申请进度、文档版本和面试准备材料。

## 技术栈

| 分类 | 使用技术 |
| --- | --- |
| 前端框架 | Next.js 16 App Router, React 19, TypeScript |
| 样式 | Tailwind CSS v4, 自定义全局样式 |
| 国际化 | next-intl，支持英文、中文、法文界面文案 |
| 后端能力 | Next.js Server Actions, Route Handlers, Server Components |
| 数据库/Auth | Supabase PostgreSQL, Supabase Auth, `@supabase/ssr` session cookies |
| 文件存储 | Supabase Storage，用于简历文件上传和读取 |
| AI 服务 | Google Gemini API 主 provider，GLM 可选 provider，Anthropic Claude 备用 provider |
| AI 输出校验 | Zod schema validation |
| 文档处理 | mammoth 解析 DOCX，unpdf 解析 PDF fallback，Gemini PDF understanding，docx/jspdf 导出 DOCX/PDF |
| 安全与稳定性 | Row Level Security, rate limiting, HTML sanitization, safe redirect handling |
| 测试与质量 | ESLint, Playwright E2E |
| 部署 | Vercel + Supabase managed cloud |

## 核心功能

- 用户注册、登录、会话管理和受保护页面访问。
- 上传 PDF、DOCX、TXT 简历，并抽取简历文本用于后续 AI 生成。
- 粘贴职位信息或职位链接，解析职位名称、公司、地点、要求和职责。
- 基于用户简历和职位信息生成定制求职材料，包括简历、求职信和申请邮件。
- 为每个职位创建独立 workspace，集中管理职位详情、生成文档、时间线和申请状态。
- 支持生成面试准备内容，例如面试问题、回答要点、公司/职位匹配分析。
- 支持文档预览、保存版本、导出 PDF/DOCX。
- 支持多语言界面和本地化状态文案。

## 架构亮点

- 使用 Next.js App Router 将页面、API 路由和 server actions 统一在一个 TypeScript 项目内，减少前后端接口胶水代码。
- 使用 Supabase Auth + SSR session cookies 实现服务端鉴权，保护 dashboard、applications、resumes 等用户私有页面。
- 使用 Supabase PostgreSQL + RLS 保护用户数据隔离，避免跨用户访问简历、职位申请和生成文档。
- 使用 provider abstraction 封装 AI 调用，支持 Gemini 作为主模型，同时保留 GLM 和 Anthropic 作为备用/实验 provider。
- 使用 Zod 对 AI JSON 输出做结构化校验，降低生成内容格式不稳定带来的运行时风险。
- 为 AI 生成记录 provider、model 和 prompt version，方便排查输出质量和后续审计。
- 文档生成接口包含 rate limiting 和超时处理，降低 API 滥用和长请求阻塞风险。
- 使用 Supabase migrations 管理数据库 schema、RLS policy、storage 和 beta access gate。

## 可以写进简历的 Bullet Points

下面这些可以按目标岗位挑选使用。

- Built an AI-powered job application assistant with Next.js 16, React 19, TypeScript, Supabase, and Gemini API to generate tailored resumes, cover letters, email drafts, and interview preparation materials.
- Designed a secure multi-tenant data model with Supabase PostgreSQL, Auth, Storage, and Row Level Security to isolate user resumes, applications, generated documents, and activity timelines.
- Implemented an AI provider abstraction supporting Gemini, GLM, and Anthropic fallback paths, with prompt versioning, model audit metadata, timeout handling, and retryable failure handling.
- Added structured AI output validation using Zod to make job parsing, resume tailoring, email drafts, and interview preparation more reliable in production workflows.
- Built resume ingestion for PDF, DOCX, and TXT files using Gemini PDF understanding, unpdf fallback extraction, and mammoth DOCX parsing.
- Developed a job-specific workspace UI for tracking application status, generated document versions, interview prep, and export workflows.
- Implemented PDF and DOCX export using jsPDF and docx so users can download generated application materials in common recruiter-facing formats.
- Added internationalization with next-intl across English, Chinese, and French, including localized app navigation, statuses, forms, and workspace content.
- Improved application reliability with server-side authentication, request rate limiting, HTML sanitization, safe redirects, ESLint, and Playwright E2E tests.
- Deployed the full-stack application on Vercel with Supabase managed services for authentication, database, and file storage.

## 中文简历写法参考

- 基于 Next.js 16、React 19、TypeScript 和 Supabase 开发 AI 求职申请助手，支持简历上传、职位解析、定制简历/求职信/邮件生成和申请进度管理。
- 设计并实现基于 Supabase PostgreSQL、Auth、Storage 和 RLS 的多租户数据模型，保障用户简历、申请记录和生成文档的数据隔离。
- 封装 Gemini、GLM、Anthropic 多 AI provider 调用链，支持模型切换、fallback、prompt version 审计、超时和错误处理。
- 使用 Zod 对 AI 结构化输出进行 schema 校验，提高职位解析、文档生成和面试准备内容的稳定性。
- 实现 PDF/DOCX/TXT 简历解析流程，结合 Gemini PDF 理解、unpdf fallback 和 mammoth DOCX 解析提取文本。
- 构建职位级 workspace，集中展示职位信息、申请状态、文档版本、时间线和面试准备内容。
- 支持生成材料导出为 PDF/DOCX，方便用户直接用于真实求职流程。
- 使用 next-intl 实现英文、中文、法文多语言界面，覆盖导航、表单、状态和工作区文案。
- 加入服务端鉴权、请求限流、HTML 清洗、安全跳转和 Playwright E2E 测试，提高应用安全性和可靠性。

## 面试时可以这样讲

### 1. 为什么做这个项目

我发现求职过程中最重复的部分是根据不同职位修改简历、写求职信、记录申请状态和准备面试。HireMe 的目标是把这些分散流程整合到一个职位级 workspace 里，让用户围绕每个 job application 管理材料、状态和 AI 生成内容。

### 2. 技术选型怎么解释

我选择 Next.js App Router 是因为这个项目既有复杂前端交互，也有很多服务端动作，例如鉴权、文件处理、AI 调用和数据库写入。App Router + Server Actions 可以让我把这些逻辑保持在同一个 TypeScript codebase 里。

Supabase 负责 Auth、PostgreSQL 和 Storage，这样可以快速搭建用户系统、数据库权限和文件上传能力。AI provider 层没有直接写死单一模型，而是抽象出 Gemini/GLM/Anthropic 调用链，方便后续切换模型或处理 provider 不稳定的情况。

### 3. 项目里比较有技术含量的部分

比较有挑战的是 AI 输出稳定性和文件解析。AI 生成并不是普通 API，它可能返回格式不稳定的内容，所以我用 Zod 做 schema validation，并保存 prompt version、provider 和 model 信息，方便 debug 和后续追踪。

文件解析也不是只支持纯文本。项目支持 PDF、DOCX 和 TXT，其中 DOCX 用 mammoth 提取文本，PDF 优先用 Gemini 进行理解式提取，失败时 fallback 到 unpdf，保证用户上传不同格式简历时都能进入生成流程。

### 4. 安全性怎么讲

这个项目处理的是用户简历和求职数据，所以我重点做了用户隔离和服务端保护。Supabase RLS 用来限制用户只能访问自己的数据，Next.js server-side auth 用来保护页面和 actions。另外，生成接口加了 rate limiting，预览 HTML 做了 sanitization，跳转逻辑也做了 safe redirect 防护。

## 可强调的项目关键词

- Full-stack TypeScript application
- AI-powered document generation
- Multi-provider LLM integration
- Prompt/version auditability
- Structured AI output validation
- Server-side authentication
- Supabase RLS and Storage
- Resume parsing pipeline
- PDF/DOCX export
- Internationalized product UI
- Vercel deployment
- Playwright E2E testing

## GitHub/作品集简介

可以放在 GitHub README 或 portfolio 里：

> HireMe is a full-stack AI job application assistant built with Next.js, React, TypeScript, Supabase, and Gemini API. It helps users upload resumes, parse job descriptions, generate tailored application materials, track job-specific workflows, and prepare for interviews in a secure multi-language workspace.

