"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, BookOpen, Folder, FolderPlus, Trash2, Edit3,
  Eye, EyeOff, X, Loader2, ChevronRight, Sparkles, Tag,
  Clock, User, Hash, Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KBCategory { id: string; name: string; icon: string; parent_id: string | null; position: number; }
interface KBArticle {
  id: string; title: string; summary?: string; content?: string;
  category_id?: string | null; tags: string[]; published: boolean;
  views: number; author_name?: string; created_at: string; updated_at: string;
}

// ─── Markdown renderer ─────���─────────────────────────────���────────────────────

function renderMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:#D0E8F5;margin:20px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;color:#EAF4FF;margin:24px 0 10px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;color:#EAF4FF;margin:24px 0 12px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#D0E8F5;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#A0C4DC">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/^```[\s\S]*?```/gm, (m) => `<pre style="background:rgba(255,255,255,0.05);padding:12px;border-radius:6px;font-size:12px;font-family:monospace;overflow-x:auto;margin:12px 0">${m.slice(3, -3).replace(/^[\w]*\n/, "")}</pre>`)
    .replace(/^\- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul style="list-style:disc;padding-left:20px;margin:8px 0">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #3D6E8C;padding-left:12px;color:#7AACC8;margin:8px 0">$1</blockquote>')
    .replace(/\n\n/g, '</p><p style="margin-bottom:12px">')
    .replace(/^(?!<[h|u|b|p|c|l])(.+)$/gm, (m) => m ? `<p style="margin-bottom:8px">${m}</p>` : "");
}

// ─── AI Q&A ──────────────────────────────────────────────────────────────────

function AIPanel({ articles }: { articles: KBArticle[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    const context = articles.slice(0, 20).map(a => `**${a.title}**\n${a.summary ?? ""}`).join("\n\n");
    try {
      const res = await fetch("/api/ai/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          context: `You are a knowledge base assistant. Answer using only the following articles:\n\n${context}\n\nIf the answer is not in the articles, say so clearly.`,
        }),
      });
      const d = await res.json();
      setAnswer(d.reply ?? d.message ?? "No answer available.");
    } catch { setAnswer("Failed to get answer. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={13} style={{ color: "var(--text-primary)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Ask AI about this knowledge base</span>
      </div>
      <div className="flex gap-2">
        <input value={question} onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="e.g. How do I submit a leave request?"
          className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
          style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
        <button onClick={ask} disabled={loading || !question.trim()}
          className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#fff" }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : "Ask"}
        </button>
      </div>
      {answer && (
        <div className="mt-3 p-3 rounded-lg text-xs leading-relaxed"
          style={{ background: "rgba(255,255,255,0.04)", borderLeft: "2px solid var(--accent-purple)", color: "var(--text-primary)" }}>
          {answer}
        </div>
      )}
    </div>
  );
}

// ─── Article Editor ───────────────────────────────────────────────────────────

