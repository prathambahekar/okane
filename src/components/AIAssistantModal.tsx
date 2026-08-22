import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import Fade from '@mui/material/Fade';
import type { TransitionProps } from '@mui/material/transitions';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import InputBase from '@mui/material/InputBase';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import useMediaQuery from '@mui/material/useMediaQuery';
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
} from 'lucide-react';
import { useStore } from '../store';
import { currencySymbol } from '../utils';
import { parseLocallyClient } from '../nlp';
import { uid, todayISO, friendBalance, walletBalance, totalWalletBalance } from '../db';
import type { ExpenseType, ExpenseFlow } from '../types';
import { CategoryBadge } from './CategoryIcon';

const ModalFadeTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Fade ref={ref} {...props} timeout={180} />;
});

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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        px: 1,
        py: 0.5,
        height: '28px',
        borderRadius: '99px',
        bgcolor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.22)',
        flexShrink: 0,
      }}
    >
      {barConfigs.map((cfg, idx) => {
        const computedHeight = Math.max(4, Math.min(22, 4 + volume * cfg.mult * 26));
        return (
          <Box
            key={idx}
            sx={{
              width: '3px',
              height: `${computedHeight}px`,
              borderRadius: '99px',
              bgcolor: 'var(--debit)',
              transition: 'height 0.06s ease-out, opacity 0.12s ease',
              opacity: Math.max(0.4, Math.min(1, 0.5 + volume * 0.7)),
              boxShadow: volume > 0.15 ? '0 0 6px rgba(239, 68, 68, 0.45)' : 'none',
            }}
          />
        );
      })}
    </Box>
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
  walletName: string;
  friendName?: string | null;
  friendNames?: string[];
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

interface AIAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AIAssistantModal({ open, onClose }: AIAssistantModalProps) {
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

