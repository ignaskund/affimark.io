interface RevenueHeroWidgetProps {
    totalEarnings: number;
    growthRate: number;
    revenueProtected: number;
    potentialUplift: number;
    currency: string;
}

export default function RevenueHeroWidget({
    totalEarnings,
    growthRate,
    revenueProtected,
    potentialUplift,
    currency
}: RevenueHeroWidgetProps) {
    return (
        <div className="glass-card p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
                    <p className="text-2xl font-bold text-foreground">{currency}{totalEarnings.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Growth</p>
                    <p className={`text-2xl font-bold ${growthRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
                    </p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Revenue Protected</p>
                    <p className="text-2xl font-bold text-emerald-400">{currency}{revenueProtected.toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Potential Uplift</p>
                    <p className="text-2xl font-bold text-amber-400">{currency}{potentialUplift.toFixed(2)}</p>
                </div>
            </div>
        </div>
    );
}
