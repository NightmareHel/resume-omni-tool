'use client';

import { useState } from 'react';
import { RewriteResult } from '@/lib/claude';

interface Props {
  result: RewriteResult;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2.5 py-1 rounded bg-sunken text-stone hover:bg-seam hover:text-graphite transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function ResumeRewriter({ result }: Props) {
  const [activeSection, setActiveSection] = useState(0);

  const allRewritten = result.sections.map((s) => `## ${s.name}\n${s.rewritten}`).join('\n\n');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-graphite">Claude Rewrite</h2>
        <p className="text-sm text-stone mt-1 leading-relaxed">{result.summary}</p>
      </div>

      {result.sections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {result.sections.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSection(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                i === activeSection
                  ? 'bg-graphite border-bronze text-white'
                  : 'bg-surface border-seam text-stone hover:border-bronze/50 hover:text-graphite'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {result.sections.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-[8px] bg-surface border border-hairline">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone uppercase tracking-wider">Original</span>
                <CopyButton text={result.sections[activeSection].original} />
              </div>
              <p className="text-sm text-stone leading-relaxed whitespace-pre-wrap">
                {result.sections[activeSection].original}
              </p>
            </div>

            <div className="p-4 rounded-[8px] bg-surface border border-bronze/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-bronze-strong uppercase tracking-wider">Rewritten</span>
                <CopyButton text={result.sections[activeSection].rewritten} />
              </div>
              <p className="text-sm text-graphite leading-relaxed whitespace-pre-wrap">
                {result.sections[activeSection].rewritten}
              </p>
            </div>
          </div>

          {result.sections[activeSection].changes.length > 0 && (
            <div className="p-3.5 rounded-[8px] bg-surface border border-hairline">
              <span className="text-xs font-semibold text-stone uppercase tracking-wider">Changes Made</span>
              <ul className="mt-2 flex flex-col gap-1">
                {result.sections[activeSection].changes.map((c, i) => (
                  <li key={i} className="text-xs text-stone flex gap-2">
                    <span className="text-bronze flex-shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-[8px] bg-surface border border-hairline">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-stone uppercase tracking-wider">Full Rewritten Resume</span>
          <CopyButton text={allRewritten} />
        </div>
        <pre className="text-xs text-stone leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-80">
          {allRewritten}
        </pre>
      </div>
    </div>
  );
}
