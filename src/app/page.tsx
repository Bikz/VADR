'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CallGrid } from '@/components/call-grid';
import { PrepPanel } from '@/components/prep-panel';
import type { VADRRun } from '@/types';
import { generateMockLeads, createInitialCall, mockCallPrep } from '@/lib/mock-data';

const EXAMPLE_QUERIES = [
  "Find 5 salons near me with same-day appointments under $60",
  "Get quotes from 3 drywall contractors with next-day availability",
  "Find massage therapists available today at 4 PM within 2 miles",
  "Contact barbershops that are open now and accept walk-ins",
  "Find tailors offering same-week alterations under $50"
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [currentRun, setCurrentRun] = useState<VADRRun | null>(null);
  const [plan, setPlan] = useState<'basic' | 'pro'>('basic');

  const handleSearch = () => {
    if (!query.trim()) return;

    const leads = generateMockLeads(6);
    const calls = leads.map(lead => createInitialCall(lead));

    const run: VADRRun = {
      id: `run-${Date.now()}`,
      query,
      createdBy: 'demo-user',
      startedAt: Date.now(),
      status: 'searching',
      calls
    };

    setCurrentRun(run);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6C5CE7] to-[#5849c4] flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">VADR</h1>
                <p className="text-xs text-slate-400">Voice Agent Deep Research</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={plan === 'basic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPlan('basic')}
                className={plan === 'basic' ? 'bg-[#6C5CE7] hover:bg-[#5849c4]' : ''}
              >
                Basic (6)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="opacity-50"
              >
                Pro (50)
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-[1800px] mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto mb-8">
          <h2 className="text-3xl font-bold text-white text-center mb-3">
            What should VADR find & call?
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Type a prompt → VADR searches → finds numbers → calls in parallel
          </p>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder='e.g. "Find 5 salons near me with same-day appointments under $60"'
              className="pl-12 pr-32 h-14 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-[#6C5CE7] text-base"
            />
            <Button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#6C5CE7] hover:bg-[#5849c4] h-10"
            >
              Start Research
            </Button>
          </div>

          {currentRun && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="text-sm text-slate-400 text-center">
                Researching: <span className="text-white font-medium">{currentRun.query}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentRun(null)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                New Search
              </Button>
            </div>
          )}

          {/* Example Queries */}
          {!currentRun && (
            <div className="mt-6 space-y-3">
              <p className="text-xs text-slate-500 text-center">Try these examples:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_QUERIES.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(example)}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300 transition-colors border border-slate-700/50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        {currentRun && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Call Grid - 3 columns */}
            <div className="lg:col-span-3">
              <CallGrid run={currentRun} onRunUpdate={setCurrentRun} />
            </div>

            {/* Prep Panel - 1 column */}
            <div className="lg:col-span-1">
              <PrepPanel prep={mockCallPrep} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentRun && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800/50 mb-4">
              <Search className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-400 mb-2">
              Ready to research
            </h3>
            <p className="text-sm text-slate-500">
              Enter your search query above to start parallel voice research
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-sm mt-auto">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
            <span>Powered by</span>
            <a
              href="https://coval.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              COVAL (AI Evals)
            </a>
            <span>•</span>
            <a
              href="https://metorial.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              Metorial (MCP Platform)
            </a>
            <span>•</span>
            <span>Demo v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
