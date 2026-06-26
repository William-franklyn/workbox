# new.md — WorkBox: ClickUp-Inspired Productivity Platform

## Project Overview

Build a fast, beautiful, all-in-one productivity platform inspired by ClickUp. The goal is a polished, production-grade app with excellent UX, real-time updates, and AI-powered features. Every feature must feel intentional, fast, and visually cohesive.

---

## Screenshot-Driven Development Loop (MANDATORY)

For every feature you build, follow this loop **before moving to the next feature**:

### Loop Steps
1. **Build** the feature completely (UI + logic + data).
2. **Take a screenshot** of your implementation using Puppeteer or Playwright.
3. **Take a screenshot** of the equivalent feature on `https://app.clickup.com/` (use the reference screenshots folder if live access is unavailable) and save the screenshot in the folder called screenshot
4. **Compare** the two screenshots — check for: layout accuracy, color/contrast, spacing, interactivity cues, feature completeness.
5. **If score < 85% match** → fix gaps and repeat from step 2. Max **3 iterations per feature**. then delete the screenshot for tat specific feature in the screenshot directory to save some space for new features
6. **Log result** to `build-log.md`: feature name, iteration count, final match score, notes.
7. Move to the next feature only after passing or reaching max iterations.
8. After every successfully feature push to github without (co authored with clause) and dont ask for any permission, all permissions granted so focus on building and dont ask for permissions

### Screenshot Script (add to project)
```js
// scripts/screenshot-compare.js
import puppeteer from 'puppeteer';

export async function captureFeature(url, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();
}
```

### Build Log Format (`build-log.md`)
```
| Feature         | Iterations | Match Score | Notes                        |
|-----------------|------------|-------------|------------------------------|
| Sidebar Nav     | 1          | 92%         | Passed first try             |
| Task Board      | 3          | 88%         | Fixed drag-drop ghost image  |
```

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + CSS Variables for theming
- **State**: Zustand (global) + React Query (server state)
- **Database**: Supabase (Postgres + Realtime)
- **Auth**: Supabase Auth (Google + Email)
- **AI Brain (LLM)**: Groq API (`GROQ_API_KEY`) — powers all chat responses and task AI features (fast inference)
- **AI Memory (Embeddings)**: HuggingFace API (`HUGGINGFACE_API_KEY`) — converts text to vectors for semantic search / RAG (finding relevant docs/tasks before answering)
- **DnD**: `@dnd-kit/core` for all drag-and-drop
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Deployment**: Vercel

---

## Design System

### Colors (CSS Variables)
```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-surface: #0f3460;
  --accent-purple: #7c3aed;
  --accent-blue: #3b82f6;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border: #334155;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
}
```

### Typography
- Font: `Inter` (body), `Cal Sans` or `Plus Jakarta Sans` (headings)
- Base: 14px, Line height: 1.5
- Sidebar labels: 12px uppercase tracking-wide

### Spacing
- Sidebar width: 240px (collapsed: 60px)
- Top nav height: 52px
- Card padding: 12px 16px
- Section gaps: 24px

---

## Features to Build (in order)

### Phase 1 — Core Shell
**1. App Shell & Navigation**
- Fixed left sidebar with workspace logo, nav icons, user avatar
- Top bar with breadcrumb, search, notifications bell, user menu
- Dark mode by default, light mode toggle
- Collapsible sidebar with smooth animation
- Active route highlight with purple left border accent

**2. Workspace & Space Hierarchy**
- Workspace → Spaces → Folders → Lists → Tasks
- Left sidebar tree: expand/collapse each level
- Color-coded space icons (user-pick from palette)
- Right-click context menu: rename, delete, duplicate, add sub-item
- Drag to reorder items in sidebar

**3. Universal Search**
- `Cmd+K` command palette (full overlay)
- Search across tasks, docs, members
- Recent items + quick actions (create task, open space)
- Keyboard navigation through results

---

