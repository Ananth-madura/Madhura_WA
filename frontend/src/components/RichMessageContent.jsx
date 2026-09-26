import React from "react";

/**
 * RichMessageContent — Renders rich Markdown & WhatsApp syntax inside chat bubbles.
 * Supports: Headers (#, ##, ###), Tables (| col | col |), Code blocks (```),
 * Bold (**x** or *x*), Italic (_x_), Strikethrough (~x~), Lists (- / 1.), Blockquotes (>),
 * and Clickable Links.
 */
function parseInline(text, isMe) {
  if (!text) return text;

  // Split text by markdown tokens and build React nodes
  const nodes = [];
  let remaining = text;
  let keyIdx = 0;

  // Match links: [label](url) or raw http(s):// URLs
  const linkRegex = /(?:\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s]+)/g;

  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(remaining)) !== null) {
    const textBefore = remaining.substring(lastIndex, match.index);
    if (textBefore) {
      nodes.push(...formatInlineText(textBefore, isMe, keyIdx));
      keyIdx += textBefore.length;
    }

    const label = match[1] || match[3];
    const url = match[2] || match[3];
    nodes.push(
      <a
        key={`link_${keyIdx++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline font-semibold hover:opacity-80 transition ${
          isMe ? "text-emerald-200" : "text-emerald-400"
        }`}
      >
        {label}
      </a>
    );

    lastIndex = linkRegex.lastIndex;
  }

  const remainingAfterLinks = remaining.substring(lastIndex);
  if (remainingAfterLinks) {
    nodes.push(...formatInlineText(remainingAfterLinks, isMe, keyIdx));
  }

  return nodes.length ? nodes : text;
}

