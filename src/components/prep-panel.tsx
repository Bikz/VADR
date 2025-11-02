'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Target, FileText, AlertTriangle, XCircle } from 'lucide-react';
import type { CallPrep } from '@/types';

interface PrepPanelProps {
  prep: CallPrep;
}

export function PrepPanel({ prep }: PrepPanelProps) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 h-full">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#6C5CE7]" />
          Call Preparation
        </h3>
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="p-4 space-y-6">
          {/* Objective */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-3.5 h-3.5 text-[#6C5CE7]" />
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Objective
              </h4>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {prep.objective}
            </p>
          </div>

          {/* Script */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-[#6C5CE7]" />
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Script Flow
              </h4>
            </div>
            <div className="space-y-1.5">
              {prep.script.split('\n').map((line, i) => (
                <p key={i} className="text-xs text-slate-400 font-mono">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Variables */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
              Variables
            </h4>
            <div className="space-y-2">
              {Object.entries(prep.variables).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs bg-slate-800/50 border-slate-700 text-slate-400 shrink-0">
                    {key.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-xs text-slate-300">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Red Flags */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Red Flags
              </h4>
            </div>
            <div className="space-y-1.5">
              {prep.redFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-400">{flag}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Disallowed Topics */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Disallowed Topics
              </h4>
            </div>
            <div className="space-y-1.5">
              {prep.disallowedTopics.map((topic, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <p className="text-xs text-slate-400">{topic}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
