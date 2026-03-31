/**
 * VotePanel — Council voting results display
 *
 * Shows YEA/NAY bars, consensus score, and result badge.
 */

import React from 'react';

interface VoteData {
  topic: string;
  yeas: number;
  nays: number;
  result: 'PASSED' | 'REJECTED' | 'RECONCILIATION NEEDED';
  avgConfidence: number;
  consensusScore: number;
  consensusLabel: string;
  votes: {
    voter: string;
    choice: 'YEA' | 'NAY';
    confidence: number;
    reason: string;
    color: string;
  }[];
}

interface VotePanelProps {
  voteData: VoteData;
}

export const VotePanel: React.FC<VotePanelProps> = ({ voteData }) => {
  const total = voteData.yeas + voteData.nays;
  const yeaPct = total > 0 ? (voteData.yeas / total) * 100 : 50;
  const nayPct = total > 0 ? (voteData.nays / total) * 100 : 50;

  const isPassed = voteData.result === 'PASSED';
  const resultColor = isPassed ? 'text-emerald-400' : 'text-red-400';
  const resultBg = isPassed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30';

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 animate-panel-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs text-[#8b949e] uppercase tracking-wider">Vote Results</h4>
          <p className="text-sm text-[#e6edf3] font-semibold mt-0.5 truncate max-w-xs">{voteData.topic}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${resultBg} ${resultColor}`}>
          {voteData.result}
        </div>
      </div>

      {/* YEA/NAY Bars */}
      <div className="space-y-2 mb-4">
        {/* YEA Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-400 font-bold">YEA</span>
            <span className="text-[#8b949e]">{voteData.yeas} ({Math.round(yeaPct)}%)</span>
          </div>
          <div className="h-3 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${yeaPct}%` }}
            />
          </div>
        </div>

        {/* NAY Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400 font-bold">NAY</span>
            <span className="text-[#8b949e]">{voteData.nays} ({Math.round(nayPct)}%)</span>
          </div>
          <div className="h-3 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-700"
              style={{ width: `${nayPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Consensus Score */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-[#0d1117] rounded-xl">
        <div className="text-center">
          <div className={`text-3xl font-black font-mono ${
            voteData.consensusScore > 75 ? 'text-emerald-400' :
            voteData.consensusScore > 40 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {voteData.consensusScore}
          </div>
          <div className="text-[9px] text-[#484f58] uppercase tracking-wider">Consensus</div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-[#8b949e] mb-1">{voteData.consensusLabel}</div>
          <div className="text-xs text-[#484f58]">
            Avg Confidence: <span className="text-[#fbbf24] font-mono">{voteData.avgConfidence}/10</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-black text-[#fbbf24]">{total}</div>
          <div className="text-[9px] text-[#484f58] uppercase tracking-wider">Votes</div>
        </div>
      </div>

      {/* Individual Votes */}
      {voteData.votes.length > 0 && (
        <div className="space-y-1.5">
          {voteData.votes.map((vote, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-[#21262d] transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full ${vote.choice === 'YEA' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-[#e6edf3] font-medium w-32 truncate">{vote.voter}</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                vote.choice === 'YEA' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {vote.choice}
              </span>
              <span className="text-[#484f58] text-[10px] font-mono ml-auto">{vote.confidence}/10</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
