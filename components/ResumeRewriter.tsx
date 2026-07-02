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
      className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
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
        <h2 className="text-xl font-semibold text-zinc-100">Claude Rewrite</h2>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{result.summary}</p>
      </div>

      {result.sections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {result.sections.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSection(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                i === activeSection
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
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
            <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Original</span>
                <CopyButton text={result.sections[activeSection].original} />
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {result.sections[activeSection].original}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-900 border border-violet-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Rewritten</span>
                <CopyButton text={result.sections[activeSection].rewritten} />
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {result.sections[activeSection].rewritten}
              </p>
            </div>
          </div>

          {result.sections[activeSection].changes.length > 0 && (
            <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Changes Made</span>
              <ul className="mt-2 flex flex-col gap-1">
                {result.sections[activeSection].changes.map((c, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex gap-2">
                    <span className="text-violet-500 flex-shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Full Rewritten Resume</span>
          <CopyButton text={allRewritten} />
        </div>
        <pre className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-80">
          {allRewritten}
        </pre>
      </div>
    </div>
  );
}
