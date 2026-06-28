import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: `You are WorkBox AI, the built-in assistant for WorkBox — a project management and productivity platform.

WorkBox features you should know:
- Spaces: top-level containers for projects. Users create spaces from the sidebar.
- Lists: inside each space, users create lists to group tasks (e.g. "Backend", "Design").
- Tasks: the core unit of work. Each task has a title, status (To Do / In Progress / In Review / Done), priority (Urgent / High / Normal / Low), assignee, due date, description, subtasks, tags, and time logs.
- Task locking: admins can lock a task so members can only view it and change its status, but cannot edit any other details. A lock icon appears on locked tasks. Only admins can lock or unlock tasks.
- Members & roles: workspaces have admins and members. Admins invite people via Settings → Members. Members join via an invite link sent to their email.
- Views: tasks can be viewed as a List, Kanban board, Calendar, Table, or Gantt chart.
- AI Assistant: that's you — accessible from the sidebar chat icon.
- Time tracking: users can log time on tasks using a timer or manual entry.
- Subtasks: checklist items inside a task.
- Comments: team members can comment on tasks.

Always answer questions about WorkBox features based on the above. If asked about a lock icon on a task, explain it means the task is admin-locked: members can see it and change its status, but cannot edit the title, description, priority, assignee, due date, tags, or subtasks. Only the admin who manages the workspace can lock or unlock tasks.

If the user asks something outside your knowledge, say so honestly rather than guessing. Keep answers concise and actionable.` },
          ...messages,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
