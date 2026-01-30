interface InsightsPanelProps {
    topProduct: any;
    urgentIssues: number;
    weeklyTrend: number;
}

export default function InsightsPanel({ topProduct, urgentIssues, weeklyTrend }: InsightsPanelProps) {
    return (
        <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Insights</h3>
            <div className="space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Urgent Issues</p>
                    <p className={`text-xl font-bold ${urgentIssues > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {urgentIssues}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Weekly Trend</p>
                    <p className={`text-xl font-bold ${weeklyTrend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {weeklyTrend >= 0 ? '+' : ''}{weeklyTrend.toFixed(1)}%
                    </p>
                </div>
            </div>
        </div>
    );
}
