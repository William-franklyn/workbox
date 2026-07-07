import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import FormClient from "./FormClient";

interface FormField {
  id: string;
  type: "text" | "textarea" | "email" | "phone" | "number" | "select" | "radio" | "checkbox" | "date" | "rating" | "heading";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  maps_to?: "title" | "description" | null;
}

interface PublicForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

async function getForm(id: string): Promise<PublicForm | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("forms")
      .select("id, name, description, fields, active")
      .eq("id", id)
      .maybeSingle();
    if (error || !data || !data.active) return null;
    return data as PublicForm;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const form = await getForm(id);
  return {
    title: form ? `${form.name} — WorkBox` : "Form — WorkBox",
    description: form?.description ?? "Fill out this form to submit your request.",
  };
}

export default async function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await getForm(id);

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* Top bar */}
      <div
        className="border-b px-6 py-4 flex items-center gap-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white"
          style={{ background: "var(--accent-purple)" }}
        >
          W
        </div>
        <span className="font-bold" style={{ color: "var(--text-primary)" }}>WorkBox</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div
          className="w-full max-w-lg rounded-2xl border p-8 shadow-xl"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          {!form ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">😕</div>
              <h1 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Form not found</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This form may have been removed or is no longer active.
              </p>
            </div>
          ) : (
            <>
              {/* Form header */}
              <div className="mb-7">
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{form.name}</h1>
                {form.description && (
                  <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{form.description}</p>
                )}
              </div>

              {/* Form fields (client component for interactivity) */}
              <FormClient form={form} />
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="text-center py-4 text-xs border-t"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        Powered by{" "}
        <span className="font-semibold" style={{ color: "var(--accent-purple)" }}>WorkBox</span>
      </div>
    </main>
  );
}
