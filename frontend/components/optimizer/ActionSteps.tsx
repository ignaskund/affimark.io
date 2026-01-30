'use client';

import { ExternalLink } from 'lucide-react';

interface ActionStep {
  step: number;
  instruction: string;
  url?: string;
}

interface ActionStepsProps {
  steps: ActionStep[];
}

export default function ActionSteps({ steps }: ActionStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        How to switch
      </p>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li key={step.step} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              {step.step}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{step.instruction}</p>
              {step.url && (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
