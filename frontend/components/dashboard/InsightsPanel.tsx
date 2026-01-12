'use client';

import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Package } from 'lucide-react';

interface Insight {
    type: 'success' | 'warning' | 'info';
    icon: React.ReactNode;
    title: string;
    description: string;
}

interface InsightsPanelProps {
    topProduct?: {
        name: string;
        earnings: number;
    };
    urgentIssues?: number;
    weeklyTrend?: number;
}

export default function InsightsPanel({
    topProduct,
    urgentIssues = 0,
    weeklyTrend = 0,
}: InsightsPanelProps) {
    const insights: Insight[] = [];

    // Add top product insight
    if (topProduct && topProduct.earnings > 0) {
        insights.push({
            type: 'success',
            icon: <Package className="w-5 h-5 text-emerald-400" />,
            title: 'Top Performer',
            description: `${topProduct.name} earned €${topProduct.earnings.toFixed(0)} this week`,
        });
    }

    // Add urgent issues
    if (urgentIssues > 0) {
        insights.push({
            type: 'warning',
            icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
            title: 'Needs Attention',
            description: `${urgentIssues} link${urgentIssues > 1 ? 's' : ''} require${urgentIssues === 1 ? 's' : ''} your attention`,
        });
    }

    // Add weekly trend
    if (weeklyTrend !== 0) {
        const isPositive = weeklyTrend > 0;
        insights.push({
            type: isPositive ? 'success' : 'info',
            icon: isPositive ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
                <TrendingDown className="w-5 h-5 text-muted-foreground" />
            ),
            title: isPositive ? 'Trending Up' : 'Weekly Change',
            description: `You're ${isPositive ? 'up' : 'down'} ${Math.abs(weeklyTrend)}% vs last week`,
        });
    }

    // Default insight if no others
    if (insights.length === 0) {
        insights.push({
            type: 'info',
            icon: <Lightbulb className="w-5 h-5 text-indigo-400" />,
            title: 'Getting Started',
            description: 'Connect your storefronts to see personalized insights',
        });
    }

    const getCardStyles = (type: 'success' | 'warning' | 'info') => {
        switch (type) {
            case 'success':
                return 'bg-emerald-500/10 border-emerald-500/20';
            case 'warning':
                return 'bg-amber-500/10 border-amber-500/20';
            case 'info':
            default:
                return 'bg-indigo-500/10 border-indigo-500/20';
        }
    };

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Insights
            </h3>
            <div className="space-y-3">
                {insights.map((insight, i) => (
                    <div
                        key={i}
                        className={`flex items-start gap-4 p-4 rounded-xl border ${getCardStyles(insight.type)} transition-all hover:scale-[1.01]`}
                    >
                        <div className="flex-shrink-0 mt-0.5">{insight.icon}</div>
                        <div>
                            <p className="font-medium text-foreground">{insight.title}</p>
                            <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