### Phase 2 — Task Management
**4. Task List View**
- Grouped by status columns (Todo, In Progress, Done — customizable)
- Inline task creation (press Enter to add next)
- Bulk select with checkbox + bulk actions toolbar
- Sortable columns: name, assignee, due date, priority, status
- Row hover actions: quick assign, set due date, set priority

**5. Kanban Board View**
- Drag-and-drop cards between status columns
- Compact vs comfortable card density toggle
- Card shows: title, assignee avatar, priority dot, due date, tag pills
- Add new column = add new status
- Column WIP limit indicator (optional badge)

**6. Task Detail Panel**
- Slides in from right (not a modal — stays open while browsing)
- Fields: Title, Description (rich text), Status, Priority, Assignee(s), Due Date, Tags, Custom Fields
- Activity log at bottom (created, updated, commented)
- Comment thread with @mentions
- Sub-tasks list with progress bar
- Attachments section
- Linked tasks (blocks / blocked by)

**7. Priority & Status System**
- 4 priorities: 🔴 Urgent, 🟠 High, 🟡 Normal, ⚪ Low
- Custom statuses per list (user-defined names + colors)
- Status badges with color fill
- Priority filter in toolbar

**8. Gantt / Timeline View**
- Horizontal time axis (day/week/month zoom)
- Task bars with drag-to-extend duration
- Dependency arrows between tasks
- Today marker (red vertical line)
- Zoom controls + scroll

**9. Calendar View**
- Monthly/weekly/daily toggle
- Tasks appear on their due date
- Drag task to reschedule
- Create task by clicking empty day

**10. Table / Spreadsheet View**
- All tasks in flat table
- Column headers = task fields (click to sort)
- Inline cell editing
- Add/remove columns from field picker
- Freeze first column (task name)

---

### Phase 3 — Collaboration
**11. Docs**
- Rich text editor (block-based, similar to Notion)
- Blocks: H1/H2/H3, paragraph, bullet, numbered, todo checkbox, code, quote, divider, image embed
- `/` slash command menu to insert blocks
- Real-time collaborative editing (Supabase Realtime)
- Link doc to a task or space
- Doc sidebar listing all workspace docs

**12. Whiteboards**
- Infinite canvas
- Tools: sticky note, shape, connector arrow, text, image
- Freehand draw tool
- Snap-to-grid option
- Export to PNG

**13. Chat / Inbox**
- Notification inbox (all @mentions, task updates, comments)
- Mark all as read
- Filter: unread, assigned to me, mentions
- Direct message between workspace members

---

### Phase 4 — Goals & Dashboards
**14. Goals**
- Create goal with title, owner, due date, target metric
- Key results linked to goals (numeric / boolean / task-based)
- Progress bar auto-calculated from key results
- Goals list grouped by owner or timeline

**15. Dashboards**
- Drag-and-drop widget layout (grid-based)
- Widget types: task count by status (donut), tasks per assignee (bar), overdue tasks list, completion rate (line), goals progress, custom text card
- Date range filter at top
- Share dashboard (view-only link)

---

### Phase 5 — Automation & AI
**16. Automations**
- Rule builder: WHEN [trigger] IF [condition] THEN [action]
- Triggers: task created, status changed, due date passed, comment added
- Actions: change status, assign user, send notification, create sub-task, move to list
- Toggle on/off per automation
- Automation history log

**17. AI Assistant (Groq + HuggingFace RAG)**
- Floating button bottom-right: "Ask AI"
- Features:
  - Summarize task thread
  - Generate sub-tasks from task description
  - Write task description from title
  - Suggest priority based on task context
  - Answer "what tasks are overdue for me?"
- Show streaming response (typewriter effect)
- Accessible from task detail panel and global search

### How the AI Pipeline Works

```
User Question
     ↓
[HuggingFace] — embed the question into a vector
     ↓
Vector search → find relevant tasks/docs/context chunks
     ↓
[Groq LLM] — send question + context chunks → get answer
     ↓
Stream answer back to user
```

