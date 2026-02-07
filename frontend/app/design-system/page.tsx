import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Design System | Affimark',
    description: 'Component playground and design system showcase',
};

export default function DesignSystemPage() {
    return (
        <div className="min-h-screen bg-bg p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-32 font-bold text-textPrimary">Affimark Design System</h1>
                    <p className="text-16 text-textMuted">Component playground and design token showcase</p>
                </div>

                {/* Colors */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Colors</h2>
                    </div>

                    {/* Brand Colors */}
                    <div>
                        <h3 className="text-15 font-medium text-textMuted mb-3">Brand (Peach)</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <div className="h-24 bg-brand rounded-12 border border-borderSubtle"></div>
                                <p className="text-14 text-textPrimary font-medium">Brand</p>
                                <p className="text-12 text-textMuted font-mono">#f3a89a</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-24 bg-brandStrong rounded-12 border border-borderSubtle"></div>
                                <p className="text-14 text-textPrimary font-medium">Brand Strong</p>
                                <p className="text-12 text-textMuted font-mono">#f08c7a</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-24 bg-brandSoft rounded-12 border border-borderSubtle"></div>
                                <p className="text-14 text-textPrimary font-medium">Brand Soft</p>
                                <p className="text-12 text-textMuted font-mono">#fef5f3</p>
                            </div>
                        </div>
                    </div>

                    {/* Semantic Colors */}
                    <div>
                        <h3 className="text-15 font-medium text-textMuted mb-3">Semantic Colors</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <div className="h-20 bg-success rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Success</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-warning rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Warning</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-danger rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Danger</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-info rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Info</p>
                            </div>
                        </div>
                    </div>

                    {/* Neutrals */}
                    <div>
                        <h3 className="text-15 font-medium text-textMuted mb-3">Neutrals</h3>
                        <div className="grid grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <div className="h-20 bg-bg border border-borderSubtle rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Background</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-surface border border-borderSubtle rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Surface</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-surface2 border border-borderSubtle rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Surface 2</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-textPrimary rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Text Primary</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-textMuted rounded-12"></div>
                                <p className="text-14 text-textPrimary font-medium">Text Muted</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Typography */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Typography</h2>
                    </div>

                    <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-4">
                        <div className="flex items-baseline gap-4">
                            <span className="text-32 font-bold text-textPrimary">32px Bold</span>
                            <span className="text-12 text-textMuted font-mono">--text-32</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-28 font-semibold text-textPrimary">28px Semibold</span>
                            <span className="text-12 text-textMuted font-mono">--text-28</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-20 font-semibold text-textPrimary">20px Semibold</span>
                            <span className="text-12 text-textMuted font-mono">--text-20</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-18 font-medium text-textPrimary">18px Medium</span>
                            <span className="text-12 text-textMuted font-mono">--text-18</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-16 text-textPrimary">16px Regular</span>
                            <span className="text-12 text-textMuted font-mono">--text-16</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-15 text-textPrimary">15px Regular</span>
                            <span className="text-12 text-textMuted font-mono">--text-15</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-14 text-textMuted">14px Muted</span>
                            <span className="text-12 text-textMuted font-mono">--text-14</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-12 text-textFaint">12px Faint</span>
                            <span className="text-12 text-textMuted font-mono">--text-12</span>
                        </div>
                    </div>
                </section>

                {/* Buttons */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Buttons</h2>
                    </div>

                    <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-6">
                        {/* Primary Buttons */}
                        <div className="space-y-3">
                            <h3 className="text-14 font-medium text-textMuted">Primary</h3>
                            <div className="flex flex-wrap gap-3">
                                <button className="px-6 py-3 bg-brand hover:bg-brandStrong text-white font-medium rounded-8 transition-colors">
                                    Primary Button
                                </button>
                                <button className="px-6 py-3 bg-brand hover:bg-brandStrong text-white font-medium rounded-8 transition-colors opacity-50 cursor-not-allowed">
                                    Disabled
                                </button>
                                <button className="px-4 py-2 bg-brand hover:bg-brandStrong text-white font-medium rounded-8 transition-colors text-14">
                                    Small
                                </button>
                            </div>
                        </div>

                        {/* Secondary Buttons */}
                        <div className="space-y-3">
                            <h3 className="text-14 font-medium text-textMuted">Secondary</h3>
                            <div className="flex flex-wrap gap-3">
                                <button className="px-6 py-3 bg-surface2 hover:bg-borderSubtle text-textPrimary font-medium rounded-8 border border-borderSubtle transition-colors">
                                    Secondary Button
                                </button>
                                <button className="px-6 py-3 bg-surface2 text-textPrimary font-medium rounded-8 border border-borderSubtle opacity-50 cursor-not-allowed">
                                    Disabled
                                </button>
                            </div>
                        </div>

                        {/* Danger Buttons */}
                        <div className="space-y-3">
                            <h3 className="text-14 font-medium text-textMuted">Danger</h3>
                            <div className="flex flex-wrap gap-3">
                                <button className="px-6 py-3 bg-danger hover:bg-red-700 text-white font-medium rounded-8 transition-colors">
                                    Delete
                                </button>
                                <button className="px-6 py-3 bg-dangerSoft hover:bg-red-100 text-danger font-medium rounded-8 border border-danger/20 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>

                        {/* Ghost Buttons */}
                        <div className="space-y-3">
                            <h3 className="text-14 font-medium text-textMuted">Ghost</h3>
                            <div className="flex flex-wrap gap-3">
                                <button className="px-4 py-2 text-textMuted hover:text-textPrimary hover:bg-surface2 rounded-8 transition-colors">
                                    Ghost Button
                                </button>
                                <button className="px-4 py-2 text-brand hover:text-brandStrong hover:bg-brandSoft rounded-8 transition-colors">
                                    Brand Ghost
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Cards */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Cards</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Basic Card */}
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-3">
                            <h3 className="text-16 font-semibold text-textPrimary">Basic Card</h3>
                            <p className="text-14 text-textMuted">
                                This is a basic card with a border and padding. Perfect for content containers.
                            </p>
                        </div>

                        {/* Card with Shadow */}
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-3 shadow-md">
                            <h3 className="text-16 font-semibold text-textPrimary">Card with Shadow</h3>
                            <p className="text-14 text-textMuted">
                                This card has a subtle shadow for more depth and elevation.
                            </p>
                        </div>

                        {/* Stat Card */}
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-2">
                            <p className="text-12 text-textMuted uppercase tracking-wide">Total Revenue</p>
                            <p className="text-28 font-bold text-textPrimary">€12,450</p>
                            <p className="text-14 text-success">+12.5% from last month</p>
                        </div>
                    </div>
                </section>

                {/* Badges */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Badges</h2>
                    </div>

                    <div className="bg-surface border border-borderSubtle rounded-12 p-6">
                        <div className="flex flex-wrap gap-3">
                            <span className="px-3 py-1 bg-successSoft text-success text-12 font-medium rounded-full border border-success/20">
                                Success
                            </span>
                            <span className="px-3 py-1 bg-warningSoft text-warning text-12 font-medium rounded-full border border-warning/20">
                                Warning
                            </span>
                            <span className="px-3 py-1 bg-dangerSoft text-danger text-12 font-medium rounded-full border border-danger/20">
                                Danger
                            </span>
                            <span className="px-3 py-1 bg-infoSoft text-info text-12 font-medium rounded-full border border-info/20">
                                Info
                            </span>
                            <span className="px-3 py-1 bg-brandSoft text-brand text-12 font-medium rounded-full border border-brand/20">
                                Brand
                            </span>
                            <span className="px-3 py-1 bg-surface2 text-textMuted text-12 font-medium rounded-full border border-borderSubtle">
                                Neutral
                            </span>
                        </div>
                    </div>
                </section>

                {/* Inputs */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Form Inputs</h2>
                    </div>

                    <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-6 max-w-md">
                        <div className="space-y-2">
                            <label className="text-14 font-medium text-textPrimary">Text Input</label>
                            <input
                                type="text"
                                placeholder="Enter text..."
                                className="w-full px-4 py-3 bg-surface border border-borderSubtle rounded-8 text-15 text-textPrimary placeholder:text-textFaint focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-14 font-medium text-textPrimary">Textarea</label>
                            <textarea
                                placeholder="Enter description..."
                                rows={4}
                                className="w-full px-4 py-3 bg-surface border border-borderSubtle rounded-8 text-15 text-textPrimary placeholder:text-textFaint focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-14 font-medium text-textPrimary">Select</label>
                            <select className="w-full px-4 py-3 bg-surface border border-borderSubtle rounded-8 text-15 text-textPrimary focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors">
                                <option>Option 1</option>
                                <option>Option 2</option>
                                <option>Option 3</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Spacing */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Spacing (4px Grid)</h2>
                    </div>

                    <div className="bg-surface border border-borderSubtle rounded-12 p-6 space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="w-1 h-8 bg-brand"></div>
                            <span className="text-14 text-textMuted font-mono">4px (space-1)</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-8 bg-brand"></div>
                            <span className="text-14 text-textMuted font-mono">8px (space-2)</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-4 h-8 bg-brand"></div>
                            <span className="text-14 text-textMuted font-mono">16px (space-4)</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-6 h-8 bg-brand"></div>
                            <span className="text-14 text-textMuted font-mono">24px (space-6)</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-brand"></div>
                            <span className="text-14 text-textMuted font-mono">32px (space-8)</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-8 bg-brand"></div>
                            <span className="text-14 text-textMuted font-mono">48px (space-12)</span>
                        </div>
                    </div>
                </section>

                {/* Border Radius */}
                <section className="space-y-6">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Border Radius</h2>
                    </div>

                    <div className="bg-surface border border-borderSubtle rounded-12 p-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-2">
                                <div className="h-20 bg-brand rounded-6"></div>
                                <p className="text-12 text-textMuted font-mono text-center">6px</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-brand rounded-8"></div>
                                <p className="text-12 text-textMuted font-mono text-center">8px</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-brand rounded-10"></div>
                                <p className="text-12 text-textMuted font-mono text-center">10px</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-brand rounded-12"></div>
                                <p className="text-12 text-textMuted font-mono text-center">12px</p>
                            </div>
                            <div className="space-y-2">
                                <div className="h-20 bg-brand rounded-16"></div>
                                <p className="text-12 text-textMuted font-mono text-center">16px</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Shadows */}
                <section className="space-y-6 pb-12">
                    <div>
                        <h2 className="text-20 font-semibold text-textPrimary mb-4">Shadows</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 shadow-sm">
                            <p className="text-14 font-medium text-textPrimary">Small</p>
                            <p className="text-12 text-textMuted font-mono mt-1">shadow-sm</p>
                        </div>
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 shadow-md">
                            <p className="text-14 font-medium text-textPrimary">Medium</p>
                            <p className="text-12 text-textMuted font-mono mt-1">shadow-md</p>
                        </div>
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 shadow-lg">
                            <p className="text-14 font-medium text-textPrimary">Large</p>
                            <p className="text-12 text-textMuted font-mono mt-1">shadow-lg</p>
                        </div>
                        <div className="bg-surface border border-borderSubtle rounded-12 p-6 shadow-xl">
                            <p className="text-14 font-medium text-textPrimary">Extra Large</p>
                            <p className="text-12 text-textMuted font-mono mt-1">shadow-xl</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