function ArticleEditor({ article, categories, onSave, onClose }: {
  article: KBArticle | null;
  categories: KBCategory[];
  onSave: (a: KBArticle) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [categoryId, setCategoryId] = useState(article?.category_id ?? "");
  const [tags, setTags] = useState((article?.tags ?? []).join(", "));
  const [published, setPublished] = useState(article?.published ?? true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  async function generateSummary() {
    if (!content.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Write a 1-2 sentence summary of this article: ${content.slice(0, 1000)}`,
          context: "You summarize article content. Reply with ONLY the summary, no preamble.",
        }),
      });
      const d = await res.json();
      setSummary(d.reply ?? d.message ?? "");
    } finally { setAiLoading(false); }
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title, content, summary,
        category_id: categoryId || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        published,
      };
      const res = await fetch("/api/knowledge", {
        method: article ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(article ? { id: article.id, ...body } : body),
      });
      const saved = await res.json();
      onSave(saved);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 border-b z-10"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Article title..."
          className="text-lg font-bold outline-none bg-transparent flex-1"
          style={{ color: "var(--text-primary)" }} />
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Eye size={12} /> {preview ? "Edit" : "Preview"}
          </button>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
            Published
          </label>
          <button onClick={save} disabled={saving || !title.trim()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            style={{ background: "var(--accent-purple)", color: "#fff" }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex w-full pt-12">
        {/* Sidebar meta */}
        <div className="w-56 shrink-0 border-r p-4 space-y-4 overflow-y-auto"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-secondary)" }}>Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border outline-none"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-secondary)" }}>Tags (comma-separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="hr, policy, onboarding"
              className="w-full text-xs px-2.5 py-2 rounded-lg border outline-none"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Summary</label>
              <button onClick={generateSummary} disabled={aiLoading || !content.trim()}
                className="text-xs flex items-center gap-1 disabled:opacity-40"
                style={{ color: "var(--accent-purple)" }}>
                {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} AI
              </button>
            </div>
            <textarea value={summary} onChange={e => setSummary(e.target.value)}
              placeholder="Brief description shown in article list..."
              rows={3}
              className="w-full text-xs px-2.5 py-2 rounded-lg border outline-none resize-none"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
            <p className="font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Markdown guide</p>
            <p># Heading 1</p>
            <p>## Heading 2</p>
            <p>**bold** *italic*</p>
            <p>`inline code`</p>
            <p>- list item</p>
            <p>&gt; blockquote</p>
          </div>
        </div>

        {/* Editor / Preview */}
        <div className="flex-1 overflow-auto">
          {preview ? (
            <div className="p-8 max-w-3xl mx-auto prose" style={{ color: "var(--text-primary)" }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#EAF4FF", marginBottom: 8, letterSpacing: "-0.02em" }}>{title || "Untitled"}</h1>
              {summary && <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 15 }}>{summary}</p>}
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={"# Article Title\n\nStart writing your article here...\n\nUse **bold**, *italic*, `code`, and ## headings to structure your content.\n\n## Section\n\nYour content here..."}
              className="w-full h-full p-8 outline-none resize-none font-mono text-sm leading-relaxed"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────��─────────────────────────────────────────────────

export default function KnowledgePage() {
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [allArticles, setAllArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<KBArticle | null | "new">(null);
  const [viewing, setViewing] = useState<KBArticle | null>(null);
  const [viewContent, setViewContent] = useState("");
  const [viewLoading, setViewLoading] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📁");

  const loadCategories = useCallback(() => {
    fetch("/api/knowledge?type=categories").then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  }, []);

  const loadArticles = useCallback((catId?: string | null, q?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (catId) params.set("category", catId);
    if (q) params.set("search", q);
    fetch(`/api/knowledge?${params}`).then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : [];
      setArticles(list);
      if (!catId && !q) setAllArticles(list);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCategories(); loadArticles(); }, [loadCategories, loadArticles]);

  useEffect(() => {
    const t = setTimeout(() => loadArticles(activeCategory, search), 300);
    return () => clearTimeout(t);
  }, [search, activeCategory, loadArticles]);

  async function viewArticle(a: KBArticle) {
    setViewing(a);
    setViewLoading(true);
    setViewContent("");
    const res = await fetch(`/api/knowledge/article?id=${a.id}`);
    const d = await res.json();
    setViewContent(d.content ?? "");
    setViewLoading(false);
  }

  function handleSaved(saved: KBArticle) {
    setArticles(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [saved, ...prev];
    });
    setAllArticles(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [saved, ...prev];
    });
    setEditing(null);
  }

  async function deleteArticle(id: string) {
    if (!confirm("Delete this article?")) return;
    setArticles(p => p.filter(a => a.id !== id));
    setAllArticles(p => p.filter(a => a.id !== id));
    if (viewing?.id === id) setViewing(null);
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: newCatName, icon: newCatIcon }),
    });
    const cat = await res.json();
    setCategories(p => [...p, cat]);
    setNewCatName(""); setNewCatIcon("📁"); setShowCatForm(false);
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete category? Articles will be uncategorized.")) return;
    setCategories(p => p.filter(c => c.id !== id));
    await fetch(`/api/knowledge?id=${id}&type=category`, { method: "DELETE" });
  }

  const totalArticles = allArticles.length;
  const publishedCount = allArticles.filter(a => a.published).length;

  if (editing !== null) {
    return (
      <ArticleEditor
        article={editing === "new" ? null : editing}
        categories={categories}
        onSave={handleSaved}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r flex flex-col overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} style={{ color: "var(--text-primary)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Knowledge Base</span>
          </div>
          <div className="text-xs space-y-0.5" style={{ color: "var(--text-secondary)" }}>
            <span>{totalArticles} articles · {publishedCount} published</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            onClick={() => { setActiveCategory(null); loadArticles(null, search); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors"
            style={{ background: !activeCategory ? "var(--bg-active)" : "transparent", color: !activeCategory ? "var(--text-primary)" : "var(--text-secondary)" }}>
            <Hash size={13} /> All articles
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{totalArticles}</span>
          </button>
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center group">
              <button
                onClick={() => { setActiveCategory(cat.id); loadArticles(cat.id, search); }}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors"
                style={{ background: activeCategory === cat.id ? "var(--bg-active)" : "transparent", color: activeCategory === cat.id ? "var(--text-primary)" : "var(--text-secondary)" }}>
                <span className="text-base">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                  {allArticles.filter(a => a.category_id === cat.id).length}
                </span>
              </button>
              <button onClick={() => deleteCategory(cat.id)}
                className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded hover:bg-red-500/10 transition-opacity"
                style={{ color: "var(--danger)" }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Add category */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          {showCatForm ? (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                  className="w-9 text-center text-sm px-1 py-1.5 rounded border outline-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createCategory()}
                  placeholder="Category name"
                  className="flex-1 text-xs px-2 py-1.5 rounded border outline-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-1.5">
                <button onClick={createCategory}
                  className="flex-1 text-xs py-1.5 rounded font-medium"
                  style={{ background: "var(--accent-purple)", color: "#fff" }}>Add</button>
                <button onClick={() => setShowCatForm(false)}
                  className="flex-1 text-xs py-1.5 rounded"
                  style={{ color: "var(--text-secondary)", background: "var(--bg-primary)", border: "1px solid var(--border)" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCatForm(true)}
              className="w-full flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg hover:bg-white/10"
              style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
              <FolderPlus size={12} /> Add category
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search articles..."
              className="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg border outline-none"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-medium"
            style={{ background: "var(--accent-purple)", color: "#fff" }}>
            <Plus size={13} /> New Article
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Article list */}
          <div className="w-72 border-r flex flex-col overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
              ) : articles.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <BookOpen size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No articles yet</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Create your first article to build your team's knowledge base.</p>
                </div>
              ) : articles.map(a => (
                <div key={a.id}
                  onClick={() => viewArticle(a)}
                  className="px-4 py-3 border-b cursor-pointer transition-colors hover:bg-white/3"
                  style={{ borderColor: "var(--border)", background: viewing?.id === a.id ? "var(--bg-active)" : "transparent" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2 flex-1" style={{ color: "var(--text-primary)" }}>{a.title}</p>
                    {!a.published && (
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>Draft</span>
                    )}
                  </div>
                  {a.summary && <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{a.summary}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1"><Eye size={10} /> {a.views}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(a.updated_at).toLocaleDateString()}</span>
                    {a.tags?.length > 0 && (
                      <span className="flex items-center gap-1 truncate"><Tag size={10} /> {a.tags.slice(0, 2).join(", ")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* AI Q&A at bottom of list */}
            <div className="p-4 border-t shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <AIPanel articles={allArticles} />
            </div>
          </div>

          {/* Article viewer */}
          <div className="flex-1 overflow-y-auto">
            {!viewing ? (
              <div className="flex flex-col items-center justify-center h-full">
                <BookOpen size={40} style={{ color: "var(--text-muted)" }} className="mb-4" />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Select an article to read</p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <h1 className="text-2xl font-bold leading-tight" style={{ color: "#EAF4FF", letterSpacing: "-0.02em" }}>{viewing.title}</h1>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setEditing(viewing)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      <Edit3 size={12} /> Edit
                    </button>
                    <button onClick={() => deleteArticle(viewing.id)}
                      className="p-1.5 rounded hover:bg-red-500/10"
                      style={{ color: "var(--danger)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-6 pb-4 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  {viewing.author_name && <span className="flex items-center gap-1"><User size={11} />{viewing.author_name}</span>}
                  <span className="flex items-center gap-1"><Clock size={11} />{new Date(viewing.updated_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Eye size={11} />{viewing.views} views</span>
                  {!viewing.published && (
                    <span className="flex items-center gap-1"><EyeOff size={11} />Draft</span>
                  )}
                  {viewing.tags?.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>{t}</span>
                  ))}
                </div>

                {viewLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
                ) : (
                  <div className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(viewContent) || `<p style="color:var(--text-secondary)">No content yet. Click Edit to add content.</p>` }} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