function formatInlineText(text, isMe, baseKey) {
  // Simple regex-based inline formatter for bold, italic, strike, code
  const parts = [];
  let current = text;
  let k = baseKey;

  // Fenced inline code `code`
  const codeRegex = /`([^`]+)`/g;
  let lastIdx = 0;
  let m;

  while ((m = codeRegex.exec(current)) !== null) {
    const before = current.substring(lastIdx, m.index);
    if (before) parts.push(...formatStyles(before, isMe, k));
    k += (before || "").length;

    parts.push(
      <code
        key={`code_${k++}`}
        className="px-1.5 py-0.5 mx-0.5 rounded bg-black/25 font-mono text-[11px] text-emerald-300 border border-white/10"
      >
        {m[1]}
      </code>
    );
    lastIdx = codeRegex.lastIndex;
  }

  const rest = current.substring(lastIdx);
  if (rest) parts.push(...formatStyles(rest, isMe, k));

  return parts;
}

function formatStyles(text, isMe, baseKey) {
  // Handles **bold**, *bold*, _italic_, ~strikethrough~
  // Replaces tokens sequentially using DOM elements
  const tokens = [];
  // Tokenize bold **text** or *text*
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|~~[^~]+~~|~[^~]+~)/g;
  const parts = text.split(pattern);

  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      tokens.push(
        <strong key={`b_${baseKey}_${i}`} className="font-extrabold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("*") && part.endsWith("*")) {
      tokens.push(
        <strong key={`b1_${baseKey}_${i}`} className="font-bold text-white">
          {part.slice(1, -1)}
        </strong>
      );
    } else if (part.startsWith("_") && part.endsWith("_")) {
      tokens.push(
        <em key={`i_${baseKey}_${i}`} className="italic text-slate-100">
          {part.slice(1, -1)}
        </em>
      );
    } else if ((part.startsWith("~~") && part.endsWith("~~")) || (part.startsWith("~") && part.endsWith("~"))) {
      const inner = part.startsWith("~~") ? part.slice(2, -2) : part.slice(1, -1);
      tokens.push(
        <span key={`s_${baseKey}_${i}`} className="line-through opacity-75">
          {inner}
        </span>
      );
    } else {
      tokens.push(part);
    }
  });

  return tokens;
}

function renderTable(tableLines, isMe, tableIdx) {
  const rows = tableLines.map((line) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
  );
  if (rows.length < 2) return null;

  // Filter out separator row (e.g. |---|---|)
  const header = rows[0];
  const bodyRows = rows.slice(1).filter((r) => !r.every((cell) => /^[-:\s]+$/.test(cell)));

  return (
    <div key={`table_${tableIdx}`} className="my-2.5 overflow-x-auto rounded-xl border border-white/20 shadow-md">
      <table className="w-full text-left text-xs border-collapse">
        <thead className={isMe ? "bg-[#014739] text-white" : "bg-[#111b21] text-emerald-400"}>
          <tr>
            {header.map((col, cIdx) => (
              <th key={`th_${cIdx}`} className="px-3 py-2 border-b border-white/20 font-bold tracking-wide uppercase text-[10px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {bodyRows.map((row, rIdx) => (
            <tr key={`tr_${rIdx}`} className={rIdx % 2 === 0 ? "bg-black/10" : "bg-black/20"}>
              {row.map((cell, cIdx) => (
                <td key={`td_${rIdx}_${cIdx}`} className="px-3 py-2 text-white/90 font-normal">
                  {parseInline(cell, isMe)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RichMessageContent({ text, isMe = false }) {
  if (!text) return null;

  // Split into lines to parse Block elements (Code blocks, Tables, Headers, Blockquotes, Lists)
  const lines = text.split(/\r?\n/);
  const elements = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Multi-line Fenced Code Block (```code```)
    if (line.trim().startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={`codeblock_${keyCounter++}`}
          className="my-2 p-3 bg-black/40 rounded-xl font-mono text-xs text-emerald-300 border border-white/15 overflow-x-auto whitespace-pre leading-relaxed shadow-inner"
        >
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    // 2. Markdown Table (| Header | Header |)
    const isTableRow = (s) => /^\s*\|.*\|\s*$/.test(s);
    const isTableSep = (s) => /^\s*\|[\s:|-]*\|\s*$/.test(s) && s.includes("-");
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const renderedTable = renderTable(tableLines, isMe, keyCounter++);
      if (renderedTable) elements.push(renderedTable);
      continue;
    }

    // 3. Headings (# Heading, ## Subheading, ### Section)
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={`h1_${keyCounter++}`} className="text-base font-black text-white mt-2 mb-1 tracking-tight border-b border-white/20 pb-0.5">
          {parseInline(line.slice(2), isMe)}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`h2_${keyCounter++}`} className="text-sm font-extrabold text-white mt-1.5 mb-1">
          {parseInline(line.slice(3), isMe)}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3_${keyCounter++}`} className="text-xs font-bold text-slate-200 mt-1 mb-0.5">
          {parseInline(line.slice(4), isMe)}
        </h3>
      );
      i++;
      continue;
    }

    // 4. Blockquotes (> quote)
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote_${keyCounter++}`}
          className="my-1 pl-3 py-1 border-l-4 border-[#25D366] italic bg-white/10 rounded-r-lg text-slate-100 text-xs"
        >
          {parseInline(line.slice(2), isMe)}
        </blockquote>
      );
      i++;
      continue;
    }

    // 5. Bullet Lists (- list item or * list item)
    if (/^\s*[-*]\s+/.test(line)) {
      const itemText = line.replace(/^\s*[-*]\s+/, "");
      elements.push(
        <div key={`bullet_${keyCounter++}`} className="flex items-start gap-2 my-0.5 text-xs text-white">
          <span className="text-[#25D366] font-bold text-sm leading-none shrink-0">•</span>
          <span>{parseInline(itemText, isMe)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 6. Numbered Lists (1. list item)
    const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={`num_${keyCounter++}`} className="flex items-start gap-2 my-0.5 text-xs text-white">
          <span className="text-emerald-300 font-bold font-mono shrink-0">{numMatch[1]}.</span>
          <span>{parseInline(numMatch[2], isMe)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Regular paragraph line
    if (line.trim() === "") {
      elements.push(<div key={`br_${keyCounter++}`} className="h-1.5" />);
    } else {
      elements.push(
        <p key={`p_${keyCounter++}`} className="whitespace-pre-wrap break-words leading-relaxed text-white">
          {parseInline(line, isMe)}
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}
