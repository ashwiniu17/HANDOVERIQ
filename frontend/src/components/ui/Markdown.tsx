import type { ReactNode } from "react";
import { cn } from "./cn";

/** **bold** and `code` inside one line of text. Built as React elements, never as HTML. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    nodes.push(
      token.startsWith("**") ? (
        <strong key={key++} className="font-semibold">{token.slice(2, -2)}</strong>
      ) : (
        <code key={key++} className="rounded bg-ink/[0.07] px-1 py-0.5 font-mono text-[0.85em]">{token.slice(1, -1)}</code>
      )
    );
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block = { type: "p"; text: string } | { type: "ul"; items: string[] } | { type: "ol"; items: string[] };

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.type === "ol") last.items.push(numbered[1]);
      else blocks.push({ type: "ol", items: [numbered[1]] });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

/** Displays a handover section: paragraphs, bullet and numbered lists. */
export function Markdown({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-ink", className)}>
      {blocks.map((block, i) =>
        block.type === "p" ? (
          <p key={i}>{inline(block.text)}</p>
        ) : block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-muted">
            {block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-muted">
            {block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
          </ol>
        )
      )}
    </div>
  );
}
