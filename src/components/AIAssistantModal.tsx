import React, { useState, useEffect, useRef, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import Fade from '@mui/material/Fade';
import type { TransitionProps } from '@mui/material/transitions';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';

const ModalFadeTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Fade ref={ref} {...props} timeout={180} />;
});
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
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
import {
  Mic,
  MicOff,
  Send,
  CheckCircle2,
  X,
  User,
  PlusCircle,
  Sparkles,
  Users,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useStore } from '../store';
import { currencySymbol } from '../utils';
import { parseLocallyClient } from '../nlp';
import { uid, todayISO } from '../db';
import type { ExpenseType, ExpenseFlow } from '../types';

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

  // 6 vertical bars with varied height multipliers for a natural, reactive audio wave
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
        // Base min height 4px, height expands up to 22px depending on live volume
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
    return (localStorage.getItem('ai_engine_mode') as 'offline' | 'online') || db.settings?.defaultAiEngine || 'offline';
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hi! I'm Max, your AI Financial Assistant.\nSpeak or type what you spent, received, or split:\n• "Paid 30rs for poha"\n• "I paid 100 for me and Alex"\n• "Alex paid 500 for dinner"\n• "Yesterday arman paid my poha"`,
      timestamp: 'Just now',
    }
  ]);
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

  const startAudioAnalysis = useCallback(async () => {
    stopAudioAnalysis();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        // Normalizing average amplitude into a smooth [0, 1] range
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

  const categories = db.settings.categories.map(c => c.name);
  const wallets = db.wallets;
  const friends = db.friends;
  const currency = db.settings.currency;

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

    if (!SpeechRecognitionClass) {
      showToast('Voice input is not supported in this browser. Please type your command.');
      return;
    }

    try {
      // Prompt user for microphone permission explicitly via getUserMedia first
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop stream tracks so SpeechRecognition can lock the audio device
          stream.getTracks().forEach((track) => track.stop());
        } catch (mediaErr) {
          console.warn('Microphone permission check failed:', mediaErr);
          showToast('Microphone access denied. Please allow microphone permissions in browser settings.');
          setIsListening(false);
          return;
        }
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      setInputText('');

      recognition.onstart = () => {
        setIsListening(true);
        startAudioAnalysis();
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
          showToast('Microphone access blocked. Please allow mic permissions in browser settings.');
        } else if (event.error === 'audio-capture') {
          showToast('No microphone found on your device.');
        } else if (event.error === 'network') {
          showToast('Network error during speech recognition.');
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
      startAudioAnalysis();
    } catch (err) {
      console.error('Error starting mic:', err);
      stopAudioAnalysis();
      setIsListening(false);
      showToast('Could not start microphone. Please check browser permissions or try typing.');
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
        const localResult = parseLocallyClient(query, categories, friends, wallets, currency);
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
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          categories,
          wallets: wallets.map(w => ({ id: w.id, name: w.name })),
          friends: friends.map(f => ({ id: f.id, name: f.name, type: f.type })),
          currentDraft: activeDraft,
          currency,
        }),
      });

      const data = await res.json();

      const botMsg: Message = {
        id: generateMsgId(),
        sender: 'bot',
        text: data.reply || "I've processed your request.",
        timestamp: timeStr,
        draft: data.draft || null,
      };

      setMessages(prev => [...prev, botMsg]);

      if (data.draft) {
        // Ensure default calculations and split mode setup
        const d = data.draft as DraftExpense;
        if (d.whoPaid === 'other' || d.type === 'by_friend' || d.splitMode === 'by_friend') {
          d.whoPaid = 'other';
          d.type = 'by_friend';
          d.splitMode = 'by_friend';
        } else if (!d.splitMode) {
          if (d.type === 'for_friend') d.splitMode = 'equal_split';
          else d.splitMode = 'just_me';
        }

        // Sync friendName and friendNames
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

    // Determine list of friends from draft
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
      // Record Income
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
      showToast(`Recorded Income: ${itemDesc} (${currencySymbol(currency)}${totalAmt})`);
    } else if (mode === 'equal_split' || mode === 'custom_split') {
      // Split Expense between me and friend(s)
      const numFriends = Math.max(1, resolvedFriends.length);
      const perPersonDefault = Math.round((totalAmt / (numFriends + 1)) * 100) / 100;

      const myShareAmt = activeDraft.myShare ?? perPersonDefault;
      const totalFriendSharesAmt = totalAmt - myShareAmt;
      const eachFriendShare = Math.round((totalFriendSharesAmt / numFriends) * 100) / 100;
      const groupId = uid('grp');

      // Add expense for each friend
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

      // Add my share (paid out of wallet)
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
      // 100% Paid for Friend(s)
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
      // Friend paid for me
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
      // Personal Expense
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
      showToast(`Added ${itemDesc} (${currencySymbol(currency)}${totalAmt})`);
    }

    setMessages(prev => [
      ...prev,
      {
        id: generateMsgId(),
        sender: 'bot',
        text: `Success! Recorded "${itemDesc}" (${currencySymbol(currency)}${totalAmt}).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    setActiveDraft(null);
  };

  const quickPills = [
    'Paid 30rs for poha',
    'Got 5000 salary income',
    'I paid 100 for me and Alex',
    'Coffee 150rs for Alex',
    'Alex paid 500 for dinner',
    'Arman paid 150 for my poha',
  ];

  const headerContent = (
    <DialogTitle
      sx={{
        px: { xs: 2, sm: 2.5 },
        py: { xs: 1.5, sm: 2 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid',
        borderColor: 'var(--border)',
        bgcolor: 'var(--surface)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '12px',
            background: 'var(--accent-gradient)',
            color: 'var(--accent-contrast, #ffffff)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 4px 12px var(--accent-soft)',
          }}
        >
          <Sparkles size={20} color="#ffffff" />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em', color: 'var(--text)' }}>
            Max
          </Typography>
          <Chip
            label="Financial Assistant"
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              fontWeight: 600,
              bgcolor: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderRadius: '99px',
              px: 0.5,
            }}
          />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          onClick={() => {
            const next = aiEngineMode === 'offline' ? 'online' : 'offline';
            setAiEngineMode(next);
            localStorage.setItem('ai_engine_mode', next);
            showToast(next === 'offline' ? '⚡ Switched to Offline AI (100% local, no internet needed)' : '✨ Switched to Gemini Cloud AI');
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.6,
            px: 1.2,
            py: 0.5,
            borderRadius: '99px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '11px',
            fontWeight: 600,
            bgcolor: aiEngineMode === 'offline' ? 'var(--credit-bg)' : 'var(--accent-soft)',
            color: aiEngineMode === 'offline' ? 'var(--credit)' : 'var(--accent)',
            border: `1px solid ${aiEngineMode === 'offline' ? 'var(--credit-border)' : 'var(--accent-soft)'}`,
            transition: 'all 0.15s ease',
            '&:hover': {
              opacity: 0.9,
              transform: 'scale(1.02)'
            }
          }}
        >
          {aiEngineMode === 'offline' ? (
            <>
              <Zap size={13} style={{ flexShrink: 0 }} />
              <span>Offline AI</span>
            </>
          ) : (
            <>
              <Sparkles size={13} style={{ flexShrink: 0 }} />
              <span>Gemini Cloud</span>
            </>
          )}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-2)', p: 0.75, borderRadius: '50%', '&:hover': { bgcolor: 'var(--surface2)', color: 'var(--text)' } }}>
          <X size={20} />
        </IconButton>
      </Box>
    </DialogTitle>
  );

  const mainBodyContent = (
    <DialogContent
      sx={{
        p: { xs: 2, sm: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: 1,
        overflowY: 'auto',
        bgcolor: 'var(--bg)',
      }}
    >
      {/* Messages */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.75,
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
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: 'var(--accent-gradient)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  mt: 0.25,
                  boxShadow: '0 2px 6px var(--accent-soft)',
                }}
              >
                <Sparkles size={16} color="#ffffff" />
              </Box>
            )}

            {m.id === 'welcome' ? (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '18px 18px 18px 6px',
                  bgcolor: 'var(--surface)',
                  color: 'var(--text)',
                  maxWidth: { xs: '92%', sm: '85%' },
                  border: '1px solid',
                  borderColor: 'var(--border)',
                  boxShadow: 'var(--shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                }}
              >
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)', mb: 0.25 }}>
                    Hi! I'm Max, your AI Assistant 👋
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '12.5px', lineHeight: 1.5 }}>
                    Speak or type what you spent, received, or split:
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.25 }}>
                  {quickPills.map((example) => (
                    <Box
                      key={example}
                      onClick={() => handleSend(example)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.25,
                        py: 0.85,
                        borderRadius: '10px',
                        bgcolor: 'var(--surface2)',
                        border: '1px solid',
                        borderColor: 'var(--border2)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'var(--surface3)',
                          borderColor: 'var(--accent)',
                          transform: 'translateX(2px)',
                        },
                      }}
                    >
                      <Sparkles size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text)' }}>
                        "{example}"
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderRadius: m.sender === 'user' ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                  background: m.sender === 'user' ? 'var(--accent-gradient)' : 'var(--surface)',
                  color: m.sender === 'user' ? '#ffffff' : 'var(--text)',
                  maxWidth: { xs: '90%', sm: '82%' },
                  whiteSpace: 'pre-line',
                  border: '1px solid',
                  borderColor: m.sender === 'user' ? 'transparent' : 'var(--border)',
                  boxShadow: m.sender === 'bot' ? 'var(--shadow)' : '0 2px 8px var(--accent-soft)',
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.55, fontSize: '13.5px' }}>
                  {m.text}
                </Typography>
              </Paper>
            )}

            {m.sender === 'user' && (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: 'var(--accent-gradient)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  mt: 0.25,
                  boxShadow: '0 2px 6px var(--accent-soft)',
                }}
              >
                <User size={16} />
              </Box>
            )}
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'var(--text-2)', p: 1, ml: 4 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 500 }}>
              Extracting details...
            </Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Extracted Details & Live Form Box */}
      {activeDraft && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.25 },
            borderRadius: '16px',
            border: '1px solid',
            borderColor: 'var(--accent)',
            bgcolor: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            boxShadow: 'var(--shadow)',
            mt: 0.5,
          }}
        >
          {/* Header Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle2 size={18} color="var(--credit)" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)' }}>
                Extracted Record Details
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={`${currencySymbol(currency)} ${activeDraft.amount}`}
                size="small"
                sx={{ fontWeight: 700, fontSize: '13.5px', borderRadius: '99px', px: 0.75, bgcolor: 'var(--accent)', color: '#ffffff' }}
              />
            </Box>
          </Box>

          {/* Transaction Type Toggle: Expense vs Income */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10.5px' }}>
              Transaction Type
            </Typography>
            <ToggleButtonGroup
              value={activeDraft.flow || 'out'}
              exclusive
              onChange={(_, newFlow) => {
                if (!newFlow) return;
                setActiveDraft({
                  ...activeDraft,
                  flow: newFlow,
                  category: newFlow === 'in' ? 'Income' : (activeDraft.category === 'Income' ? 'Food' : activeDraft.category),
                  splitMode: newFlow === 'in' ? 'just_me' : activeDraft.splitMode,
                  type: newFlow === 'in' ? 'personal' : activeDraft.type,
                  whoPaid: newFlow === 'in' ? 'me' : activeDraft.whoPaid,
                });
              }}
              size="small"
              fullWidth
              sx={{
                display: 'flex',
                gap: 0.5,
                bgcolor: 'var(--surface2)',
                p: 0.5,
                borderRadius: '99px',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  borderRadius: '99px !important',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '12px',
                  py: 0.65,
                  color: 'var(--text-2)',
                  border: 'none !important',
                  '&.Mui-selected': {
                    bgcolor: activeDraft.flow === 'in' ? 'var(--credit)' : 'var(--debit)',
                    color: '#ffffff !important',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  },
                },
              }}
            >
              <ToggleButton value="out">
                <TrendingDown size={14} style={{ marginRight: 4 }} /> Expense (-)
              </ToggleButton>
              <ToggleButton value="in">
                <TrendingUp size={14} style={{ marginRight: 4 }} /> Income (+)
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Who Paid & Split Mode Selector (Only if Expense) */}
          {activeDraft.flow !== 'in' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Primary Payer Selection: I Paid vs Friend Paid */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10.5px' }}>
                  Who Paid?
                </Typography>
                <ToggleButtonGroup
                  value={(activeDraft.whoPaid === 'other' || activeDraft.type === 'by_friend' || activeDraft.splitMode === 'by_friend') ? 'friend' : 'me'}
                  exclusive
                  onChange={(_, newPayer) => {
                    if (!newPayer) return;
                    const updated = { ...activeDraft };
                    const selectedFriendCount = (updated.friendNames && updated.friendNames.length > 0) ? updated.friendNames.length : 1;

                    if (newPayer === 'friend') {
                      updated.splitMode = 'by_friend';
                      updated.type = 'by_friend';
                      updated.whoPaid = 'other';
                      updated.myShare = updated.amount;
                      updated.friendShare = 0;
                    } else {
                      const mode = (updated.splitMode === 'by_friend') ? 'just_me' : (updated.splitMode || 'just_me');
                      updated.whoPaid = 'me';
                      if (mode === 'equal_split') {
                        updated.splitMode = 'equal_split';
                        updated.type = 'for_friend';
                        const share = Math.round((updated.amount / (selectedFriendCount + 1)) * 100) / 100;
                        updated.myShare = share;
                        updated.friendShare = Math.round((updated.amount - share) * 100) / 100;
                      } else if (mode === 'for_friend') {
                        updated.splitMode = 'for_friend';
                        updated.type = 'for_friend';
                        updated.myShare = 0;
                        updated.friendShare = updated.amount;
                      } else {
                        updated.splitMode = 'just_me';
                        updated.type = 'personal';
                        updated.myShare = updated.amount;
                        updated.friendShare = 0;
                      }
                    }
                    setActiveDraft(updated);
                  }}
                  size="small"
                  fullWidth
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    bgcolor: 'var(--surface2)',
                    p: 0.5,
                    borderRadius: '99px',
                    '& .MuiToggleButton-root': {
                      flex: 1,
                      borderRadius: '99px !important',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '12px',
                      py: 0.65,
                      color: 'var(--text-2)',
                      border: 'none !important',
                      '&.Mui-selected': {
                        bgcolor: 'var(--accent)',
                        color: '#ffffff !important',
                        boxShadow: '0 2px 6px var(--accent-soft)',
                      },
                    },
                  }}
                >
                  <ToggleButton value="me">
                    <User size={13} style={{ marginRight: 4 }} /> I Paid
                  </ToggleButton>
                  <ToggleButton value="friend">
                    <Users size={13} style={{ marginRight: 4 }} /> Friend Paid
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Sub-options when I Paid: Just Me | I Paid & Split | 100% For Friend */}
              {activeDraft.whoPaid !== 'other' && activeDraft.type !== 'by_friend' && activeDraft.splitMode !== 'by_friend' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10.5px' }}>
                    Split Options
                  </Typography>
                  <ToggleButtonGroup
                    value={activeDraft.splitMode || 'just_me'}
                    exclusive
                    onChange={(_, newMode) => {
                      if (!newMode) return;
                      const updated = { ...activeDraft };
                      const selectedFriendCount = (updated.friendNames && updated.friendNames.length > 0) ? updated.friendNames.length : 1;

                      if (newMode === 'equal_split') {
                        updated.splitMode = 'equal_split';
                        updated.type = 'for_friend';
                        updated.whoPaid = 'me';
                        const share = Math.round((updated.amount / (selectedFriendCount + 1)) * 100) / 100;
                        updated.myShare = share;
                        updated.friendShare = Math.round((updated.amount - share) * 100) / 100;
                      } else if (newMode === 'for_friend') {
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
                    size="small"
                    fullWidth
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      bgcolor: 'var(--surface2)',
                      p: 0.5,
                      borderRadius: '12px',
                      '& .MuiToggleButton-root': {
                        flex: 1,
                        borderRadius: '8px !important',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: { xs: '11px', sm: '11.5px' },
                        py: 0.65,
                        px: 0.5,
                        color: 'var(--text-2)',
                        border: 'none !important',
                        '&.Mui-selected': {
                          bgcolor: 'var(--accent)',
                          color: '#ffffff !important',
                          boxShadow: '0 2px 6px var(--accent-soft)',
                        },
                      },
                    }}
                  >
                    <ToggleButton value="just_me">
                      <User size={13} style={{ marginRight: 4 }} /> Just Me
                    </ToggleButton>
                    <ToggleButton value="equal_split">
                      <Users size={13} style={{ marginRight: 4 }} /> I Paid & Split
                    </ToggleButton>
                    <ToggleButton value="for_friend">
                      <CreditCard size={13} style={{ marginRight: 4 }} /> 100% For Friend
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              )}
            </Box>
          )}

          {/* Core Form Fields */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              label="Item Name (Description)"
              size="small"
              fullWidth
              value={activeDraft.description}
              onChange={(e) => setActiveDraft({ ...activeDraft, description: e.target.value })}
              placeholder="e.g. Poha"
              InputProps={{ sx: { borderRadius: '10px' } }}
            />

            <TextField
              label={`Total Amount (${currency})`}
              type="number"
              size="small"
              fullWidth
              value={activeDraft.amount || ''}
              InputProps={{ sx: { borderRadius: '10px' } }}
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

            {/* Friend / Contact Input with Autocomplete & Multi-Select */}
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
                      sx={{ borderRadius: '99px' }}
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
                    placeholder="Select or type..."
                    InputProps={{ ...params.InputProps, sx: { borderRadius: '10px' } }}
                  />
                )}
              />
            )}

            {/* Shares if Equal / Custom Split */}
            {activeDraft.splitMode === 'equal_split' && activeDraft.flow !== 'in' && (
              <>
                <TextField
                  label={`My Share (${currency})`}
                  type="number"
                  size="small"
                  fullWidth
                  value={activeDraft.myShare ?? ''}
                  InputProps={{ sx: { borderRadius: '10px' } }}
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
                  value={activeDraft.friendShare ?? ''}
                  InputProps={{ sx: { borderRadius: '10px' } }}
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
                sx={{ borderRadius: '10px' }}
                onChange={(e) => setActiveDraft({ ...activeDraft, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <InputLabel>Wallet / Account</InputLabel>
              <Select
                value={activeDraft.walletName}
                label="Wallet / Account"
                sx={{ borderRadius: '10px' }}
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
              InputProps={{ sx: { borderRadius: '10px' } }}
            />
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
            <Button
              size="medium"
              color="inherit"
              onClick={() => setActiveDraft(null)}
              sx={{ borderRadius: '99px', textTransform: 'none', fontWeight: 600, px: 2 }}
            >
              Discard
            </Button>
            <Button
              size="medium"
              variant="contained"
              startIcon={<PlusCircle size={17} />}
              onClick={handleConfirmDraft}
              sx={{
                borderRadius: '99px',
                fontWeight: 600,
                px: 3,
                py: 1,
                textTransform: 'none',
                bgcolor: activeDraft.flow === 'in' ? 'var(--credit)' : 'var(--accent)',
                boxShadow: '0 4px 12px var(--accent-soft)',
                '&:hover': {
                  bgcolor: activeDraft.flow === 'in' ? '#15803d' : 'var(--accent-dark)',
                },
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
    </DialogContent>
  );

  const footerActions = (
    <DialogActions
      sx={{
        p: { xs: 1.5, sm: 2 },
        pt: 0.5,
        borderTop: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 1.25,
        bgcolor: 'var(--surface)',
      }}
    >
      {/* Quick Voice Suggestion Pills */}
      {!activeDraft && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            py: 0.25,
            px: 0.25,
            width: '100%',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {quickPills.map((pill) => (
            <Chip
              key={pill}
              label={pill}
              size="small"
              onClick={() => handleSend(pill)}
              sx={{
                fontSize: '11.5px',
                cursor: 'pointer',
                borderRadius: '99px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                bgcolor: 'var(--surface2)',
                border: '1px solid',
                borderColor: 'var(--border2)',
                color: 'var(--text-2)',
                fontWeight: 500,
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'var(--surface3)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  transform: 'translateY(-1px)',
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Floating Capsule Input Shell */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          bgcolor: 'var(--surface2)',
          borderRadius: '99px',
          p: '5px 6px 5px 14px',
          border: '1px solid',
          borderColor: isListening ? 'var(--debit)' : 'var(--border2)',
          boxShadow: isListening
            ? `0 0 ${10 + volumeLevel * 12}px rgba(239, 68, 68, ${0.25 + volumeLevel * 0.25})`
            : '0 2px 10px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.15s ease',
          '&:focus-within': {
            borderColor: isListening ? 'var(--debit)' : 'var(--accent)',
            bgcolor: 'var(--surface)',
            boxShadow: isListening
              ? `0 0 16px rgba(239, 68, 68, 0.35)`
              : '0 4px 16px var(--accent-soft)',
          },
        }}
      >
        <AudioWaveVisualizer volume={volumeLevel} isListening={isListening} />

        <InputBase
          placeholder={isListening ? 'Listening... Speak now...' : 'Type e.g. "Paid 30rs for poha"...'}
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
            '& input::placeholder': {
              color: 'var(--text-3)',
              opacity: 0.85,
            },
          }}
        />

        <Tooltip title={isListening ? 'Stop mic' : 'Speak to Max'}>
          <IconButton
            onClick={toggleListening}
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              bgcolor: isListening ? 'var(--debit)' : 'transparent',
              color: isListening ? '#ffffff' : 'var(--text-2)',
              flexShrink: 0,
              transition: 'all 0.08s cubic-bezier(0, 0, 0.2, 1)',
              boxShadow: isListening
                ? `0 0 0 ${3 + volumeLevel * 6}px rgba(239, 68, 68, ${0.15 + volumeLevel * 0.25}), 0 0 ${12 + volumeLevel * 14}px rgba(239, 68, 68, ${0.3 + volumeLevel * 0.3})`
                : 'none',
              transform: isListening ? `scale(${1 + volumeLevel * 0.1})` : 'scale(1)',
              '&:hover': {
                bgcolor: isListening ? 'var(--debit)' : 'var(--surface3)',
                color: isListening ? '#ffffff' : 'var(--text)',
              },
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </IconButton>
        </Tooltip>

        <IconButton
          onClick={() => handleSend()}
          disabled={!inputText.trim() || loading}
          sx={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            color: '#ffffff',
            flexShrink: 0,
            transition: 'all 0.2s ease',
            '&:hover': {
              filter: 'brightness(1.18)',
              transform: 'scale(1.05)',
            },
            '&.Mui-disabled': {
              bgcolor: 'var(--surface3)',
              color: 'var(--text-3)',
              opacity: 0.5,
            },
          }}
        >
          <Send size={16} />
        </IconButton>
      </Box>
    </DialogActions>
  );

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(6px)',
              backgroundColor: 'rgba(17,17,17,0.55)',
              animation: 'fadein 0.15s ease',
            },
          },
        }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            height: '88vh',
            maxHeight: '88vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'var(--surface)',
            borderTop: '1px solid',
            borderColor: 'var(--border2)',
            transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px) !important` : undefined,
            transition: dragOffsetY > 0 ? 'none !important' : undefined,
          },
        }}
      >
        {/* Unified Header with Drag Handle */}
        <Box
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          sx={{
            touchAction: 'none',
            bgcolor: 'var(--surface)',
            borderBottom: '1px solid',
            borderColor: 'var(--border)',
            pt: 1.25,
            pb: 1.25,
            px: 2,
            cursor: 'grab',
            userSelect: 'none',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          {/* Drag Indicator Pill */}
          <Box
            sx={{
              width: dragOffsetY > 0 ? 48 : 36,
              height: 4,
              bgcolor: dragOffsetY > 0
                ? 'var(--text-2)'
                : 'var(--border2)',
              borderRadius: 99,
              mx: 'auto',
              mb: 1.25,
              transition: dragOffsetY > 0 ? 'width 0.1s ease-out, background-color 0.15s ease' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
          {/* Header Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '12px',
                  background: 'var(--accent-gradient)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 4px 12px var(--accent-soft)',
                }}
              >
                <Sparkles size={20} color="#ffffff" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em', color: 'var(--text)' }}>
                  Max
                </Typography>
                <Chip
                  label="Financial Assistant"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '10px',
                    fontWeight: 600,
                    bgcolor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    borderRadius: '99px',
                    px: 0.5,
                  }}
                />
              </Box>
            </Box>
            <IconButton size="small" onClick={onClose} sx={{ color: 'var(--text-2)', p: 0.75, borderRadius: '50%', '&:hover': { bgcolor: 'var(--surface2)', color: 'var(--text)' } }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
        {mainBodyContent}
        {footerActions}
      </SwipeableDrawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={ModalFadeTransition}
      maxWidth="md"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(17,17,17,0.55)',
            animation: 'fadein 0.15s ease',
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          height: '82vh',
          maxHeight: '780px',
          maxWidth: '740px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid',
          borderColor: 'var(--border2)',
          bgcolor: 'var(--surface)',
          animation: 'slidein 0.18s ease',
        },
      }}
    >
      {headerContent}
      {mainBodyContent}
      {footerActions}
    </Dialog>
  );
}