  const [aiEngineMode, setAiEngineMode] = useState<'offline' | 'online'>(() => {
    return (localStorage.getItem('ai_engine_mode') as 'offline' | 'online') || 'online';
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [activeDraft, setActiveDraft] = useState<DraftExpense | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const msgCounterRef = useRef(1);

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

    if (aiEngineMode === 'offline') {
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
          setActiveDraft(d);
        }
        setLoading(false);
      }, 150);
      return;
    }

    try {
      const recentExpenses = db.expenses.slice(0, 60).map(e => {
        const w = db.wallets.find(wallet => wallet.id === e.walletId);
        const f = db.friends.find(friend => friend.id === e.friendId);
        const v = db.friends.find(friend => friend.id === e.vendorId);
        return {
          description: e.description,
          amount: e.amount,
          category: e.category,
          date: e.date,
          type: e.type,
          flow: e.flow,
          walletName: w ? w.name : undefined,
          friendName: f ? f.name : undefined,
          vendorName: v ? v.name : undefined,
          status: e.status,
          settled: e.settled,
        };
      });

      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      const thisMonthExpenses = db.expenses.filter(e => e.flow !== 'in' && e.date.startsWith(currentMonthPrefix));
      const thisMonthIncome = db.expenses.filter(e => e.flow === 'in' && e.date.startsWith(currentMonthPrefix));
      const thisMonthSpent = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const thisMonthIncomeTotal = thisMonthIncome.reduce((sum, e) => sum + e.amount, 0);

      const totalSpent = db.expenses
        .filter(e => e.flow !== 'in')
        .reduce((sum, e) => sum + e.amount, 0);

      const monthlySpending = {
        month: currentMonthPrefix,
        totalSpentThisMonth: thisMonthSpent,
        totalIncomeThisMonth: thisMonthIncomeTotal,
        netCashflow: thisMonthIncomeTotal - thisMonthSpent,
        transactionsCount: thisMonthExpenses.length + thisMonthIncome.length,
      };

      const walletsData = db.wallets.map(w => ({
        id: w.id,
        name: w.name,
        balance: walletBalance(db, w.id),
        openingBalance: w.openingBalance,
        isDefault: w.id === db.settings.defaultWalletId,
      }));

      const friendsData = db.friends.map(f => {
        const bal = friendBalance(db, f.id);
        return {
          id: f.id,
          name: f.name,
          type: f.type || 'friend',
          category: f.category,
          defaultAmount: f.defaultAmount,
          owedToMe: bal.owedToMe,
          owedByMe: bal.owedByMe,
          net: bal.net,
        };
      });

      const recurringRulesData = (db.recurringRules || []).map(r => ({
        title: r.title,
        amount: r.amount,
        kind: r.kind,
        frequency: r.frequency,
        category: r.category,
      }));

      const summaryStats = {
        totalSpent,
        totalExpensesCount: db.expenses.length,
        totalWalletBalance: totalWalletBalance(db),
      };

      const chatHistory = messages.slice(-10).map(m => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          chatHistory,
          categories,
          wallets: walletsData,
          totalWalletBalance: totalWalletBalance(db),
          friends: friendsData,
          currentDraft: activeDraft,
          recentExpenses,
          monthlySpending,
          summaryStats,
          recurringRules: recurringRulesData,
          currency,
        }),
      });

      let data: { reply?: string | null; draft?: DraftExpense | null; fallbackToOffline?: boolean } | null = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      }

      if (!data || data.fallbackToOffline || !data.reply) {
        // Smoothly fall back to client-side local NLP engine
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
          setActiveDraft(localResult.draft as DraftExpense);
        }
        return;
      }

      const botMsg: Message = {
        id: generateMsgId(),
        sender: 'bot',
        text: data.reply,
        timestamp: timeStr,
        draft: data.draft || null,
      };

      setMessages(prev => [...prev, botMsg]);


      if (data.draft) {
        const d = data.draft as DraftExpense;
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
        setActiveDraft(d);
      }
    } catch (err) {
      console.error('Online AI call failed, using local offline fallback:', err);
      const localResult = parseLocallyClient(query, categories, friends, wallets, currency);
      setMessages(prev => [
        ...prev,
        {
          id: generateMsgId(),
          sender: 'bot',
          text: localResult.reply,
          timestamp: timeStr,
          draft: localResult.draft || null,
        }
      ]);
      if (localResult.draft) {
        setActiveDraft(localResult.draft as DraftExpense);
      }
    } finally {
      setLoading(false);
    }
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
    }> = [];

    const others: Array<{
      icon: React.ReactNode;
      label: string;
      prompt: string;
    }> = [];

    const defaultWallet = db.wallets.find(w => w.id === db.settings.defaultWalletId) || db.wallets[0] || { name: 'Cash' };

    // 1. Calculate most frequent expenses by item name / description first, then category
    const itemFreq: Record<string, { count: number; amounts: number[]; category: string; latestAmount: number }> = {};

    // Scan recurring rules first
    (db.recurringRules || []).forEach(r => {
      if (r.title && r.amount > 0) {
        const normDesc = r.title.trim().charAt(0).toUpperCase() + r.title.trim().slice(1).toLowerCase();
        if (!itemFreq[normDesc]) {
          itemFreq[normDesc] = { count: 3, amounts: [r.amount], category: r.category || 'General', latestAmount: r.amount };
        }
      }
    });

    db.expenses.forEach(e => {
      if (e.flow !== 'in') {
        const descKey = (e.description || '').trim();
        if (descKey && descKey.length >= 2) {
          const normDesc = descKey.charAt(0).toUpperCase() + descKey.slice(1).toLowerCase();
          if (!itemFreq[normDesc]) {
            itemFreq[normDesc] = { count: 0, amounts: [], category: e.category || 'General', latestAmount: e.amount };
          }
          itemFreq[normDesc].count += 1;
          itemFreq[normDesc].amounts.push(e.amount);
          itemFreq[normDesc].latestAmount = e.amount;
        }
      }
    });

    // Helper to get mode / accurate price
    const getExactPrice = (name: string, data?: { amounts: number[]; latestAmount: number }) => {
      const lower = name.toLowerCase();
      // Check if recurring rule exists
      const rec = (db.recurringRules || []).find(r => r.title.toLowerCase().includes(lower));
      if (rec && rec.amount > 0) return rec.amount;

      if (data && data.amounts && data.amounts.length > 0) {
        // Calculate mode (most frequent exact price)
        const priceCounts: Record<number, number> = {};
        data.amounts.forEach(a => {
          priceCounts[a] = (priceCounts[a] || 0) + 1;
        });
        const sortedPrices = Object.entries(priceCounts).sort((a, b) => b[1] - a[1]);
        if (sortedPrices.length > 0 && sortedPrices[0][1] >= 2) {
          return Number(sortedPrices[0][0]);
        }
        return data.latestAmount || data.amounts[0];
      }

      if (lower.includes('tiffin')) return 75;
      if (lower.includes('tea') || lower.includes('chai')) return 15;
      if (lower.includes('coffee')) return 30;
      if (lower.includes('poha')) return 25;
      if (lower.includes('lunch')) return 120;
      if (lower.includes('dinner')) return 250;
      if (lower.includes('fuel') || lower.includes('petrol')) return 500;
      return 50;
    };

    // Helpers to pick appropriate icon
    const getIconForName = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('coffee') || lower.includes('tea') || lower.includes('chai') || lower.includes('cafe')) return <Coffee size={14} />;
      if (lower.includes('food') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('meal') || lower.includes('snack') || lower.includes('tiffin') || lower.includes('burger')) return <Utensils size={14} />;
      if (lower.includes('groc') || lower.includes('mart') || lower.includes('store') || lower.includes('shop')) return <ShoppingBag size={14} />;
      if (lower.includes('salary') || lower.includes('income') || lower.includes('pay')) return <TrendingUp size={14} />;
      if (lower.includes('bill') || lower.includes('util') || lower.includes('rent') || lower.includes('wifi')) return <CreditCard size={14} />;
      if (lower.includes('auto') || lower.includes('uber') || lower.includes('cab') || lower.includes('fuel') || lower.includes('petrol')) return <Zap size={14} />;
      return <TrendingDown size={14} />;
    };

    const sortedItems = Object.entries(itemFreq).sort((a, b) => b[1].count - a[1].count);

    // Build top frequent spending actions
    sortedItems.slice(0, 4).forEach(([name, stats]) => {
      const price = getExactPrice(name, stats);
      frequent.push({
        icon: getIconForName(name),
        label: name,
        subText: `${currSym}${price}`,
        prompt: `Spent ${currSym}${price} on ${name} with ${defaultWallet.name}`,
      });
    });

    // If less than 2, provide intelligent staple fallbacks
    if (frequent.length === 0) {
      frequent.push(
        {
          icon: <Utensils size={14} />,
          label: 'Tiffin',
          subText: `${currSym}75`,
          prompt: `Spent ${currSym}75 on Tiffin with ${defaultWallet.name}`,
        },
        {
          icon: <Coffee size={14} />,
          label: 'Coffee',
          subText: `${currSym}30`,
          prompt: `Spent ${currSym}30 on Coffee with ${defaultWallet.name}`,
        },
        {
          icon: <Utensils size={14} />,
          label: 'Lunch',
          subText: `${currSym}120`,
          prompt: `Spent ${currSym}120 on Lunch with ${defaultWallet.name}`,
        },
        {
          icon: <ShoppingBag size={14} />,
          label: 'Groceries',
          subText: `${currSym}500`,
          prompt: `Spent ${currSym}500 on Groceries with ${defaultWallet.name}`,
        }
      );
    } else if (frequent.length === 1) {
      if (!frequent.some(f => f.label.toLowerCase().includes('tiffin'))) {
        frequent.push({
          icon: <Utensils size={14} />,
          label: 'Tiffin',
          subText: `${currSym}75`,
          prompt: `Spent ${currSym}75 on Tiffin with ${defaultWallet.name}`,
        });
      } else {
        frequent.push({
          icon: <Coffee size={14} />,
          label: 'Coffee',
          subText: `${currSym}30`,
          prompt: `Spent ${currSym}30 on Coffee with ${defaultWallet.name}`,
        });
      }
    }

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
  }, [db, currSym]);


  // Header without any horizontal divider lines
  const headerContent = (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        pt: isMobile ? 0.75 : 2.5,
        pb: 1.25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'var(--surface)',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            bgcolor: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={17} color="currentColor" />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'nowrap' }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '15.5px', sm: '17px' },
                color: 'var(--text)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              Max Assistant
            </Typography>
            <Box
              onClick={() => {
                const next = aiEngineMode === 'offline' ? 'online' : 'offline';
                setAiEngineMode(next);
                localStorage.setItem('ai_engine_mode', next);
                showToast(next === 'offline' ? '⚡ Switched to Offline AI (100% local)' : '✨ Switched to Gemini Cloud AI');
              }}
              title="Click to toggle AI mode (Cloud / Offline)"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 0.9,
                py: 0.25,
                borderRadius: '6px',
                bgcolor: aiEngineMode === 'online' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                border: '1px solid',
                borderColor: aiEngineMode === 'online' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                color: aiEngineMode === 'online' ? '#22c55e' : '#eab308',
                fontSize: '10.5px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: aiEngineMode === 'online' ? 'rgba(34, 197, 94, 0.22)' : 'rgba(234, 179, 8, 0.22)',
                  transform: 'translateY(-1px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              <Box
                sx={{
                  width: 5.5,
                  height: 5.5,
                  borderRadius: '50%',
                  bgcolor: aiEngineMode === 'online' ? '#22c55e' : '#eab308',
                  boxShadow: aiEngineMode === 'online' ? '0 0 5px rgba(34, 197, 94, 0.6)' : '0 0 5px rgba(234, 179, 8, 0.6)',
                  flexShrink: 0,
                }}
              />
              {aiEngineMode === 'online' ? 'Gemini AI' : 'Offline AI'}
            </Box>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'var(--text-3)',
              fontSize: { xs: '11px', sm: '12px' },
              mt: 0.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Voice & text financial intelligence
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            color: 'var(--text-2)',
            p: 0.75,
            width: 32,
            height: 32,
            borderRadius: '8px',
            bgcolor: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            transition: 'all 0.15s ease',
            '&:hover': { bgcolor: 'var(--surface3)', color: 'var(--text)' },
          }}
        >
          <X size={16} />
        </IconButton>
      </Box>
    </Box>
  );

  // Main body without splitting lines
  const mainBodyContent = (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: 1,
        overflowY: 'auto',
        bgcolor: 'var(--surface)',
      }}
    >
      {/* Empty State: Minimal, Clean Actions */}
      {messages.length === 0 && !activeDraft && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, my: 'auto', py: 1.5 }}>
          {/* Frequent Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: '11px',
                px: 0.25,
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
              }}
            >
              <Sparkles size={12} color="var(--accent)" />
              Frequent Actions
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' },
                gap: 0.85,
              }}
            >
              {frequentActions.map((item, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  sx={{
                    px: 1.25,
                    py: 1,
                    borderRadius: '8px',
                    bgcolor: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 0.75,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: 'var(--surface3)',
                      borderColor: 'var(--accent)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, minWidth: 0 }}>
                    <Box
                      sx={{
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: '12.5px',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>

                  {item.subText && (
                    <Typography
                      sx={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-3)',
                        flexShrink: 0,
                      }}
                    >
                      {item.subText}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Other Quick Actions & Queries */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: '11px',
                px: 0.25,
              }}
            >
              Quick Insights & Actions
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
              }}
            >
              {otherActions.map((item, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.7,
                    borderRadius: '8px',
                    bgcolor: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: 'var(--surface3)',
                      borderColor: 'var(--accent)',
                      color: 'var(--text)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    },
                  }}
                >
                  <Box sx={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </Box>
                  <span>{item.label}</span>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* Messages stream */}
      {messages.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            flex: 1,
          }}
        >
          {messages.map((m) => (
            <Box
              key={m.id}
              sx={{
                display: 'flex',
                justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              {m.sender === 'bot' && (
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  <Sparkles size={14} color="currentColor" />
                </Box>
              )}

              <Paper
                elevation={0}
                sx={{
                  px: 1.75,
                  py: 1.25,
                  borderRadius: '12px',
                  background: m.sender === 'user' ? 'var(--accent-gradient)' : 'var(--surface2)',
                  color: m.sender === 'user' ? 'var(--accent-contrast, #ffffff)' : 'var(--text)',
                  maxWidth: { xs: '90%', sm: '82%' },
                  whiteSpace: 'pre-line',
                  border: '1px solid',
                  borderColor: m.sender === 'user' ? 'transparent' : 'var(--border)',
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.55, fontSize: '13px' }}>
                  {m.text}
                </Typography>
              </Paper>

              {m.sender === 'user' && (
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  <User size={14} color="currentColor" />
                </Box>
              )}
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'var(--text-2)', p: 1, ml: 4 }}>
              <CircularProgress size={15} sx={{ color: 'var(--accent)' }} />
              <Typography variant="body2" sx={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-2)' }}>
                Extracting details...
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>
      )}

      {/* Extracted Details & Live Form Box */}
      {activeDraft && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.25 },
            borderRadius: '12px',
            border: '1px solid var(--border)',
            bgcolor: 'var(--surface2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            mt: 1,
          }}
        >
          {/* Header Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text)' }}>
              Extracted Record Details
            </Typography>
            <Chip
              label={`${currSym} ${activeDraft.amount != null && !isNaN(activeDraft.amount) ? activeDraft.amount : 0}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '13px',
                borderRadius: '6px',
                px: 0.5,
                bgcolor: activeDraft.flow === 'in' ? 'rgba(34, 197, 94, 0.15)' : 'var(--accent-soft)',
                color: activeDraft.flow === 'in' ? 'var(--credit)' : 'var(--accent)',
              }}
            />
          </Box>

          {/* Transaction Type & Mode Selection */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {/* Flow: Expense / Income */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--text-3)', fontSize: '11px' }}>
                Type
              </Typography>
              <ToggleButtonGroup
                value={activeDraft.flow || 'out'}
                exclusive
                onChange={(_, newFlow) => {
                  if (!newFlow) return;
                  setActiveDraft({
                    ...activeDraft,
                    flow: newFlow,
                    category: newFlow === 'in' ? 'Income' : (activeDraft.category === 'Income' ? 'Food & Dining' : activeDraft.category),
                    splitMode: newFlow === 'in' ? 'just_me' : activeDraft.splitMode,
                    type: newFlow === 'in' ? 'personal' : activeDraft.type,
                    whoPaid: newFlow === 'in' ? 'me' : activeDraft.whoPaid,
                  });
                }}
                size="small"
                fullWidth
                sx={{
                  bgcolor: 'var(--surface)',
                  p: 0.4,
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    borderRadius: '6px !important',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '12px',
                    py: 0.6,
                    color: 'var(--text-2)',
                    border: 'none !important',
                    '&.Mui-selected': {
                      bgcolor: activeDraft.flow === 'in' ? 'var(--credit)' : 'var(--debit)',
                      color: '#ffffff !important',
                    },
                  },
                }}
              >
                <ToggleButton value="out">
                  <TrendingDown size={13} style={{ marginRight: 4 }} /> Expense
                </ToggleButton>
                <ToggleButton value="in">
                  <TrendingUp size={13} style={{ marginRight: 4 }} /> Income
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Payment & Split Mode Dropdown */}
            {activeDraft.flow !== 'in' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--text-3)', fontSize: '11px' }}>
                  Split & Payment Mode
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
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
                    sx={{ borderRadius: '8px', bgcolor: 'var(--surface)' }}
                  >
                    <MenuItem value="just_me">Personal (Just Me)</MenuItem>
                    <MenuItem value="equal_split">Split Equally (I Paid)</MenuItem>
                    <MenuItem value="for_friend">100% Paid for Friend</MenuItem>
                    <MenuItem value="by_friend">Friend Paid for Me</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>

          {/* Form Inputs Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: 'var(--surface)',
              },
            }}
          >
            <TextField
              label="Item Name"
              size="small"
              fullWidth
              value={activeDraft.description}
              onChange={(e) => setActiveDraft({ ...activeDraft, description: e.target.value })}
              placeholder="e.g. Coffee"
            />

            <TextField
              label={`Amount (${currency})`}
              type="number"
              size="small"
              fullWidth
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
            />

            {(activeDraft.splitMode !== 'just_me' || activeDraft.type === 'by_friend' || activeDraft.whoPaid === 'other') && activeDraft.flow !== 'in' && (
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={friends.map((f) => f.name)}
                value={
                  activeDraft.friendNames && activeDraft.friendNames.length > 0
                    ? activeDraft.friendNames
                    : (activeDraft.friendName ? [activeDraft.friendName] : [])
                }
                onChange={(_, newValue) => {
                  const names = (newValue as string[]).map(s => s.trim()).filter(Boolean);
                  const mode = activeDraft.splitMode || 'equal_split';
                  const friendCount = Math.max(1, names.length);
                  let my = activeDraft.myShare;
                  let fr = activeDraft.friendShare;
                  if (mode === 'equal_split') {
                    my = Math.round((activeDraft.amount / (friendCount + 1)) * 100) / 100;
                    fr = Math.round((activeDraft.amount - (my || 0)) * 100) / 100;
                  }
                  setActiveDraft({
                    ...activeDraft,
                    friendNames: names,
                    friendName: names.join(', '),
                    myShare: my,
                    friendShare: fr,
                  });
                }}
                renderTags={(value: readonly string[], getTagProps) =>
                  value.map((option: string, index: number) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      size="small"
                      {...getTagProps({ index })}
                      key={option}
                      sx={{ borderRadius: '6px', fontSize: '11.5px' }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={
                      (activeDraft.type === 'by_friend' || activeDraft.whoPaid === 'other' || activeDraft.splitMode === 'by_friend')
                        ? "Paid By (Friend / Contact)"
                        : "Friends / Contacts"
                    }
                    placeholder="Select friend..."
                  />
                )}
              />
            )}

            {activeDraft.splitMode === 'equal_split' && activeDraft.flow !== 'in' && (
              <>
                <TextField
                  label={`My Share (${currency})`}
                  type="number"
                  size="small"
                  fullWidth
                  value={activeDraft.myShare != null && !isNaN(activeDraft.myShare) ? activeDraft.myShare : ''}
                  onChange={(e) => {
                    const my = Number(e.target.value) || 0;
                    const fr = Math.max(0, activeDraft.amount - my);
                    setActiveDraft({ ...activeDraft, myShare: my, friendShare: fr });
                  }}
                />
                <TextField
                  label={`Friend Share (${currency})`}
                  type="number"
                  size="small"
                  fullWidth
                  value={activeDraft.friendShare != null && !isNaN(activeDraft.friendShare) ? activeDraft.friendShare : ''}
                  onChange={(e) => {
                    const fr = Number(e.target.value) || 0;
                    const my = Math.max(0, activeDraft.amount - fr);
                    setActiveDraft({ ...activeDraft, friendShare: fr, myShare: my });
                  }}
                />
              </>
            )}

            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={activeDraft.category}
                label="Category"
                onChange={(e) => setActiveDraft({ ...activeDraft, category: e.target.value })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CategoryBadge category={selected} size={14} showLabel={true} />
                  </Box>
                )}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    <CategoryBadge category={cat} size={14} showLabel={true} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Wallet / Account</InputLabel>
              <Select
                value={activeDraft.walletName}
                label="Wallet / Account"
                onChange={(e) => setActiveDraft({ ...activeDraft, walletName: e.target.value })}
              >
                {wallets.map((w) => (
                  <MenuItem key={w.id} value={w.name}>
                    {w.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Date"
              type="date"
              size="small"
              fullWidth
              value={activeDraft.date}
              onChange={(e) => setActiveDraft({ ...activeDraft, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
            <Button
              size="small"
              color="inherit"
              onClick={() => setActiveDraft(null)}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2, color: 'var(--text-3)' }}
            >
              Discard
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusCircle size={15} />}
              onClick={handleConfirmDraft}
              sx={{
                borderRadius: '8px',
                fontWeight: 650,
                px: 2.5,
                py: 0.7,
                fontSize: '13px',
                textTransform: 'none',
                bgcolor: activeDraft.flow === 'in' ? 'var(--credit)' : 'var(--accent)',
                color: activeDraft.flow === 'in' ? '#ffffff' : 'var(--accent-contrast, #ffffff)',
                boxShadow: '0 2px 8px var(--accent-soft)',
              }}
            >
              {activeDraft.flow === 'in'
                ? 'Add Income'
                : ((activeDraft.whoPaid === 'other' || activeDraft.type === 'by_friend' || activeDraft.splitMode === 'by_friend')
                    ? 'Record Owed Debt'
                    : (activeDraft.splitMode === 'equal_split' ? 'Add Split Expense' : 'Add Expense'))
              }
            </Button>
          </Box>
        </Paper>
      )}
      <div ref={contentEndRef} />
    </Box>
  );

  // Footer Actions without any dividing top border line
  const footerActions = (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        pb: { xs: 2, sm: 3 },
        pt: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--surface)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          px: 1.75,
          py: 0.75,
          bgcolor: 'var(--surface2)',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isListening ? 'var(--debit)' : 'var(--border)',
          transition: 'all 0.15s ease',
          '&:focus-within': {
            borderColor: 'var(--accent)',
            bgcolor: 'var(--surface)',
            boxShadow: '0 2px 10px var(--accent-soft)',
          },
        }}
      >
        <AudioWaveVisualizer volume={volumeLevel} isListening={isListening} />

        <InputBase
          placeholder={isListening ? 'Listening... Speak now...' : 'Describe transaction or ask Max...'}
          fullWidth
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
          sx={{
            fontSize: '14px',
            color: 'var(--text)',
            fontFamily: 'inherit',
            '& input::placeholder': {
              color: 'var(--text-3)',
              opacity: 0.9,
            },
          }}
        />

        <Tooltip title={isListening ? 'Stop mic' : 'Speak to Max'}>
          <IconButton
            onClick={toggleListening}
            size="small"
            sx={{
              color: isListening ? 'var(--debit)' : 'var(--text-2)',
              p: 0.75,
              borderRadius: '8px',
              '&:hover': {
                color: 'var(--text)',
                bgcolor: 'var(--surface3)',
              },
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </IconButton>
        </Tooltip>

        <IconButton
          onClick={() => handleSend()}
          disabled={!inputText.trim() || loading}
          size="small"
          sx={{
            color: inputText.trim() ? 'var(--accent)' : 'var(--text-3)',
            p: 0.75,
            borderRadius: '8px',
            '&:hover': {
              color: 'var(--accent)',
              bgcolor: 'var(--surface3)',
            },
            '&.Mui-disabled': {
              color: 'var(--text-3)',
              opacity: 0.4,
            },
          }}
        >
          <Send size={17} />
        </IconButton>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        disableAutoFocus
        disableRestoreFocus
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(0,0,0,0.65)',
            },
          },
        }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            maxHeight: '90vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'var(--surface)',
            color: 'var(--text)',
            border: 'none',
            transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px) !important` : undefined,
            transition: dragOffsetY > 0 ? 'none !important' : undefined,
          },
        }}
      >
        <Box
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          sx={{
            touchAction: 'none',
            pt: 1.5,
            pb: 0.5,
            px: 2,
            bgcolor: 'var(--surface)',
            cursor: 'grab',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: dragOffsetY > 0 ? 44 : 36,
              height: 4,
              bgcolor: 'var(--text-3)',
              opacity: 0.5,
              borderRadius: '99px',
            }}
          />
        </Box>
        {headerContent}
        {mainBodyContent}
        {footerActions}
      </SwipeableDrawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableAutoFocus
      disableRestoreFocus
      TransitionComponent={ModalFadeTransition}
      maxWidth="xs"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(0,0,0,0.55)',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: '1px solid var(--border)',
          bgcolor: 'var(--surface)',
          color: 'var(--text)',
          m: 2,
        },
      }}
    >
      {headerContent}
      {mainBodyContent}
      {footerActions}
    </Dialog>
  );
}