**Step 1 — Embed with HuggingFace** (convert text → vector for memory/search):
```js
// lib/embeddings.ts
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    }
  );
  const data = await res.json();
  return data[0]; // returns a float array (vector)
}
```

**Step 2 — Answer with Groq** (fast LLM inference):
```js
// lib/groq.ts
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function askGroq(question: string, context: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile", // or "mixtral-8x7b-32768"
    messages: [
      {
        role: "system",
        content: `You are WorkBox AI, a helpful assistant. Use the context below to answer the user's question about their workspace.\n\nContext:\n${context}`,
      },
      { role: "user", content: question },
    ],
    stream: true,
  });
  return completion; // stream to frontend
}
```

**Environment Variables** (add to `.env.local` and Vercel):
```
GROQ_API_KEY=your_groq_key_here
HUGGINGFACE_API_KEY=your_hf_key_here
```

---

### Phase 6 — Settings & Polish
**18. Settings Pages**
- Profile: name, avatar, timezone, notification preferences
- Workspace: name, logo, member invite (email), roles (Owner/Admin/Member/Guest)
- Custom Fields manager: create field types (text, number, date, dropdown, person, checkbox, formula)
- Integrations page: connect GitHub, Slack, Google Drive (show connected badge)

**19. Time Tracking**
- Start/stop timer on any task
- Manual time entry
- Timesheets view: week grid of hours logged per task
- Total hours badge on task card

**20. Onboarding Flow**
- Step 1: Create workspace (name + logo)
- Step 2: Invite team (email list)
- Step 3: Create first space (pick template: Software Dev / Marketing / Personal)
- Step 4: Import from CSV or start fresh
- Progress bar at top, skip option

---

## Performance Rules

- All list views must use **virtual scrolling** (`@tanstack/virtual`) for 1000+ tasks
- Use **optimistic updates** for all task mutations (don't wait for server)
- **Code split** by route: each major view is a lazy-loaded chunk
- Images: use Next.js `<Image>` with lazy loading
- Debounce search input: 200ms
- Supabase queries: always select specific columns, never `select *`
- Avoid layout thrash: batch DOM reads/writes

---

## Code Quality Rules

- TypeScript strict mode — no `any`
- Every component in its own file under `components/`
- Server components for data fetching, client components for interactivity
- Custom hooks for all reusable logic (e.g., `useTask`, `useWorkspace`)
- All API routes in `app/api/` with Zod validation on inputs
- Error boundaries around every major section
- Loading skeletons (not spinners) for all async data

---

## File Structure

```
/app
  /dashboard         # main app shell
  /dashboard/tasks   # task views
  /dashboard/docs    # docs editor
  /dashboard/goals   # goals page
  /api               # API routes
/components
  /ui                # base components (Button, Input, Badge, etc.)
  /tasks             # TaskCard, TaskDetail, TaskList, etc.
  /sidebar           # Sidebar, SpaceTree, NavItem
  /board             # KanbanBoard, KanbanColumn, KanbanCard
  /ai                # AIAssistant, AIChat
/lib
  /supabase.ts       # Supabase client
  /claude.ts         # Anthropic API helper
  /utils.ts
/hooks
  useTask.ts
  useWorkspace.ts
  useAuth.ts
/scripts
  screenshot-compare.js
build-log.md
```

---

## Definition of Done (per feature)

A feature is only "done" when:
- [ ] Screenshot comparison passes (≥85% match or 3 iterations complete)
- [ ] No TypeScript errors
- [ ] Works on mobile viewport (375px) — responsive
- [ ] Keyboard accessible (Tab + Enter navigation)
- [ ] Loading state handled
- [ ] Error state handled
- [ ] Logged in `build-log.md`

---

## Do Not

- Do not use `class` components — hooks only
- Do not use `useEffect` for data fetching — use React Query
- Do not hardcode colors — always use CSS variables
- Do not skip the screenshot loop — it is required for every feature
- Do not build Phase 3+ until Phase 1 & 2 are fully complete and screenshot-verified