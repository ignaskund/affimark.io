'use client';

import {
  TrendingUp,
  Lightbulb,
  Zap,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface InsightProps {
  type: 'opportunity' | 'action' | 'tip' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}

const insightConfig = {
  opportunity: {
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    bgHigh: 'bg-emerald-500/10 border-emerald-500/30',
    bgNormal: 'bg-emerald-500/5 border-border',
  },
  action: {
    icon: Zap,
    iconColor: 'text-blue-400',
    bgHigh: 'bg-blue-500/10 border-blue-500/30',
    bgNormal: 'bg-blue-500/5 border-border',
  },
  tip: {
    icon: Lightbulb,
    iconColor: 'text-amber-400',
    bgHigh: 'bg-amber-500/10 border-amber-500/30',
    bgNormal: 'bg-muted/50 border-border',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-red-400',
    bgHigh: 'bg-red-500/10 border-red-500/30',
    bgNormal: 'bg-red-500/5 border-border',
  },
};

export default function InsightBadge({ type, title, description, priority, action_url }: InsightProps) {
  const config = insightConfig[type];
  const Icon = config.icon;
  const bg = priority === 'high' ? config.bgHigh : config.bgNormal;

  return (
    <div className={`p-3 rounded-lg border ${bg}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <Icon className={`w-4 h-4 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h6 className="font-medium text-foreground text-sm">{title}</h6>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          {action_url && (
            <a
              href={action_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            >
              Learn more <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
