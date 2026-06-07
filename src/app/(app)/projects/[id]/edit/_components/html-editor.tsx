"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Save, Download, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProjectHtml } from "../../../actions";

type Props = {
  projectId: string;
  initialHtml: string;
  initialCss: string;
};

type Tab = "html" | "css";

export function HtmlEditor({ projectId, initialHtml, initialCss }: Props) {
  const [tab, setTab] = useState<Tab>("html");
  const [html, setHtml] = useState(initialHtml);
  const [css, setCss] = useState(initialCss);
  const [savedHtml, setSavedHtml] = useState(initialHtml);
  const [savedCss, setSavedCss] = useState(initialCss);
  const [pending, start] = useTransition();

  const dirty = html !== savedHtml || css !== savedCss;
  const lineCount = useMemo(
    () => (tab === "html" ? html : css).split("\n").length,
    [tab, html, css],
  );
  const sizeKb = useMemo(
    () => (new Blob([tab === "html" ? html : css]).size / 1024).toFixed(1),
    [tab, html, css],
  );

  const srcDoc = useMemo(() => {
    if (!css) return html;
    if (/href="style\.css"/i.test(html)) {
      return html.replace(
        /<link[^>]+href="style\.css"[^>]*>/i,
        `<style>${css}</style>`,
      );
    }
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `<style>${css}</style>\n</head>`);
    }
    return `<style>${css}</style>` + html;
  }, [html, css]);

  const onSave = () => {
    start(async () => {
      const res = await updateProjectHtml(projectId, { html, css });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSavedHtml(html);
      setSavedCss(css);
      toast.success("Kaydedildi");
    });
  };

  const onReset = () => {
    if (!dirty) return;
    if (
      confirm(
        "Kaydedilmemiş değişiklikleri atıp son kayıtlı sürüme dönülsün mü?",
      )
    ) {
      setHtml(savedHtml);
      setCss(savedCss);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{lineCount} satır</span>
          <span>·</span>
          <span>{sizeKb} KB</span>
          {dirty && (
            <>
              <span>·</span>
              <span className="font-medium text-amber-500">
                kaydedilmemiş değişiklikler
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
          >
            <a
              href={`/preview/${projectId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" /> Yeni sekmede aç
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`/api/preview/${projectId}/download`}>
              <Download className="size-4" /> ZIP indir
            </a>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={!dirty}
          >
            <RotateCcw className="size-4" /> Geri al
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || pending}>
            <Save className="size-4" /> {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-[#0b0b0d]">
          <div className="flex items-center justify-between border-b px-2 py-1">
            <div className="flex">
              <button
                type="button"
                onClick={() => setTab("html")}
                className={
                  "rounded-md px-3 py-1 text-xs font-mono " +
                  (tab === "html"
                    ? "bg-muted/40 text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                index.html
              </button>
              <button
                type="button"
                onClick={() => setTab("css")}
                className={
                  "rounded-md px-3 py-1 text-xs font-mono " +
                  (tab === "css"
                    ? "bg-muted/40 text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                style.css
              </button>
            </div>
            <span className="px-2 text-[10px] text-muted-foreground">
              {tab === "html" ? "HTML" : "CSS"}
            </span>
          </div>
          {tab === "html" ? (
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
              className="block h-[70vh] w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-emerald-200 outline-none"
            />
          ) : (
            <textarea
              value={css}
              onChange={(e) => setCss(e.target.value)}
              spellCheck={false}
              className="block h-[70vh] w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-sky-200 outline-none"
            />
          )}
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            Canlı önizleme (kaydetmeden)
          </div>
          <iframe
            title="Canlı önizleme"
            srcDoc={srcDoc}
            sandbox="allow-same-origin"
            className="h-[70vh] w-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}
