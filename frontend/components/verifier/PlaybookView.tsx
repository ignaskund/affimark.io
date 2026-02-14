'use client';

import { useState } from 'react';
import {
  Lightbulb, Users, BarChart3, CheckSquare, Radio, FlaskConical,
  ShieldAlert, Download, Bookmark, Eye, Plus, Check, Loader2
} from 'lucide-react';
import type { Playbook, ChannelType } from '@/types/verifier';

interface PlaybookViewProps {
  playbook: Playbook;
  onAddToWatchlist: () => Promise<boolean>;
  onSaveToLibrary: () => Promise<boolean>;
  onNewAnalysis: () => void;
}

export default function PlaybookView({
  playbook,
  onAddToWatchlist,
  onSaveToLibrary,
  onNewAnalysis,
}: PlaybookViewProps) {
  const [activeChannel, setActiveChannel] = useState<ChannelType>('SEO');
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [librarySaved, setLibrarySaved] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleWatchlist = async () => {
    setLoading('watchlist');
    const success = await onAddToWatchlist();
    if (success) setWatchlistAdded(true);
    setLoading(null);
  };

  const handleLibrary = async () => {
    setLoading('library');
    const success = await onSaveToLibrary();
    if (success) setLibrarySaved(true);
    setLoading(null);
  };

  const activeChannelPlan = playbook.channel_plan.find(c => c.channel === activeChannel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Your Playbook</h2>
          <p className="text-sm text-gray-400 mt-1">
            Marketing strategy for {playbook.approved_item.brand} - {playbook.approved_item.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLibrary}
            disabled={librarySaved || loading === 'library'}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              librarySaved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white'
            }`}
          >
            {loading === 'library' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : librarySaved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            {librarySaved ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={handleWatchlist}
            disabled={watchlistAdded || loading === 'watchlist'}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              watchlistAdded
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white'
            }`}
          >
            {loading === 'watchlist' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : watchlistAdded ? (
              <Check className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {watchlistAdded ? 'Watching' : 'Watch'}
          </button>
        </div>
      </div>

      {/* Positioning Angles */}
      <Section title="Positioning Angles" icon={<Lightbulb className="w-4 h-4 text-amber-400" />}>
        <div className="grid grid-cols-2 gap-4">
          {playbook.positioning_angles.map((angle, i) => (
            <div key={i} className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
              <h4 className="font-medium text-white mb-2">{angle.angle_name}</h4>
              <p className="text-sm text-emerald-400 mb-3">"{angle.hook}"</p>
              <ul className="space-y-1.5">
                {angle.proof_points.map((point, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Audience Targeting */}
      <Section title="Audience Targeting" icon={<Users className="w-4 h-4 text-blue-400" />}>
        <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
          <p className="text-sm text-white mb-4">
            <span className="text-gray-400">Primary segment: </span>
            {playbook.audience.primary_segment}
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Pain Points</h5>
              <ul className="space-y-1">
                {playbook.audience.pain_points.map((p, i) => (
                  <li key={i} className="text-xs text-gray-400">• {p}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Objections</h5>
              <ul className="space-y-1">
                {playbook.audience.objections.map((o, i) => (
                  <li key={i} className="text-xs text-gray-400">• {o}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Buying Triggers</h5>
              <ul className="space-y-1">
                {playbook.audience.buying_triggers.map((t, i) => (
                  <li key={i} className="text-xs text-gray-400">• {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* Channel Plan */}
      <Section title="Channel Plan" icon={<BarChart3 className="w-4 h-4 text-purple-400" />}>
        <div className="space-y-3">
          {/* Channel Tabs */}
          <div className="flex gap-2">
            {playbook.channel_plan.map((ch) => (
              <button
                key={ch.channel}
                onClick={() => setActiveChannel(ch.channel)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeChannel === ch.channel
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {ch.channel}
                {ch.recommended && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>

          {/* Channel Steps */}
          {activeChannelPlan && (
            <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
              <div className="flex items-center gap-2 mb-3">
                {activeChannelPlan.recommended && (
                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                    Recommended
                  </span>
                )}
              </div>
              <ol className="space-y-2">
                {activeChannelPlan.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 text-gray-500 text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Section>

      {/* Checklists Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Assets Checklist */}
        <Section title="Assets to Create" icon={<CheckSquare className="w-4 h-4 text-cyan-400" />}>
          <div className="space-y-2">
            {playbook.assets_checklist.map((item, i) => (
              <label key={i} className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50"
                />
                <span className="group-hover:text-white transition-colors">{item}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Tracking Checklist */}
        <Section title="Tracking Setup" icon={<Radio className="w-4 h-4 text-orange-400" />}>
          <div className="space-y-2">
            {playbook.tracking_checklist.map((item, i) => (
              <label key={i} className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50"
                />
                <span className="group-hover:text-white transition-colors">{item}</span>
              </label>
            ))}
          </div>
        </Section>
      </div>

      {/* Test Plan */}
      <Section title="Test Plan" icon={<FlaskConical className="w-4 h-4 text-pink-400" />}>
        <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/30">
          <div className="flex items-center gap-4 mb-4">
            <div>
              <span className="text-xs text-gray-500">Duration</span>
              <p className="text-lg font-semibold text-white">{playbook.test_plan.duration_days} days</p>
            </div>
            <div className="flex-1">
              <span className="text-xs text-gray-500">KPIs to Track</span>
              <div className="flex gap-2 mt-1">
                {playbook.test_plan.kpis.map((kpi, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-gray-800 text-xs text-gray-300">
                    {kpi}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Iteration Rules</span>
            <ul className="mt-2 space-y-1.5">
              {playbook.test_plan.iteration_rules.map((rule, i) => (
                <li key={i} className="text-sm text-gray-400">• {rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Compliance Notes */}
      {playbook.compliance_notes.length > 0 && (
        <Section title="Compliance Notes" icon={<ShieldAlert className="w-4 h-4 text-red-400" />}>
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <ul className="space-y-1.5">
              {playbook.compliance_notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-300/80">
                  <span className="text-amber-400 mt-0.5">!</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* New Analysis Button */}
      <div className="pt-4 border-t border-gray-800">
        <button
          onClick={onNewAnalysis}
          className="px-4 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Analyze another product
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}
