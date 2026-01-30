'use client';

interface ConfidenceScoreProps {
  score: number;
  showLabel?: boolean;
}

const labels: Record<number, string> = {
  5: 'Verified',
  4: 'High',
  3: 'Medium',
  2: 'Low',
  1: 'Estimated',
  0: 'Unknown',
};

export default function ConfidenceScore({ score, showLabel = false }: ConfidenceScoreProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i <= score ? 'bg-amber-400' : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{labels[score] || 'Unknown'}</span>
      )}
    </div>
  );
}
