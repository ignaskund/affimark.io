'use client';

import Link from 'next/link';
import {
    ScanLine,
    Link2,
    FileText,
    Sparkles,
    ArrowRight,
} from 'lucide-react';

const actions = [
    {
        icon: ScanLine,
        label: 'Run Audit',
        description: 'Check link health',
        href: '/dashboard/revenue-loss',
        color: 'from-emerald-500 to-teal-600',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
    },
    {
        icon: Link2,
        label: 'Create Link',
        description: 'New SmartWrapper',
        href: '/dashboard/smartwrappers',
        color: 'from-indigo-500 to-purple-600',
        textColor: 'text-indigo-400',
        bgColor: 'bg-indigo-500/10',
        borderColor: 'border-indigo-500/20',
    },
    {
        icon: FileText,
        label: 'Export Taxes',
        description: 'Generate reports',
        href: '/dashboard/tax-export',
        color: 'from-blue-500 to-cyan-600',
        textColor: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
    },
    {
        icon: Sparkles,
        label: 'Optimize',
        description: 'Find better rates',
        href: '/dashboard/optimizer',
        color: 'from-amber-500 to-orange-600',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
    },
];

export default function QuickActionsGrid() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {actions.map((action) => (
                <Link
                    key={action.label}
                    href={action.href}
                    className={`group relative p-6 rounded-xl ${action.bgColor} border ${action.borderColor} 
                     hover:scale-[1.02] transition-all duration-300 overflow-hidden`}
                >
                    {/* Background gradient on hover */}
                    <div
                        className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 
                       group-hover:opacity-10 transition-opacity duration-300`}
                    />

                    <div className="relative z-10">
                        <div
                            className={`w-12 h-12 rounded-xl ${action.bgColor} border ${action.borderColor} 
                         flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                        >
                            <action.icon className={`w-6 h-6 ${action.textColor}`} />
                        </div>

                        <h3 className="font-semibold text-foreground mb-1">{action.label}</h3>
                        <p className="text-sm text-muted-foreground">{action.description}</p>

                        {/* Arrow on hover */}
                        <ArrowRight
                            className={`absolute bottom-6 right-6 w-5 h-5 ${action.textColor} 
                         opacity-0 group-hover:opacity-100 transform translate-x-2 
                         group-hover:translate-x-0 transition-all duration-300`}
                        />
                    </div>
                </Link>
            ))}
        </div>
    );
}
