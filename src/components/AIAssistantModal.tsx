import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import {
  Mic,
  MicOff,
  Send,
  X,
  User,
  PlusCircle,
  Users,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Utensils,
  Coffee,
  ShoppingBag,
  Banknote,
  Clock,
  Zap,
  RotateCcw,
  Store,
  Smartphone,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  QrCode,
} from 'lucide-react';
import { useStore } from '../store';
import { currencySymbol } from '../utils';
import { parseLocallyClient } from '../nlp';
import { uid, todayISO } from '../db';
import type { ExpenseType, ExpenseFlow } from '../types';
import type { ExpenseInitialData } from './ExpenseModal';
import { getFrequentTasks, type FrequentTaskItem } from '../utils/frequentTasks';
import { showSoftKeyboard } from '../utils/keyboard';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart?: () => void;
  onresult: (event: { resultIndex: number; results: Array<Array<{ transcript: string }> & { isFinal?: boolean }> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
}

function AudioWaveVisualizer({ volume, isListening }: { volume: number; isListening: boolean }) {
  if (!isListening) return null;

  const barConfigs = [
    { mult: 0.55 },
    { mult: 0.95 },
    { mult: 1.45 },
    { mult: 1.25 },
    { mult: 0.85 },
    { mult: 0.45 },
  ];

  return (
    <div className="flex items-center gap-[3px] px-2 py-1 h-7 rounded-full bg-rose-500/10 border border-rose-500/25 shrink-0">
      {barConfigs.map((cfg, idx) => {
        const computedHeight = Math.max(4, Math.min(22, 4 + volume * cfg.mult * 26));
        return (
          <div
            key={idx}
            style={{
              height: `${computedHeight}px`,
              opacity: Math.max(0.4, Math.min(1, 0.5 + volume * 0.7)),
              boxShadow: volume > 0.15 ? '0 0 6px rgba(239, 68, 68, 0.45)' : 'none',
            }}
            className="w-[3px] rounded-full bg-[var(--debit)] transition-all duration-75"
          />
        );
      })}
    </div>
  );
}

interface DraftExpense {
  description: string;
  amount: number;
  category: string;
  type: ExpenseType;
  flow: ExpenseFlow;
  whoPaid?: 'me' | 'other';
  splitMode?: 'just_me' | 'equal_split' | 'custom_split' | 'for_friend' | 'pay_debt' | 'by_friend';
  myShare?: number | null;
  friendShare?: number | null;
  walletName?: string;
  friendName?: string | null;
  friendNames?: string[];
  vendorName?: string | null;
  date: string;
  status?: string;
  notes?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  draft?: DraftExpense | null;
}

interface ParsedBullet {
  raw: string;
  kind: 'friend_debt' | 'wallet' | 'category_spending' | 'transaction' | 'generic';
  label: string;
  subText?: string;
  amount?: string;
  badgeType?: 'credit' | 'debit' | 'neutral';
  badgeText?: string;
  isOwedToMe?: boolean;
  category?: string;
}

const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', text: '#ffffff' },
  { bg: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', text: '#ffffff' },
  { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', text: '#ffffff' },
  { bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', text: '#ffffff' },
  { bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', text: '#ffffff' },
  { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#ffffff' },
  { bg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', text: '#ffffff' },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function getWalletTheme(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('cash')) {
    return {
      icon: <Banknote size={15} strokeWidth={2.2} />,
      bg: 'rgba(34, 197, 94, 0.14)',
      border: 'rgba(34, 197, 94, 0.28)',
      color: '#22c55e',
    };
  }
  if (lower.includes('gpay') || lower.includes('google')) {
    return {
      icon: <Smartphone size={15} strokeWidth={2.2} />,
      bg: 'rgba(59, 130, 246, 0.14)',
      border: 'rgba(59, 130, 246, 0.28)',
      color: '#3b82f6',
    };
  }
  if (lower.includes('phonepe') || lower.includes('phone pe')) {
    return {
      icon: <Zap size={15} strokeWidth={2.2} />,
      bg: 'rgba(168, 85, 247, 0.14)',
      border: 'rgba(168, 85, 247, 0.28)',
      color: '#a855f7',
    };
  }
  if (lower.includes('paytm')) {
    return {
      icon: <QrCode size={15} strokeWidth={2.2} />,
      bg: 'rgba(6, 182, 212, 0.14)',
      border: 'rgba(6, 182, 212, 0.28)',
      color: '#06b6d4',
    };
  }
  if (lower.includes('bank') || lower.includes('sbi') || lower.includes('hdfc') || lower.includes('icici') || lower.includes('axis')) {
    return {
      icon: <Landmark size={15} strokeWidth={2.2} />,
      bg: 'rgba(14, 165, 233, 0.14)',
      border: 'rgba(14, 165, 233, 0.28)',
      color: '#0ea5e9',
    };
  }
  if (lower.includes('card') || lower.includes('credit')) {
    return {
      icon: <CreditCard size={15} strokeWidth={2.2} />,
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.28)',
      color: '#f59e0b',
    };
  }
  return {
    icon: <Wallet size={15} strokeWidth={2.2} />,
    bg: 'var(--accent-soft)',
    border: 'rgba(99, 102, 241, 0.28)',
    color: 'var(--accent)',
  };
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|₹[\d,.]+|\$[\d,.]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} style={{ fontWeight: 700, color: 'var(--text)' }}>
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.match(/^(?:₹|\$)[\d,.]+/)) {
      return (
        <span
          key={i}
          style={{
            fontWeight: 700,
            color: 'var(--accent)',
            backgroundColor: 'var(--accent-soft)',
            padding: '2px 6px',
            borderRadius: '6px',
            display: 'inline-block',
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function parseBulletLine(line: string): ParsedBullet {
  const clean = line.replace(/^[•\-*\d.]+\s*/, '').trim();

  // Pattern 1: Debt/Friend: e.g. "Hrishi: owes you ₹975" or "Hrishi: you owe ₹200" or "Hrishi owes you ₹975"
  const owesMatch = clean.match(/^([^:-]+)[:-]?\s*(owes you|you owe|owes|is owed)\s*(?:₹|\$|INR)?\s*([\d,.]+)/i);
  if (owesMatch) {
    const name = owesMatch[1].trim();
    const relation = owesMatch[2].toLowerCase();
    const amtStr = owesMatch[3];
    const isOwedToMe = relation.includes('owes you') || relation === 'owes';
    return {
      raw: clean,
      kind: 'friend_debt',
      label: name,
      amount: `₹${amtStr}`,
      badgeText: isOwedToMe ? `Owes you ₹${amtStr}` : `You owe ₹${amtStr}`,
      badgeType: isOwedToMe ? 'credit' : 'debit',
      isOwedToMe,
    };
  }

  // Pattern 2: Transaction item e.g. "2026-08-27: Tiffin (+₹75) [Food & Dining]"
  const txMatch = clean.match(/^([\d-]+)[:-]\s*(.*?)\s*\(([+-]?)(?:₹|\$|INR)?([\d,.]+)\)\s*(?:\[(.*?)\])?/i);
  if (txMatch) {
    const date = txMatch[1];
    const desc = txMatch[2];
    const sign = txMatch[3] || '-';
    const amt = txMatch[4];
    const cat = txMatch[5];
    const isCredit = sign === '+';
    return {
      raw: clean,
      kind: 'transaction',
      label: desc,
      subText: `${date}${cat ? ` • ${cat}` : ''}`,
      amount: `${sign}₹${amt}`,
      badgeType: isCredit ? 'credit' : 'neutral',
      category: cat,
    };
  }

  // Pattern 3: Wallet / Account e.g. "Google Pay: ₹1,403.52" or "Cash: ₹0"
  const accountMatch = clean.match(/^([^:-]+)[:-]\s*(?:₹|\$|INR)?\s*([\d,.]+)/i);
  if (accountMatch) {
    const accountName = accountMatch[1].trim();
    const amtStr = accountMatch[2];
    return {
      raw: clean,
      kind: 'wallet',
      label: accountName,
      amount: `₹${amtStr}`,
      badgeType: 'neutral',
    };
  }

  // Pattern 4: Expense format e.g. "Coffee - ₹30 (Food, Cash)"
  const expMatch = clean.match(/^([^-:]+)(?:[-:]\s*(?:₹|\$|INR)?\s*([\d,.]+))?\s*(?:\((.*?)\))?/i);
  if (expMatch && expMatch[2]) {
    return {
      raw: clean,
      kind: 'generic',
      label: expMatch[1].trim(),
      amount: `₹${expMatch[2]}`,
      subText: expMatch[3] ? expMatch[3].trim() : undefined,
      badgeType: 'neutral',
    };
  }

  return {
    raw: clean,
    kind: 'generic',
    label: clean,
  };
}

function BotMessageBubble({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: Array<{ type: 'text'; content: string } | { type: 'bullets'; items: ParsedBullet[] }> = [];
  let currentBullets: ParsedBullet[] = [];

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      blocks.push({ type: 'bullets', items: [...currentBullets] });
      currentBullets = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }

    if (trimmed.match(/^[•\-*]/) || trimmed.match(/^\d+[.)]/)) {
      currentBullets.push(parseBulletLine(trimmed));
    } else {
      flushBullets();
      blocks.push({ type: 'text', content: trimmed });
    }
  }
  flushBullets();

  return (
    <div className="px-3.5 sm:px-4 py-3 rounded-2xl bg-[var(--surface2)] text-[var(--text)] max-w-[95%] sm:max-w-[88%] border border-[var(--border)] shadow-sm flex flex-col gap-3">
      {blocks.map((block, idx) => {
        if (block.type === 'text') {
          return (
            <p
              key={idx}
              className="leading-relaxed text-[13px] text-[var(--text)] font-medium whitespace-pre-wrap"
            >
              {renderFormattedText(block.content)}
            </p>
          );
        }

        return (
          <div key={idx} className="flex flex-col gap-2 my-0.5">
            {block.items.map((bullet, bIdx) => {
              if (bullet.kind === 'friend_debt') {
                const avatar = getAvatarStyle(bullet.label);
                const initial = bullet.label.trim().charAt(0).toUpperCase() || 'F';
                const isPositive = bullet.isOwedToMe;

                return (
                  <div
                    key={bIdx}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs transition-all hover:bg-[var(--surface3)] hover:-translate-y-0.5"
                    style={{
                      borderColor: isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    {/* Left: Avatar & Name */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs"
                        style={{
                          background: avatar.bg,
                          color: avatar.text,
                        }}
                      >
                        {initial}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-[13.5px] font-semibold text-[var(--text)] truncate leading-tight">
                          {bullet.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-3)] font-medium">
                          Friend
                        </span>
                      </div>
                    </div>

                    {/* Right: Vibrant Pill Badge */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 border shadow-xs ${
                        isPositive
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-emerald-500/10'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-rose-500/10'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowDownLeft size={13} strokeWidth={2.6} />
                      ) : (
                        <ArrowUpRight size={13} strokeWidth={2.6} />
                      )}
                      <span>{bullet.badgeText}</span>
                    </div>
                  </div>
                );
              }

              if (bullet.kind === 'wallet') {
                const theme = getWalletTheme(bullet.label);
                const isZero = bullet.amount === '₹0' || bullet.amount === '$0' || bullet.amount === '0';

                return (
                  <div
                    key={bIdx}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs transition-all hover:bg-[var(--surface3)] hover:-translate-y-0.5"
                    style={{ borderColor: theme.border }}
                  >
                    {/* Left: Themed Icon & Account Name */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                        style={{
                          background: theme.bg,
                          borderColor: theme.border,
                          color: theme.color,
                        }}
                      >
                        {theme.icon}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-[13.5px] font-semibold text-[var(--text)] truncate leading-tight">
                          {bullet.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-3)] font-medium">
                          Account
                        </span>
                      </div>
                    </div>

                    {/* Right: Clean Balance Pill */}
                    <div
                      className={`px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs font-bold shrink-0 ${
                        isZero ? 'bg-[var(--surface2)] text-[var(--text-3)]' : 'bg-[var(--surface2)] text-[var(--text)] font-extrabold'
                      }`}
                    >
                      {bullet.amount}
                    </div>
                  </div>
                );
              }

              // Fallback / Transaction / Generic Item
              return (
                <div
                  key={bIdx}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs transition-all hover:border-[var(--accent)] hover:bg-[var(--surface3)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                        bullet.badgeType === 'credit'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-[var(--credit)]'
                          : 'bg-[var(--surface2)] border-[var(--border)] text-[var(--accent)]'
                      }`}
                    >
                      {bullet.badgeType === 'credit' ? (
                        <TrendingUp size={14} />
                      ) : bullet.amount ? (
                        <CreditCard size={14} />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[var(--text)] truncate">
                        {bullet.label}
                      </span>
                      {bullet.subText && (
                        <span className="text-[11px] text-[var(--text-3)] truncate">
                          {bullet.subText}
                        </span>
                      )}
                    </div>
                  </div>

                  {bullet.amount && (
                    <div
                      className={`px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs font-bold shrink-0 bg-[var(--surface2)] ${
                        bullet.badgeType === 'credit' ? 'text-[var(--credit)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {bullet.amount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
  onOpenAddExpense?: (initialData?: ExpenseInitialData) => void;
}

export default function AIAssistantModal({ open, onClose, onOpenAddExpense }: AIAssistantModalProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');

  const { db, addExpense, addFriend, showToast } = useStore();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 70) {
      onClose();
    }
    setDragOffsetY(0);
    touchStartYRef.current = null;
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [activeDraft, setActiveDraft] = useState<DraftExpense | null>(null);

  const handleRestartChat = useCallback(() => {
    setMessages([]);
    setActiveDraft(null);
    setInputText('');
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const msgCounterRef = useRef(1);

  // Auto-focus text input when AI modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (textInputRef.current) {
          showSoftKeyboard(textInputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Audio analyzer refs & volume state for live wave visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);

  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    setVolumeLevel(0);
  }, []);

  const startAudioAnalysis = useCallback(async (existingStream?: MediaStream) => {
    stopAudioAnalysis();
    try {
      let stream = existingStream;
      if (!stream) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      mediaStreamRef.current = stream;

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const norm = Math.min(1, Math.max(0, average / 65));
        setVolumeLevel(norm);

        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Audio volume analysis unavailable:', err);
    }
  }, [stopAudioAnalysis]);

  const generateMsgId = () => {
    msgCounterRef.current += 1;
    return `msg_${msgCounterRef.current}`;
  };

  const categories = (db.settings?.categories || []).map(c => c.name);
  const wallets = db.wallets || [];
  const friends = db.friends || [];
  const currency = db.settings?.currency || 'INR';
  const currSym = currencySymbol(currency);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (activeDraft) {
      setTimeout(() => {
        contentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, loading, activeDraft]);

  // Cleanup speech recognition and audio stream on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [stopAudioAnalysis]);

  const toggleListening = async () => {
    if (isListening) {
      stopAudioAnalysis();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;

    let activeStream: MediaStream | null = null;

    try {
      // 1. Request Native / OS microphone permission via getUserMedia
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (mediaErr) {
          console.warn('Microphone permission check failed:', mediaErr);
          const errName = (mediaErr as Error)?.name;
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            showToast('Microphone access denied. Please grant microphone permission in device/app settings.');
          } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            showToast('No microphone found on this device.');
          } else {
            showToast('Unable to access microphone. Please check app permissions.');
          }
          setIsListening(false);
          return;
        }
      }

      if (!SpeechRecognitionClass) {
        if (Capacitor.isNativePlatform()) {
          showToast('Speech recognition service is not enabled on this mobile device. Please use text input or install Google Speech Services.');
        } else {
          showToast('Voice input is not supported in this browser. Please type your command.');
        }
        if (activeStream) {
          activeStream.getTracks().forEach(t => t.stop());
        }
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      setInputText('');

      recognition.onstart = () => {
        setIsListening(true);
        if (activeStream) {
          startAudioAnalysis(activeStream);
        }
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text) {
          setInputText(text);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        stopAudioAnalysis();
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showToast('Microphone access blocked. Please allow mic permission in app settings.');
        } else if (event.error === 'audio-capture') {
          showToast('No microphone detected.');
        } else if (event.error === 'network') {
          showToast('Network issue during speech recognition.');
        } else if (event.error !== 'no-speech') {
          showToast(`Mic error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        stopAudioAnalysis();
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      if (activeStream) {
        startAudioAnalysis(activeStream);
      }
    } catch (err) {
      console.error('Error starting mic:', err);
      stopAudioAnalysis();
      setIsListening(false);
      showToast('Could not start microphone. Please check permissions or try typing.');
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    if (isListening) {
      stopAudioAnalysis();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: generateMsgId(),
      sender: 'user',
      text: query,
      timestamp: timeStr,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    setTimeout(() => {
      const localResult = parseLocallyClient(query, categories, friends, wallets, currency, db);
      const botMsg: Message = {
        id: generateMsgId(),
        sender: 'bot',
        text: localResult.reply,
        timestamp: timeStr,
        draft: localResult.draft || null,
      };

      setMessages(prev => [...prev, botMsg]);

      if (localResult.draft) {
        const d = localResult.draft as DraftExpense;
        if (d.whoPaid === 'other' || d.type === 'by_friend' || d.splitMode === 'by_friend') {
          d.whoPaid = 'other';
          d.type = 'by_friend';
          d.splitMode = 'by_friend';
        } else if (!d.splitMode) {
          if (d.type === 'for_friend') d.splitMode = 'equal_split';
          else d.splitMode = 'just_me';
        }

        if (d.friendName && (!d.friendNames || d.friendNames.length === 0)) {
          d.friendNames = [d.friendName];
        } else if (d.friendNames && d.friendNames.length > 0 && !d.friendName) {
          d.friendName = d.friendNames.join(', ');
        }

        if (d.splitMode === 'equal_split') {
          if (d.myShare == null) d.myShare = Math.round((d.amount / 2) * 100) / 100;
          if (d.friendShare == null) d.friendShare = Math.round((d.amount / 2) * 100) / 100;
        }

        if (onOpenAddExpense) {
          const matchedWallet = wallets.find(w => w.name.toLowerCase() === (d.walletName || '').toLowerCase()) || wallets[0];
          
          let resolvedFriendIds: string[] = [];
          if (d.friendNames && d.friendNames.length > 0) {
            resolvedFriendIds = d.friendNames
              .map(name => friends.find(f => f.name.toLowerCase() === name.trim().toLowerCase())?.id)
              .filter((id): id is string => Boolean(id));
          } else if (d.friendName) {
            const splitted = d.friendName.split(',').map(s => s.trim().toLowerCase());
            resolvedFriendIds = splitted
              .map(name => friends.find(f => f.name.toLowerCase() === name)?.id)
              .filter((id): id is string => Boolean(id));
          }

          const matchedFriend = friends.find(f => f.name.toLowerCase() === (d.friendName || '').toLowerCase());
          const primaryFriendId = resolvedFriendIds[0] || matchedFriend?.id;

          onOpenAddExpense({
            description: d.description,
            amount: d.amount,
            category: d.category,
            type: d.type,
            flow: d.flow,
            whoPaid: d.whoPaid === 'other' || d.type === 'by_friend' || d.splitMode === 'by_friend' ? 'other' : (d.whoPaid || 'me'),
            splitMode: (d.splitMode === 'for_friend' || d.splitMode === 'equal_split' || d.splitMode === 'custom_split') ? 'for_friend' : (d.splitMode === 'pay_debt' ? 'pay_debt' : 'just_me'),
            walletId: matchedWallet?.id,
            friendId: primaryFriendId,
            friendIds: resolvedFriendIds.length > 0 ? resolvedFriendIds : (primaryFriendId ? [primaryFriendId] : undefined),
            date: d.date || todayISO(),
            notes: d.notes || 'Added via Max Assistant',
          });
        } else {
          setActiveDraft(d);
        }
      }
      setLoading(false);
    }, 120);
  };

  const handleConfirmDraft = () => {
    if (!activeDraft) return;

    const matchedWallet = wallets.find(
      w => w.name.toLowerCase() === (activeDraft.walletName || '').toLowerCase()
    ) || wallets[0];

    let friendList: string[] = [];
    if (activeDraft.friendNames && activeDraft.friendNames.length > 0) {
      friendList = activeDraft.friendNames;
    } else if (activeDraft.friendName) {
      friendList = activeDraft.friendName.split(',').map(s => s.trim()).filter(Boolean);
    }

    const resolvedFriends = friendList.map(nameStr => {
      let fObj = friends.find(f => f.name.toLowerCase() === nameStr.toLowerCase());
      if (!fObj && nameStr && (activeDraft.splitMode !== 'just_me' || activeDraft.type === 'by_friend' || activeDraft.whoPaid === 'other')) {
        fObj = addFriend({ name: nameStr, type: 'friend' });
      }
      return fObj;
    }).filter(Boolean);

    const totalAmt = Number(activeDraft.amount) || 0;
    const itemDesc = activeDraft.description?.trim() || 'Expense';
    const itemCat = activeDraft.category || (activeDraft.flow === 'in' ? 'Income' : categories[0] || 'Food');
    const itemDate = activeDraft.date || todayISO();
    const itemWalletId = matchedWallet?.id || wallets[0]?.id || '';
    const itemFlow = activeDraft.flow || 'out';

    const isFriendPaid = activeDraft.whoPaid === 'other' || activeDraft.type === 'by_friend' || activeDraft.splitMode === 'by_friend';
    const mode = isFriendPaid ? 'by_friend' : (activeDraft.splitMode || (activeDraft.type === 'personal' ? 'just_me' : 'equal_split'));

    if (itemFlow === 'in') {
      addExpense({
        description: itemDesc,
        amount: totalAmt,
        category: itemCat || 'Income',
        date: itemDate,
        type: 'personal',
        flow: 'in',
        friendId: resolvedFriends[0] ? resolvedFriends[0].id : null,
        walletId: itemWalletId,
        status: 'paid',
        notes: activeDraft.notes || 'Added via Max',
      });
      showToast(`Recorded Income: ${itemDesc} (${currSym}${totalAmt})`);
    } else if (mode === 'equal_split' || mode === 'custom_split') {
      const numFriends = Math.max(1, resolvedFriends.length);
      const perPersonDefault = Math.round((totalAmt / (numFriends + 1)) * 100) / 100;

      const myShareAmt = activeDraft.myShare ?? perPersonDefault;
      const totalFriendSharesAmt = totalAmt - myShareAmt;
      const eachFriendShare = Math.round((totalFriendSharesAmt / numFriends) * 100) / 100;
      const groupId = uid('grp');

      resolvedFriends.forEach((fObj) => {
        if (!fObj) return;
        if (eachFriendShare > 0) {
          addExpense({
            groupId,
            description: itemDesc,
            amount: eachFriendShare,
            category: itemCat,
            date: itemDate,
            type: 'for_friend',
            flow: 'out',
            friendId: fObj.id,
            walletId: itemWalletId,
            status: 'unsettled',
            notes: activeDraft.notes || `Split expense with ${fObj.name}`,
          });
        }
      });

      if (myShareAmt > 0) {
        addExpense({
          groupId,
          description: itemDesc,
          amount: myShareAmt,
          category: itemCat,
          date: itemDate,
          type: 'personal',
          flow: 'out',
          friendId: resolvedFriends.length === 1 && resolvedFriends[0] ? resolvedFriends[0].id : null,
          walletId: itemWalletId,
          status: 'paid',
          notes: activeDraft.notes || `My share of ${itemDesc}`,
        });
      }

      showToast(`Added split: ${itemDesc} with ${resolvedFriends.map(f => f?.name).join(', ') || 'Friend'}`);
    } else if (mode === 'for_friend' || activeDraft.type === 'for_friend') {
      const numFriends = Math.max(1, resolvedFriends.length);
      const perFriendAmt = Math.round((totalAmt / numFriends) * 100) / 100;
      const groupId = uid('grp');

      resolvedFriends.forEach((fObj) => {
        if (!fObj) return;
        addExpense({
          groupId: resolvedFriends.length > 1 ? groupId : undefined,
          description: itemDesc,
          amount: perFriendAmt,
          category: itemCat,
          date: itemDate,
          type: 'for_friend',
          flow: 'out',
          friendId: fObj.id,
          walletId: itemWalletId,
          status: 'unsettled',
          notes: activeDraft.notes || `Paid on behalf of ${fObj.name}`,
        });
      });
      showToast(`Added expense for ${resolvedFriends.map(f => f?.name).join(', ') || 'Friend'}`);
    } else if (activeDraft.whoPaid === 'other' || activeDraft.type === 'by_friend') {
      const myOwedAmt = activeDraft.myShare ?? totalAmt;
      const fObj = resolvedFriends[0];
      addExpense({
        description: itemDesc,
        amount: myOwedAmt,
        category: itemCat,
        date: itemDate,
        type: 'by_friend',
        flow: 'out',
        friendId: fObj ? fObj.id : null,
        walletId: itemWalletId,
        status: 'unsettled',
        notes: activeDraft.notes || `Paid by ${fObj?.name || 'Friend'}`,
      });
      showToast(`Recorded debt owed to ${fObj?.name || 'Friend'}`);
    } else {
      addExpense({
        description: itemDesc,
        amount: totalAmt,
        category: itemCat,
        date: itemDate,
        type: 'personal',
        flow: 'out',
        friendId: null,
        walletId: itemWalletId,
        status: 'paid',
        notes: activeDraft.notes || 'Added via Max',
      });
      showToast(`Added ${itemDesc} (${currSym}${totalAmt})`);
    }

    setMessages(prev => [
      ...prev,
      {
        id: generateMsgId(),
        sender: 'bot',
        text: `Success! Recorded "${itemDesc}" (${currSym}${totalAmt}).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    setActiveDraft(null);
  };

  // Dynamically compute frequent actions and quick query shortcuts learned from ledger
  const { frequentActions, otherActions } = useMemo(() => {
    const frequent: Array<{
      icon: React.ReactNode;
      label: string;
      subText?: string;
      prompt: string;
      taskItem?: FrequentTaskItem;
    }> = [];

    const others: Array<{
      icon: React.ReactNode;
      label: string;
      prompt: string;
    }> = [];

    const getIconForTask = (task: FrequentTaskItem) => {
      if (task.vendorId || task.vendorName) return <Store size={14} />;
      const lower = task.description.toLowerCase();
      if (lower.includes('coffee') || lower.includes('tea') || lower.includes('chai') || lower.includes('cafe')) return <Coffee size={14} />;
      if (lower.includes('food') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('meal') || lower.includes('snack') || lower.includes('tiffin') || lower.includes('burger') || lower.includes('poha')) return <Utensils size={14} />;
      if (lower.includes('groc') || lower.includes('mart') || lower.includes('store') || lower.includes('shop')) return <ShoppingBag size={14} />;
      if (lower.includes('salary') || lower.includes('income') || lower.includes('pay')) return <TrendingUp size={14} />;
      if (lower.includes('bill') || lower.includes('util') || lower.includes('rent') || lower.includes('wifi')) return <CreditCard size={14} />;
      if (lower.includes('auto') || lower.includes('uber') || lower.includes('cab') || lower.includes('fuel') || lower.includes('petrol')) return <Zap size={14} />;
      return <TrendingDown size={14} />;
    };

    const frequentTasksList = getFrequentTasks(db);
    frequentTasksList.forEach(task => {
      frequent.push({
        icon: getIconForTask(task),
        label: task.label,
        subText: task.subText,
        prompt: task.prompt,
        taskItem: task,
      });
    });

    // 2. Other actions (Insights, Balances, Debts, History)
    others.push({
      icon: <Banknote size={14} />,
      label: 'Account balances',
      prompt: 'What are my account balances?',
    });

    others.push({
      icon: <Users size={14} />,
      label: 'Who owes me',
      prompt: 'Who owes me money right now?',
    });

    others.push({
      icon: <Clock size={14} />,
      label: 'Monthly spend',
      prompt: 'How much did I spend this month?',
    });

    others.push({
      icon: <TrendingDown size={14} />,
      label: 'Recent expenses',
      prompt: 'Show my recent transactions',
    });

    return { frequentActions: frequent.slice(0, 4), otherActions: others.slice(0, 4) };
  }, [db]);


  // Header without any horizontal divider lines
  const headerContent = (
    <div className={`px-4 sm:px-6 ${isMobile ? 'pt-2' : 'pt-5'} pb-3 flex items-center justify-between bg-[var(--surface)] gap-2`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center shrink-0">
          <Sparkles size={17} color="currentColor" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-nowrap">
            <h3 className="font-bold text-base sm:text-lg text-[var(--text)] leading-tight whitespace-nowrap">
              Max Assistant
            </h3>
          </div>
          <span className="text-[11px] sm:text-xs text-[var(--text-3)] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
            Voice & text financial assistant
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleRestartChat}
            title="Restart chat & clear history"
            className="w-8 h-8 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--text-2)] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/30 flex items-center justify-center transition-all"
          >
            <RotateCcw size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface3)] hover:text-[var(--text)] flex items-center justify-center transition-all"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );

  // Main body without splitting lines
  const mainBodyContent = (
    <div className="px-4 sm:px-6 py-2 flex flex-col gap-4 flex-1 overflow-y-auto bg-[var(--surface)]">
      {/* Empty State: Minimal, Clean Actions */}
      {messages.length === 0 && !activeDraft && (
        <div className="flex flex-col gap-5 my-auto py-3">
          {/* Frequent Actions */}
          {frequentActions.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-bold text-[var(--text-3)] uppercase tracking-wider text-[11px] px-0.5 flex items-center gap-1.5">
                <Sparkles size={12} color="var(--accent)" />
                Frequent Actions
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {frequentActions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (item.taskItem) {
                        const t = item.taskItem;
                        if (onOpenAddExpense) {
                          onOpenAddExpense({
                            description: t.description,
                            amount: t.amount,
                            category: t.category,
                            flow: t.flow,
                            whoPaid: t.whoPaid,
                            type: t.type,
                            splitMode: t.splitMode === 'pay_debt' ? 'pay_debt' : (t.type === 'for_friend' || (t.friendIds && t.friendIds.length > 0) ? 'for_friend' : 'just_me'),
                            friendId: t.friendId || (t.friendIds && t.friendIds[0]) || undefined,
                            friendIds: t.friendIds && t.friendIds.length > 0 ? t.friendIds : (t.friendId ? [t.friendId] : undefined),
                            vendorId: t.vendorId || undefined,
                            status: t.status,
                            walletId: t.walletId || undefined,
                            date: todayISO(),
                          });
                          onClose();
                        } else {
                          const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const walletNameVal = (t.walletId && db.wallets.find(w => w.id === t.walletId)?.name) || db.wallets[0]?.name || 'Cash';
                          const resolvedFriendName = (t.friendNames && t.friendNames.length > 0)
                            ? t.friendNames.join(', ')
                            : (t.friendName || undefined);

                          const d: DraftExpense = {
                            description: t.description,
                            amount: t.amount,
                            category: t.category,
                            flow: t.flow,
                            whoPaid: t.whoPaid,
                            type: t.type,
                            splitMode: t.splitMode === 'pay_debt' ? 'pay_debt' : (t.type === 'for_friend' || (t.friendIds && t.friendIds.length > 0) ? 'for_friend' : 'just_me'),
                            friendName: resolvedFriendName,
                            vendorName: t.vendorName || undefined,
                            walletName: walletNameVal,
                            date: todayISO(),
                          };
                          setActiveDraft(d);
                          setMessages(prev => [
                            ...prev,
                            {
                              id: generateMsgId(),
                              sender: 'bot',
                              text: `Prepared quick entry for ${t.label} (${currencySymbol(currency)}${t.amount}). Review and confirm below:`,
                              timestamp: nowTimeStr,
                              draft: d,
                            },
                          ]);
                        }
                      } else {
                        handleSend(item.prompt);
                      }
                    }}
                    className="px-3 py-2.5 rounded-lg bg-[var(--surface2)] border border-[var(--border)] cursor-pointer select-none flex items-center justify-between gap-2 transition-all hover:bg-[var(--surface3)] hover:border-[var(--accent)] hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="text-[var(--accent)] flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <span className="font-semibold text-xs text-[var(--text)] truncate">
                          {item.taskItem?.description || item.label}
                        </span>

                        {/* Friend Badge (Name badge if 1 friend, initials badge if multiple friends) */}
                        {item.taskItem && ((item.taskItem.friendNames && item.taskItem.friendNames.length > 0) || item.taskItem.friendName) && (() => {
                          const names = item.taskItem.friendNames && item.taskItem.friendNames.length > 0
                            ? item.taskItem.friendNames
                            : (item.taskItem.friendName ? [item.taskItem.friendName] : []);
                          if (names.length === 0) return null;
                          const isByOther = item.taskItem.whoPaid === 'other' || item.taskItem.type === 'by_friend';
                          
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 leading-tight border ${
                                isByOther
                                  ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                  : 'bg-indigo-500/15 text-[var(--accent)] border-indigo-500/30'
                              }`}
                            >
                              {names.length === 1 ? (
                                <span>{isByOther ? `by ${names[0]}` : names[0]}</span>
                              ) : (
                                <span>{names.map(n => n.charAt(0).toUpperCase()).join('+')}</span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {item.subText && (
                      <span className="text-[11px] font-semibold text-[var(--text-3)] shrink-0">
                        {item.subText}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Quick Actions & Queries */}
          <div className="flex flex-col gap-2">
            <span className="font-bold text-[var(--text-3)] uppercase tracking-wider text-[11px] px-0.5">
              Quick Insights & Actions
            </span>

            <div className="flex flex-wrap gap-2">
              {otherActions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--text-2)] text-xs font-medium cursor-pointer select-none transition-all hover:bg-[var(--surface3)] hover:border-[var(--accent)] hover:text-[var(--text)] hover:-translate-y-0.5 active:translate-y-0"
                >
                  <div className="text-[var(--text-3)] flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages stream */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-3 flex-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'bot' && (
                <div className="w-7 h-7 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} color="currentColor" />
                </div>
              )}

              {m.sender === 'bot' ? (
                <BotMessageBubble text={m.text} />
              ) : (
                <div
                  className="px-3.5 py-2.5 rounded-xl text-[var(--accent-contrast,#ffffff)] max-w-[90%] sm:max-w-[82%] whitespace-pre-line text-[13px] leading-relaxed"
                  style={{ background: 'var(--accent-gradient)' }}
                >
                  {m.text}
                </div>
              )}

              {m.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-[var(--surface2)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} color="currentColor" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2.5 text-[var(--text-2)] p-2 ml-8">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-[var(--text-2)]">
                Extracting details...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Extracted Details & Live Form Box */}
      {activeDraft && (
        <div className="p-4 sm:p-5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] flex flex-col gap-4 mt-2">
          {/* Header Row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-bold text-sm text-[var(--text)]">
              Extracted Record Details
            </h4>
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                activeDraft.flow === 'in'
                  ? 'bg-emerald-500/15 text-[var(--credit)]'
                  : 'bg-[var(--accent-soft)] text-[var(--accent)]'
              }`}
            >
              {currSym} {activeDraft.amount != null && !isNaN(activeDraft.amount) ? activeDraft.amount : 0}
            </span>
          </div>

          {/* Transaction Type & Mode Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Flow: Expense / Income */}
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[var(--text-3)] text-[11px]">
                Type
              </span>
              <div className="flex bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() =>
                    setActiveDraft({
                      ...activeDraft,
                      flow: 'out',
                      category: activeDraft.category === 'Income' ? 'Food & Dining' : activeDraft.category,
                    })
                  }
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeDraft.flow !== 'in'
                      ? 'bg-[var(--debit)] text-white shadow-xs'
                      : 'text-[var(--text-2)] hover:text-[var(--text)]'
                  }`}
                >
                  <TrendingDown size={13} /> Expense
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveDraft({
                      ...activeDraft,
                      flow: 'in',
                      category: 'Income',
                      splitMode: 'just_me',
                      type: 'personal',
                      whoPaid: 'me',
                    })
                  }
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeDraft.flow === 'in'
                      ? 'bg-[var(--credit)] text-white shadow-xs'
                      : 'text-[var(--text-2)] hover:text-[var(--text)]'
                  }`}
                >
                  <TrendingUp size={13} /> Income
                </button>
              </div>
            </div>

            {/* Payment & Split Mode Dropdown */}
            {activeDraft.flow !== 'in' && (
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--text-3)] text-[11px]">
                  Split & Payment Mode
                </span>
                <select
                  value={
                    (activeDraft.whoPaid === 'other' || activeDraft.type === 'by_friend' || activeDraft.splitMode === 'by_friend')
                      ? 'by_friend'
                      : (activeDraft.splitMode || 'just_me')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...activeDraft };
                    const friendCount = (updated.friendNames && updated.friendNames.length > 0) ? updated.friendNames.length : 1;

                    if (val === 'by_friend') {
                      updated.splitMode = 'by_friend';
                      updated.type = 'by_friend';
                      updated.whoPaid = 'other';
                      updated.myShare = updated.amount;
                      updated.friendShare = 0;
                    } else if (val === 'equal_split') {
                      updated.splitMode = 'equal_split';
                      updated.type = 'for_friend';
                      updated.whoPaid = 'me';
                      const share = Math.round((updated.amount / (friendCount + 1)) * 100) / 100;
                      updated.myShare = share;
                      updated.friendShare = Math.round((updated.amount - share) * 100) / 100;
                    } else if (val === 'for_friend') {
                      updated.splitMode = 'for_friend';
                      updated.type = 'for_friend';
                      updated.whoPaid = 'me';
                      updated.myShare = 0;
                      updated.friendShare = updated.amount;
                    } else {
                      updated.splitMode = 'just_me';
                      updated.type = 'personal';
                      updated.whoPaid = 'me';
                      updated.myShare = updated.amount;
                      updated.friendShare = 0;
                    }
                    setActiveDraft(updated);
                  }}
                  className="w-full h-[36px] px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
                >
                  <option value="just_me">Personal (Just Me)</option>
                  <option value="equal_split">Split Equally (I Paid)</option>
                  <option value="for_friend">100% Paid for Friend</option>
                  <option value="by_friend">Friend Paid for Me</option>
                </select>
              </div>
            )}
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-3)]">
                Item Name
              </label>
              <input
                type="text"
                value={activeDraft.description}
                onChange={(e) => setActiveDraft({ ...activeDraft, description: e.target.value })}
                placeholder="e.g. Coffee"
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-3)]">
                Amount ({currency})
              </label>
              <input
                type="number"
                value={activeDraft.amount != null && !isNaN(activeDraft.amount) ? activeDraft.amount : ''}
                onChange={(e) => {
                  const newAmt = Number(e.target.value) || 0;
                  const mode = activeDraft.splitMode || 'just_me';
                  const friendCount = (activeDraft.friendNames && activeDraft.friendNames.length > 0) ? activeDraft.friendNames.length : 1;
                  let my = activeDraft.myShare;
                  let fr = activeDraft.friendShare;
                  if (mode === 'equal_split') {
                    my = Math.round((newAmt / (friendCount + 1)) * 100) / 100;
                    fr = Math.round((newAmt - my) * 100) / 100;
                  } else if (mode === 'for_friend') {
                    my = 0;
                    fr = newAmt;
                  } else if (mode === 'just_me') {
                    my = newAmt;
                    fr = 0;
                  } else if (mode === 'by_friend' || activeDraft.type === 'by_friend' || activeDraft.whoPaid === 'other') {
                    my = newAmt;
                    fr = 0;
                  }
                  setActiveDraft({ ...activeDraft, amount: newAmt, myShare: my, friendShare: fr });
                }}
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>

            {(activeDraft.splitMode !== 'just_me' || activeDraft.type === 'by_friend' || activeDraft.whoPaid === 'other') && activeDraft.flow !== 'in' && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-[11px] font-semibold text-[var(--text-3)]">
                  {(activeDraft.type === 'by_friend' || activeDraft.whoPaid === 'other' || activeDraft.splitMode === 'by_friend')
                    ? "Paid By (Friend / Contact)"
                    : "Friends / Contacts"}
                </label>
                <div className="min-h-[38px] p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-wrap items-center gap-1.5 focus-within:border-[var(--accent)]">
                  {((activeDraft.friendNames && activeDraft.friendNames.length > 0)
                    ? activeDraft.friendNames
                    : (activeDraft.friendName ? [activeDraft.friendName] : [])
                  ).map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface2)] border border-[var(--border)] text-xs text-[var(--text)] font-medium"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = activeDraft.friendNames && activeDraft.friendNames.length > 0
                            ? activeDraft.friendNames
                            : (activeDraft.friendName ? [activeDraft.friendName] : []);
                          const updatedNames = current.filter(n => n !== name);
                          const mode = activeDraft.splitMode || 'equal_split';
                          const friendCount = Math.max(1, updatedNames.length);
                          let my = activeDraft.myShare;
                          let fr = activeDraft.friendShare;
                          if (mode === 'equal_split') {
                            my = Math.round((activeDraft.amount / (friendCount + 1)) * 100) / 100;
                            fr = Math.round((activeDraft.amount - (my || 0)) * 100) / 100;
                          }
                          setActiveDraft({
                            ...activeDraft,
                            friendNames: updatedNames,
                            friendName: updatedNames.join(', '),
                            myShare: my,
                            friendShare: fr,
                          });
                        }}
                        className="text-[var(--text-3)] hover:text-rose-500"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (!val) return;
                      const current = activeDraft.friendNames && activeDraft.friendNames.length > 0
                        ? [...activeDraft.friendNames]
                        : (activeDraft.friendName ? [activeDraft.friendName] : []);
                      if (!current.includes(val)) {
                        const updatedNames = [...current, val];
                        const mode = activeDraft.splitMode || 'equal_split';
                        const friendCount = Math.max(1, updatedNames.length);
                        let my = activeDraft.myShare;
                        let fr = activeDraft.friendShare;
                        if (mode === 'equal_split') {
                          my = Math.round((activeDraft.amount / (friendCount + 1)) * 100) / 100;
                          fr = Math.round((activeDraft.amount - (my || 0)) * 100) / 100;
                        }
                        setActiveDraft({
                          ...activeDraft,
                          friendNames: updatedNames,
                          friendName: updatedNames.join(', '),
                          myShare: my,
                          friendShare: fr,
                        });
                      }
                    }}
                    className="bg-transparent border-none text-xs text-[var(--text-3)] focus:outline-hidden py-1 px-1 cursor-pointer"
                  >
                    <option value="">+ Add friend...</option>
                    {friends.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeDraft.splitMode === 'equal_split' && activeDraft.flow !== 'in' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[var(--text-3)]">
                    My Share ({currency})
                  </label>
                  <input
                    type="number"
                    value={activeDraft.myShare != null && !isNaN(activeDraft.myShare) ? activeDraft.myShare : ''}
                    onChange={(e) => {
                      const my = Number(e.target.value) || 0;
                      const fr = Math.max(0, activeDraft.amount - my);
                      setActiveDraft({ ...activeDraft, myShare: my, friendShare: fr });
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[var(--text-3)]">
                    Friend Share ({currency})
                  </label>
                  <input
                    type="number"
                    value={activeDraft.friendShare != null && !isNaN(activeDraft.friendShare) ? activeDraft.friendShare : ''}
                    onChange={(e) => {
                      const fr = Number(e.target.value) || 0;
                      const my = Math.max(0, activeDraft.amount - fr);
                      setActiveDraft({ ...activeDraft, friendShare: fr, myShare: my });
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-3)]">
                Category
              </label>
              <select
                value={activeDraft.category}
                onChange={(e) => setActiveDraft({ ...activeDraft, category: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-3)]">
                Wallet / Account
              </label>
              <select
                value={activeDraft.walletName}
                onChange={(e) => setActiveDraft({ ...activeDraft, walletName: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-3)]">
                Date
              </label>
              <input
                type="date"
                value={activeDraft.date}
                onChange={(e) => setActiveDraft({ ...activeDraft, date: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-medium text-[var(--text)] focus:outline-hidden focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-1">
            <button
              type="button"
              onClick={() => setActiveDraft(null)}
              className="px-4 py-2 rounded-lg font-semibold text-xs text-[var(--text-3)] hover:bg-[var(--surface3)] hover:text-[var(--text)] transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleConfirmDraft}
              className={`px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:opacity-90 ${
                activeDraft.flow === 'in'
                  ? 'bg-[var(--credit)] text-white'
                  : 'bg-[var(--accent)] text-[var(--accent-contrast,#ffffff)]'
              }`}
            >
              <PlusCircle size={15} />
              {activeDraft.flow === 'in'
                ? 'Add Income'
                : ((activeDraft.whoPaid === 'other' || activeDraft.type === 'by_friend' || activeDraft.splitMode === 'by_friend')
                    ? 'Record Owed Debt'
                    : (activeDraft.splitMode === 'equal_split' ? 'Add Split Expense' : 'Add Expense'))
              }
            </button>
          </div>
        </div>
      )}
      <div ref={contentEndRef} />
    </div>
  );

  // Footer Actions without any dividing top border line
  const footerActions = (
    <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 flex flex-col bg-[var(--surface)]">
      {messages.length > 0 && frequentActions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-1 w-full no-scrollbar">
          {frequentActions.map((item, idx) => {
            const t = item.taskItem;
            const names = t ? (t.friendNames && t.friendNames.length > 0 ? t.friendNames : (t.friendName ? [t.friendName] : [])) : [];
            const friendBadgeStr = names.length === 1 ? names[0] : (names.length > 1 ? names.map(n => n.charAt(0).toUpperCase()).join('+') : '');
            const chipLabel = t
              ? `${t.description}${friendBadgeStr ? ` • ${friendBadgeStr}` : ''} ${item.subText ? `(${item.subText})` : ''}`
              : `${item.label} ${item.subText ? `(${item.subText})` : ''}`;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (t) {
                    if (onOpenAddExpense) {
                      onOpenAddExpense({
                        description: t.description,
                        amount: t.amount,
                        category: t.category,
                        flow: t.flow,
                        whoPaid: t.whoPaid,
                        type: t.type,
                        splitMode: t.splitMode === 'pay_debt' ? 'pay_debt' : (t.type === 'for_friend' || (t.friendIds && t.friendIds.length > 0) ? 'for_friend' : 'just_me'),
                        friendId: t.friendId || (t.friendIds && t.friendIds[0]) || undefined,
                        friendIds: t.friendIds && t.friendIds.length > 0 ? t.friendIds : (t.friendId ? [t.friendId] : undefined),
                        vendorId: t.vendorId || undefined,
                        status: t.status,
                        walletId: t.walletId || undefined,
                        date: todayISO(),
                      });
                      onClose();
                    } else {
                      const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const walletNameVal = (t.walletId && db.wallets.find(w => w.id === t.walletId)?.name) || db.wallets[0]?.name || 'Cash';
                      const resolvedFriendName = (t.friendNames && t.friendNames.length > 0)
                        ? t.friendNames.join(', ')
                        : (t.friendName || undefined);

                      const d: DraftExpense = {
                        description: t.description,
                        amount: t.amount,
                        category: t.category,
                        flow: t.flow,
                        whoPaid: t.whoPaid,
                        type: t.type,
                        splitMode: t.splitMode === 'pay_debt' ? 'pay_debt' : (t.type === 'for_friend' || (t.friendIds && t.friendIds.length > 0) ? 'for_friend' : 'just_me'),
                        friendName: resolvedFriendName,
                        vendorName: t.vendorName || undefined,
                        walletName: walletNameVal,
                        date: todayISO(),
                      };
                      setActiveDraft(d);
                      setMessages(prev => [
                        ...prev,
                        {
                          id: generateMsgId(),
                          sender: 'bot',
                          text: `Prepared quick entry for ${t.description} (${currencySymbol(currency)}${t.amount}). Review and confirm below:`,
                          timestamp: nowTimeStr,
                          draft: d,
                        },
                      ]);
                    }
                  } else {
                    handleSend(item.prompt);
                  }
                }}
                className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--surface2)] text-[var(--text-2)] border border-[var(--border)] shrink-0 transition-all hover:bg-[var(--surface3)] hover:text-[var(--text)] hover:border-[var(--accent)] whitespace-nowrap"
              >
                {chipLabel}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`flex items-center gap-2.5 w-full px-3.5 py-2 bg-[var(--surface2)] rounded-xl border transition-all focus-within:border-[var(--accent)] focus-within:bg-[var(--surface)] focus-within:shadow-md ${
          isListening ? 'border-[var(--debit)]' : 'border-[var(--border)]'
        }`}
      >
        <AudioWaveVisualizer volume={volumeLevel} isListening={isListening} />

        <input
          ref={textInputRef}
          type="text"
          placeholder={isListening ? 'Listening... Speak now...' : 'Describe transaction or ask Max...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          className="flex-1 bg-transparent border-none text-sm text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-hidden"
        />

        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? 'Stop mic' : 'Speak to Max'}
          className={`p-2 rounded-lg transition-colors ${
            isListening
              ? 'text-[var(--debit)] hover:bg-rose-500/15'
              : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface3)]'
          }`}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || loading}
          className={`p-2 rounded-lg transition-colors ${
            inputText.trim() && !loading
              ? 'text-[var(--accent)] hover:bg-[var(--surface3)]'
              : 'text-[var(--text-3)] opacity-40 cursor-not-allowed'
          }`}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal / Drawer Surface */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
            transition={isMobile ? { type: 'spring', damping: 28, stiffness: 320 } : { duration: 0.18 }}
            style={{
              transform: isMobile && dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
            }}
            className={`relative z-10 w-full bg-[var(--surface)] text-[var(--text)] flex flex-col overflow-hidden ${
              isMobile
                ? 'rounded-t-[20px] max-h-[90vh] border-t border-[var(--border)]'
                : 'rounded-2xl max-w-[520px] max-h-[84vh] shadow-2xl border border-[var(--border)]'
            }`}
          >
            {isMobile && (
              <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="pt-3 pb-1 px-4 bg-[var(--surface)] cursor-grab select-none flex justify-center items-center touch-none"
              >
                <div
                  className="h-1 bg-[var(--border2)] opacity-75 rounded-full transition-all"
                  style={{ width: dragOffsetY > 0 ? 44 : 36 }}
                />
              </div>
            )}
            {headerContent}
            {mainBodyContent}
            {footerActions}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
