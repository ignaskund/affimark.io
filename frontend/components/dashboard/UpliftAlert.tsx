'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

interface UpliftAlertProps {
    potentialUplift: number;
    linkCount: number;
    currency?: string;
}

export default function UpliftAlert({
    potentialUplift,
    linkCount,
    currency = 'EUR',
}: UpliftAlertProps) {
    const [isDismissed, setIsDismissed] = useState(false);

    if (isDismissed || potentialUplift <= 0) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-EU', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 p-4 animate-slide-up">
            {/* Animated glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-pulse" />

            <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center animate-glow">
                        <Sparkles className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">
                            We found{' '}
                            <span className="text-amber-400">
                                {formatCurrency(potentialUplift)}/mo
                            </span>{' '}
                            potential uplift
                        </p>
                        <p className="text-sm text-muted-foreground">
                            across {linkCount} links that could earn more with better programs
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/optimizer"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
                    >
                        View Suggestions
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button
                        onClick={() => setIsDismissed(true)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
