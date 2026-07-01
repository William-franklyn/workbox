import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  maps_to?: "title" | "description" | null;
}

// Public — no auth needed
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = createServiceClient();

  // Fetch form
  const { data: form, error: formErr } = await svc.from("forms")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (formErr) return NextResponse.json({ error: formErr.message }, { status: 400 });
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (!form.active) return NextResponse.json({ error: "Form is not active" }, { status: 410 });

  const body = await req.json();
  const submissionData: Record<string, unknown> = body.data ?? {};
  const submitterEmail: string | undefined = body.submitter_email;

  const fields: FormField[] = Array.isArray(form.fields) ? form.fields : [];

  // Validate required fields
  const missing: string[] = [];
  for (const field of fields) {
    if (field.required) {
      const val = submissionData[field.id];
      if (val === undefined || val === null || val === "" || val === false) {
        missing.push(field.label);
      }
    }
  }
  if (missing.length > 0) {
    return NextResponse.json({ error: `Required fields missing: ${missing.join(", ")}` }, { status: 422 });
  }

  // Build task title and description from mapped fields
  let taskTitle: string | null = null;
  let taskDescription: string | null = null;

  for (const field of fields) {
    const val = submissionData[field.id];
    if (field.maps_to === "title" && val !== undefined && val !== null) {
      taskTitle = String(val);
    }
    if (field.maps_to === "description" && val !== undefined && val !== null) {
      taskDescription = String(val);
    }
  }

  if (!taskTitle) {
    taskTitle = `${form.name} — ${new Date().toLocaleString()}`;
  }

  // Create task if target_list_id is set
  let taskId: string | null = null;
  if (form.target_list_id) {
    const { data: task, error: taskErr } = await svc.from("tasks").insert({
      id: `tsk${Date.now()}${Math.floor(Math.random() * 1000)}`,
      title: taskTitle,
      description: taskDescription ?? null,
      list_id: form.target_list_id,
      status: form.default_status ?? "todo",
      priority: form.default_priority ?? "normal",
      position: Date.now(),
    }).select("id").single();

    if (taskErr) {
      console.error("Task creation failed:", taskErr.message);
    } else {
      taskId = task.id;
    }
  }

  // Save submission
  const { data: submission, error: subErr } = await svc.from("form_submissions").insert({
    id: `fsub${Date.now()}${Math.floor(Math.random() * 1000)}`,
    form_id: id,
    data: submissionData,
    task_id: taskId,
    submitter_email: submitterEmail ?? null,
  }).select("id").single();

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 400 });
  }

  // Increment submissions_count
  await svc
    .from("forms")
    .update({ submissions_count: (form.submissions_count ?? 0) + 1 })
    .eq("id", id);

  return NextResponse.json({ success: true, task_id: taskId, submission_id: submission.id });
}
