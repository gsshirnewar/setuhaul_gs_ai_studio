import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Server,
  Database,
  Cpu,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Truck,
  Building2,
  Workflow,
  Lock,
  RefreshCw,
  GitMerge,
  Radio,
  FileCode,
} from 'lucide-react';

interface PresentationDeckProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlide?: number;
}

export const PresentationDeck: React.FC<PresentationDeckProps> = ({
  isOpen,
  onClose,
  initialSlide = 0,
}) => {
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<'all' | 'vercel' | 'gemini' | 'supabase' | 'client'>('all');

  const totalSlides = 5;

  useEffect(() => {
    setCurrentSlide(initialSlide);
  }, [initialSlide]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col select-none text-slate-100 overflow-hidden animate-fade-in">
      {/* Top Presentation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 md:px-6 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">SetuHaul Architecture & Operational Deck</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Presenter Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              AI Freight Orchestration, Supabase Concurrency & Multi-Platform Pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 mr-2 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            Slide <strong className="text-cyan-400">{currentSlide + 1}</strong> of {totalSlides}
          </span>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors"
            title="Close Presentation (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Slide Content Area */}
      <div className="flex-1 overflow-y-auto relative p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-center">

          {/* ========================================================= */}
          {/* SLIDE 1: High-Level Platform Architecture Diagram */}
          {/* ========================================================= */}
          {currentSlide === 0 && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    <span>Slide 1 — System Blueprint</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-1">
                    High-Level Platform Architecture & Topology
                  </h2>
                  <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-3xl">
                    SetuHaul links <strong>Vercel</strong> edge serverless execution, <strong>Google Gemini</strong> operational intelligence, and <strong>Supabase PostgreSQL</strong> atomic concurrency locking into an enterprise freight dispatch ecosystem.
                  </p>
                </div>

                {/* Filter / Focus pills */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setActivePlatformTab('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activePlatformTab === 'all'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Tiers
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePlatformTab('vercel')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activePlatformTab === 'vercel'
                        ? 'bg-black text-white border border-slate-600 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ▲ Vercel
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePlatformTab('gemini')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activePlatformTab === 'gemini'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ✦ Gemini LLM
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePlatformTab('supabase')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      activePlatformTab === 'supabase'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⚡ Supabase
                  </button>
                </div>
              </div>

              {/* Visual Architecture Diagram Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative">

                {/* Tier 1: Client Interfaces */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    activePlatformTab === 'all' || activePlatformTab === 'client'
                      ? 'bg-slate-900/90 border-blue-500/40 ring-1 ring-blue-500/20'
                      : 'bg-slate-900/40 border-slate-800 opacity-40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        Tier 1 • Client Layer
                      </span>
                      <Smartphone className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <span>Dual-Role PWA Client</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      React 18 + Tailwind CSS SPA with instant mobile responsiveness & zero-refresh updates.
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                          <Truck className="w-3.5 h-3.5" />
                          <span>Driver Dispatch Portal</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Chat UI, Slot Rescheduling, Live ETA adjustment & gate access pass.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Coordinator Console</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Live Yard Board, Driver Approvals, Contention Arbitration & Audit logs.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="font-mono text-cyan-400">WebSocket / HTTPS</span>
                    <span className="text-slate-500">Sub-100ms UI</span>
                  </div>
                </div>

                {/* Tier 2: Vercel Edge & Serverless */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    activePlatformTab === 'all' || activePlatformTab === 'vercel'
                      ? 'bg-slate-900/90 border-slate-500 ring-1 ring-white/10'
                      : 'bg-slate-900/40 border-slate-800 opacity-40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                        Tier 2 • Edge & Serverless
                      </span>
                      <Server className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-white text-black font-black flex items-center justify-center text-[8px] rounded-sm">▲</span>
                      <span>Vercel Platform</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Global Edge Network & Serverless Node.js Express runtime for microsecond routing.
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Edge CDN & SPA Router</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Serves compiled static bundle from <code className="text-cyan-300 font-mono">dist/</code> with <code className="text-cyan-300 font-mono">vercel.json</code> rewrites.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                          <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Serverless API Functions</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          <code className="text-cyan-300 font-mono">/api/index.ts</code> executing Express API endpoints with auto-scaling.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="font-mono text-cyan-400">Zero Cold-Start</span>
                    <span className="text-slate-500">Auto HTTPS</span>
                  </div>
                </div>

                {/* Tier 3: AI & Intelligence Engine */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    activePlatformTab === 'all' || activePlatformTab === 'gemini'
                      ? 'bg-slate-900/90 border-purple-500/40 ring-1 ring-purple-500/20'
                      : 'bg-slate-900/40 border-slate-800 opacity-40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                        Tier 3 • Intelligence Layer
                      </span>
                      <Cpu className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Google Gemini 2.5 LLM</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Deterministic Dispatch Agent & Priority Recommendation Engine.
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                          <Workflow className="w-3.5 h-3.5" />
                          <span>Tool / Function Calling</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Strictly typed tools: <code className="text-purple-200 font-mono">request_slot_change</code>, <code className="text-purple-200 font-mono">check_availability</code>.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>5 Operational Guardrails</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Prevents hallucinated slots, enforces sanitary registration & quarantines unverified drivers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="font-mono text-purple-400">SDK: @google/genai</span>
                    <span className="text-slate-500">Deterministic</span>
                  </div>
                </div>

                {/* Tier 4: Supabase PostgreSQL & Realtime */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    activePlatformTab === 'all' || activePlatformTab === 'supabase'
                      ? 'bg-slate-900/90 border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : 'bg-slate-900/40 border-slate-800 opacity-40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Tier 4 • Data & Concurrency
                      </span>
                      <Database className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Supabase PostgreSQL</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Single Source of Truth, Row-Level Security, Atomic Holds & Realtime WebSockets.
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Atomic Concurrency Holds</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          10-minute hold locking on <code className="text-emerald-200 font-mono">dock_slots</code> prevents race condition collisions.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5" />
                          <span>Realtime Broadcast Channel</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Instant multi-client updates on <code className="text-emerald-200 font-mono">setuhaul-realtime</code> channel.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="font-mono text-emerald-400">RLS Enforced</span>
                    <span className="text-slate-500">ACID Compliant</span>
                  </div>
                </div>

              </div>

              {/* Data Flow Ribbon */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <GitMerge className="w-4 h-4 text-cyan-400" />
                  <span>Pipeline Data Interconnection:</span>
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">Client PWA</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">Vercel Edge /api</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">Gemini LLM Agent</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Supabase Atomic Lock</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Realtime Coordinator Push</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SLIDE 2: Functional Core Blocks & System Interconnections */}
          {/* ========================================================= */}
          {currentSlide === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">
                  <Layers className="w-4 h-4" />
                  <span>Slide 2 — Functional Modules</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-1">
                  Functional Blocks & Internal Micro-Interconnections
                </h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-3xl">
                  How SetuHaul divides freight responsibilities across specialized engines, maintaining deterministic execution and zero ambiguous state.
                </p>
              </div>

              {/* 4 Functional Blocks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Block 1 */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                        01
                      </div>
                      <h3 className="text-sm font-bold text-slate-100">AI Dispatch Agent & Guardrail Harness</h3>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      Module: src/agent/
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Resolves driver context from telematics, validates sanitary input against SQL/injection hazards, parses operational intent, and invokes strictly typed tool functions.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300 font-mono">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>Context Resolver: Matches active shipment & ETA delay</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>Guardrail 1-5: Rejects unverified drivers & hallucinated slots</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>Tool Dispatcher: Executes slot change & negotiation APIs</span>
                    </li>
                  </ul>
                </div>

                {/* Block 2 */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        02
                      </div>
                      <h3 className="text-sm font-bold text-slate-100">Deterministic Booking & Concurrency Engine</h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Module: src/domain/booking
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Governs physical facility constraints. Enforces 10-minute pessimistic hold locks, auto-releases expired reservations, and flags slot contention.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300 font-mono">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>Atomic Lock: <code className="text-emerald-300">HOLD_PENDING</code> prevents double-booking</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>Contention Detector: Identifies slots with requests &gt; 1</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span>Auto-TTL: Clears expired holds after 10 minutes</span>
                    </li>
                  </ul>
                </div>

                {/* Block 3 */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                        03
                      </div>
                      <h3 className="text-sm font-bold text-slate-100">Coordinator Arbitration & Yard Management</h3>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      Module: src/components/Coordinator
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Central nervous system for warehouse operations. Displays live yard occupancy, contested dock alerts, multi-factor AI arbitration advice, and manual confirmation overrides.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300 font-mono">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span>Live Yard Board: Real-time dock doors & turnaround times</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span>Arbitration Desk: 1-click slot resolution with auto-reroute</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span>Warehouse Ref Validator: Issues verifiable gate passes</span>
                    </li>
                  </ul>
                </div>

                {/* Block 4 */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                        04
                      </div>
                      <h3 className="text-sm font-bold text-slate-100">Driver Compliance & Security Gateway</h3>
                    </div>
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Module: src/context/AuthContext
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Role-based security perimeter. Manages driver identity, phone/vehicle plate sanitary checks, quarantine status (`PENDING`), and Supabase driver synchronization.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300 font-mono">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>Format Sanitizers: Validates +91 phone & vehicle registration</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>Quarantine State: Locks unverified drivers from live slots</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>Supabase Sync: Direct authentication against public.drivers</span>
                    </li>
                  </ul>
                </div>

              </div>

              {/* Functional Integration Summary */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-slate-300">
                    <strong>Cohesive Loop:</strong> No functional block operates as an isolated silo. LLM actions are filtered through the deterministic booking engine, written to Supabase ACID tables, and broadcast instantly to the coordinator desk.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SLIDE 3: Driver Registration Workflow via Coordinator Approval */}
          {/* ========================================================= */}
          {currentSlide === 2 && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Slide 3 — Security & Compliance</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-1">
                  Driver Registration Workflow via Coordinator Approval
                </h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-3xl">
                  End-to-end security gating ensuring no unverified driver can access warehouse premises or negotiate freight shipments without coordinator verification.
                </p>
              </div>

              {/* 5-Step Visual Workflow Flowchart */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">

                  {/* Step 1 */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between relative group hover:border-amber-500/40 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-xs">1</span>
                        <Truck className="w-4 h-4 text-amber-400" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100">Driver Registration</h4>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Driver enters credentials, phone (+91 format), truck plate, and carrier affiliation.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-amber-400">
                      Sanitary Check: PASS
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex flex-col justify-between relative group hover:border-amber-500/60 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-amber-500/30 text-amber-200 flex items-center justify-center font-bold text-xs">2</span>
                        <Lock className="w-4 h-4 text-amber-400" />
                      </div>
                      <h4 className="text-xs font-bold text-amber-300">Quarantine Gate</h4>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Account created with <code className="text-amber-300 font-mono">verification_status: 'PENDING'</code> in Supabase.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-amber-400">
                      Locked from Live Docks
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between relative group hover:border-purple-500/40 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs">3</span>
                        <Sparkles className="w-4 h-4 text-purple-400" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100">AI Assistant Notice</h4>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Chatbot welcomes driver and explicitly clarifies account is under review by facility coordinator.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-purple-400">
                      Guardrail: Active
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between relative group hover:border-cyan-500/40 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs">4</span>
                        <Building2 className="w-4 h-4 text-cyan-400" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100">Coordinator Review</h4>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Coordinator inspects pending queue in Driver Approvals tab, reviewing documents and carrier status.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-cyan-400">
                      Security Audit Desk
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-between relative group hover:border-emerald-500/60 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/30 text-emerald-200 flex items-center justify-center font-bold text-xs">5</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <h4 className="text-xs font-bold text-emerald-300">Approval & Dispatch</h4>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Coordinator clicks "Verify & Approve" &rarr; Supabase sets status to <code className="text-emerald-300 font-mono">VERIFIED</code> & dispatches load.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-emerald-400">
                      Gate Pass Issued
                    </div>
                  </div>

                </div>

                {/* Detailed Workflow Policy Box */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>Supabase Persistence Guarantee</span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-2xl">
                      The <code className="text-cyan-300 font-mono">public.drivers</code> table stores <code className="text-emerald-300 font-mono">verification_status ('PENDING' | 'VERIFIED' | 'REJECTED')</code>, timestamp, and coordinator ID. When approved, a real-time event updates the driver portal instantly with zero page reload.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">
                      Zero Unauthorized Access
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SLIDE 4: Coordinator Dock Assignment based on LLM Recommendation */}
          {/* ========================================================= */}
          {currentSlide === 3 && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
                  <GitMerge className="w-4 h-4" />
                  <span>Slide 4 — AI Arbitration Matrix</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-1">
                  Coordinator Dock Assignment via Gemini LLM Recommendations
                </h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-3xl">
                  When multiple shipments collide for the same dock slot, the Gemini LLM synthesizes operational telemetry into objective arbitration advice. The coordinator retains full human-in-the-loop control.
                </p>
              </div>

              {/* Two-Column Decision Flow */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Left: LLM Multi-Factor Evaluation Matrix */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-slate-100">Gemini LLM Arbitration Factors</h3>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      Weighted Scoring Model
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-200 font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-cyan-300">
                          <Radio className="w-3.5 h-3.5" />
                          <span>1. Cargo Sensitivity & Spoilage Risk</span>
                        </span>
                        <span className="text-cyan-400 font-mono">Weight: 35%</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Cold-chain reefer pharmaceuticals (e.g. SHP1014) are automatically prioritized over non-perishable dry industrial freight.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-200 font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span>2. SLA Contract & Detention Penalties</span>
                        </span>
                        <span className="text-amber-400 font-mono">Weight: 25%</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Analyzes contract detention cost thresholds and outbound connection departure schedules.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-200 font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-emerald-300">
                          <Zap className="w-3.5 h-3.5" />
                          <span>3. Real-Time Telematics & ETA Confidence</span>
                        </span>
                        <span className="text-emerald-400 font-mono">Weight: 25%</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Combines GPS highway coordinates, toll booth timestamps, and weather buffers into a confidence score (0.00 – 1.00).
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-200 font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-purple-300">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>4. Physical Dock Equipment Match</span>
                        </span>
                        <span className="text-purple-400 font-mono">Weight: 15%</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Matches specialized trailers (e.g. heavy cargo needing Dock D6's 20-ton hydraulic leveler) with appropriate door capabilities.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Coordinator Action Console Example */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-slate-100">Coordinator Decision Console</h3>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Human-in-the-Loop
                      </span>
                    </div>

                    {/* Simulated Alert Card */}
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Slot Contention Detected: Dock D1 (14:00)</span>
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                          2 Contenders
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 space-y-1">
                        <div>• <strong>Contender A:</strong> DRV006 (Vikram Malhotra) — Cold Reefer (Urgency: CRITICAL)</div>
                        <div>• <strong>Contender B:</strong> DRV007 (Amit Singh) — Heavy Machinery (Urgency: MEDIUM)</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-[11px] text-purple-200">
                        <strong>AI Recommendation:</strong> Award Dock D1 to DRV006 due to pharma temperature sensitivity. Gracefully re-route DRV007 to Dock D6 with zero queue collision.
                      </div>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <div className="text-xs font-bold text-slate-200">1-Click Arbitration Outcome:</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        When the coordinator clicks <strong>"Resolve Contention & Auto-Reroute"</strong>, Supabase atomically commits both appointments, releases all temporary holds, and dispatches turn-by-turn navigation to both drivers.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Arbitration Latency: <strong className="text-emerald-400 font-mono">&lt; 350ms</strong></span>
                    <span className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono text-[11px]">
                      Zero Double-Booking
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SLIDE 5: Technology Stack, Operational Flywheel & Demo Guide */}
          {/* ========================================================= */}
          {currentSlide === 4 && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
                  <Zap className="w-4 h-4" />
                  <span>Slide 5 — Production Readiness</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-1">
                  Enterprise Production Flywheel & Live Demo Script
                </h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-3xl">
                  SetuHaul transforms chaotic freight yard scheduling into an automated, auditable, and resilient logistics pipeline.
                </p>
              </div>

              {/* 3 Value Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                    ▲
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Serverless Vercel Deployment</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Zero-maintenance global deployment. Pre-configured with <code className="text-cyan-300 font-mono">vercel.json</code>, automated edge static asset delivery, and Node.js serverless API routes.
                  </p>
                  <div className="pt-2 text-[11px] font-mono text-cyan-400">
                    Ready for 1-Click Vercel Deploy
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
                    ✦
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Gemini LLM Dispatch Agent</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Autonomous tool-calling agent enforcing 5 strict operational guardrails. Never hallucinates warehouse docks; validates every slot against physical yard schema.
                  </p>
                  <div className="pt-2 text-[11px] font-mono text-purple-400">
                    Deterministic Dispatching
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                    ⚡
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Supabase ACID Concurrency</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    PostgreSQL row-level locking on <code className="text-emerald-300 font-mono">dock_slots</code> and <code className="text-emerald-300 font-mono">public.drivers</code>. 10-minute hold TTLs with sub-100ms real-time WebSockets.
                  </p>
                  <div className="pt-2 text-[11px] font-mono text-emerald-400">
                    Single Source of Truth
                  </div>
                </div>
              </div>

              {/* Live Demonstration Step-by-Step Box */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>Recommended Live Demo Flow for Evaluators</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">3-Minute Evaluation Script</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200">1. Driver Chat & Negotiation:</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Log in as <strong>DRV006 (Vikram)</strong>. Chat: <em>"My truck was delayed by traffic, can I get Dock D1 at 14:00?"</em> Observe Gemini agent tool call.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200">2. Concurrency Contention:</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      In an incognito window, attempt to book the exact same slot with <strong>DRV001</strong>. Observe atomic HTTP 409 conflict and contention alert.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <strong className="text-slate-200">3. Coordinator Verification:</strong>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Switch to Coordinator Portal. Open <strong>Driver Approvals</strong> to verify new drivers, then open <strong>Realtime Alerts</strong> to resolve contention with 1 click.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Bottom Navigation & Slide Indicator Bar */}
      <footer className="h-16 border-t border-slate-800 bg-slate-900/95 px-4 md:px-8 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentSlide === 0}
            onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <button
            type="button"
            disabled={currentSlide === totalSlides - 1}
            onClick={() => setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1))}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-600/30"
          >
            <span className="hidden sm:inline">Next Slide</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Thumbnail / Dot Selector */}
        <div className="flex items-center gap-2">
          {[
            'Platform Architecture',
            'Functional Blocks',
            'Driver Verification',
            'Dock Arbitration',
            'Demo & Flywheel',
          ].map((title, idx) => (
            <button
              key={title}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                currentSlide === idx
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentSlide === idx ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="hidden md:inline">{title}</span>
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-slate-500 hidden lg:block">
          Use <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">→</kbd> to navigate
        </div>
      </footer>
    </div>
  );
};
