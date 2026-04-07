/**
 * Transcript Analyzer - Analyze session transcripts
 */

export interface AnalysisResult {
  summary: string;
  keyDecisions: string[];
  patterns: string[];
  insights: string[];
  topics: string[];
  importance: number;
}

export async function analyzeTranscript(transcript: string[], sessionId: string): Promise<AnalysisResult | null> {
  if (transcript.length === 0) return null;

  // Simple analysis - in production, use AI
  const content = transcript.join(' ').toLowerCase();
  
  const decisions: string[] = [];
  const patterns: string[] = [];
  const insights: string[] = [];
  const topics: string[] = [];

  // Extract decisions
  if (content.includes('decided') || content.includes('decision')) {
    decisions.push('Decision made during session');
  }

  // Extract patterns
  if (content.includes('pattern') || content.includes('always') || content.includes('usually')) {
    patterns.push('Behavioral pattern identified');
  }

  // Extract insights
  if (content.includes('realized') || content.includes('understood') || content.includes('learned')) {
    insights.push('Key insight from session');
  }

  // Extract topics
  if (content.includes('security')) topics.push('security');
  if (content.includes('android')) topics.push('android');
  if (content.includes('code')) topics.push('coding');
  if (topics.length === 0) topics.push('general');

  return {
    summary: transcript.slice(-3).join(' ').slice(0, 200),
    keyDecisions: decisions,
    patterns: patterns,
    insights: insights,
    topics: topics,
    importance: Math.min(1, transcript.length / 10)
  };
}

export default analyzeTranscript;
