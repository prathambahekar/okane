import React, { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
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
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
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
} from 'lucide-react';
import { useStore } from '../store';
import { currencySymbol } from '../utils';
import { uid, todayISO } from '../db';
import type { ExpenseType, ExpenseFlow } from '../types';

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: { resultIndex: number; results: Array<Array<{ transcript: string }>> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
}

interface DraftExpense {
  description: string;
  amount: number;
  category: string;
  type: ExpenseType;
  flow: ExpenseFlow;
  whoPaid?: 'me' | 'other';
  splitMode?: 'just_me' | 'equal_split' | 'custom_split' | 'for_friend' | 'pay_debt';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';

  const { db, addExpense, addFriend, showToast } = useStore();
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
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

  // Setup Web Speech Recognition if available
  useEffect(() => {
    const SpeechRecognitionClass = (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          showToast(`Mic error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [showToast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast('Voice input is not supported in this browser. Please type your command.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setInputText('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting mic:', err);
        setIsListening(false);
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
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
        // Ensure default calculations if split equal
        const d = data.draft as DraftExpense;
        if (!d.splitMode) {
          if (d.type === 'for_friend') d.splitMode = 'equal_split';
          else if (d.type === 'by_friend') d.splitMode = 'equal_split';
          else d.splitMode = 'just_me';
        }
        if (d.splitMode === 'equal_split') {
          if (d.myShare == null) d.myShare = Math.round((d.amount / 2) * 100) / 100;
          if (d.friendShare == null) d.friendShare = Math.round((d.amount / 2) * 100) / 100;
        }
        setActiveDraft(d);
      }
    } catch (err) {
      console.error('Failed to communicate with Max AI:', err);
      setMessages(prev => [
        ...prev,
        {
          id: generateMsgId(),
          sender: 'bot',
          text: 'Sorry, I had trouble parsing that. Could you rephrase your command?',
          timestamp: timeStr,
        }
      ]);
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
      if (!fObj && nameStr && activeDraft.splitMode !== 'just_me') {
        fObj = addFriend({ name: nameStr, type: 'friend' });
      }
      return fObj;
    }).filter(Boolean);

    const totalAmt = Number(activeDraft.amount) || 0;
    const itemDesc = activeDraft.description?.trim() || 'Expense';
    const itemCat = activeDraft.category || categories[0] || 'Food';
    const itemDate = activeDraft.date || todayISO();
    const itemWalletId = matchedWallet?.id || wallets[0]?.id || '';
    const itemFlow = activeDraft.flow || 'out';

    const mode = activeDraft.splitMode || (activeDraft.type === 'personal' ? 'just_me' : 'equal_split');

    if (itemFlow === 'in') {
      // Record Income
      addExpense({
        description: itemDesc,
        amount: totalAmt,
        category: 'Income',
        date: itemDate,
        type: activeDraft.type || 'personal',
        flow: 'in',
        friendId: resolvedFriends[0] ? resolvedFriends[0].id : null,
        walletId: itemWalletId,
        status: 'paid',
        notes: activeDraft.notes || 'Added via Max AI',
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
        notes: activeDraft.notes || 'Added via Max AI',
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
    'I paid 100 for me and Alex',
    'Coffee 150rs for Alex',
    'Alex paid 500 for dinner',
    'Yesterday arman paid my poha'
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
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}
        >
          <Sparkles size={20} />
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>
              Max AI
            </Typography>
            <Chip
              label="Financial Assistant"
              size="small"
              sx={{
                height: 20,
                fontSize: '10px',
                fontWeight: 600,
                bgcolor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                borderRadius: '4px',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11.5px', display: 'block' }}>
            Voice or text expense logger
          </Typography>
        </Box>
      </Box>
      <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary', p: 0.75, borderRadius: '6px' }}>
        <X size={20} />
      </IconButton>
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
        bgcolor: isDark ? '#0b0f17' : '#f8fafc',
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
                  width: 30,
                  height: 30,
                  borderRadius: '6px',
                  background: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.08)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  mt: 0.25,
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : 'rgba(37, 99, 235, 0.15)',
                }}
              >
                <Sparkles size={15} color="#2563eb" />
              </Box>
            )}

            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.25,
                borderRadius: m.sender === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                bgcolor: m.sender === 'user'
                  ? 'primary.main'
                  : (isDark ? '#1e293b' : '#ffffff'),
                color: m.sender === 'user' ? '#ffffff' : 'text.primary',
                maxWidth: { xs: '90%', sm: '82%' },
                whiteSpace: 'pre-line',
                border: '1px solid',
                borderColor: m.sender === 'user' ? 'primary.main' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
                boxShadow: m.sender === 'bot' ? '0 1px 4px rgba(0,0,0,0.03)' : '0 2px 6px rgba(37, 99, 235, 0.2)',
              }}
            >
              <Typography variant="body2" sx={{ lineHeight: 1.5, fontSize: '13.5px' }}>
                {m.text}
              </Typography>
            </Paper>

            {m.sender === 'user' && (
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '6px',
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                <User size={15} />
              </Box>
            )}
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary', p: 1, ml: 4 }}>
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
            borderRadius: '10px',
            border: '1px solid',
            borderColor: isDark ? '#3b82f6' : '#2563eb',
            bgcolor: isDark ? '#161e2e' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.1)',
            mt: 0.5,
          }}
        >
          {/* Header Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle2 size={18} color="#16a34a" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '14.5px' }}>
                Extracted Record Details
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={activeDraft.flow === 'in' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                label={activeDraft.flow === 'in' ? 'Income (+)' : 'Expense (-)'}
                size="small"
                color={activeDraft.flow === 'in' ? 'success' : 'default'}
                sx={{ fontWeight: 600, fontSize: '11px', borderRadius: '4px' }}
              />
              <Chip
                label={`${currencySymbol(currency)} ${activeDraft.amount}`}
                size="small"
                color="primary"
                sx={{ fontWeight: 700, fontSize: '13.5px', borderRadius: '6px', px: 0.5 }}
              />
            </Box>
          </Box>

          {/* Payment & Split Mode Selector */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10.5px' }}>
              Split / Payment Mode
            </Typography>
            <ToggleButtonGroup
              value={activeDraft.splitMode || (activeDraft.type === 'personal' ? 'just_me' : 'equal_split')}
              exclusive
              onChange={(_, newMode) => {
                if (!newMode) return;
                const updated = { ...activeDraft, splitMode: newMode };
                const selectedFriendCount = (updated.friendNames && updated.friendNames.length > 0) ? updated.friendNames.length : 1;
                if (newMode === 'equal_split') {
                  updated.type = 'for_friend';
                  updated.whoPaid = 'me';
                  const share = Math.round((updated.amount / (selectedFriendCount + 1)) * 100) / 100;
                  updated.myShare = share;
                  updated.friendShare = Math.round((updated.amount - share) * 100) / 100;
                } else if (newMode === 'for_friend') {
                  updated.type = 'for_friend';
                  updated.whoPaid = 'me';
                  updated.myShare = 0;
                  updated.friendShare = updated.amount;
                } else if (newMode === 'just_me') {
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
                flexDirection: 'row',
                flexWrap: 'nowrap',
                width: '100%',
                gap: 0.5,
                '& .MuiToggleButton-root': {
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  borderRadius: '6px !important',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: { xs: '11px', sm: '12px' },
                  py: 0.75,
                  px: 0.5,
                  border: '1px solid !important',
                  borderColor: isDark ? 'rgba(255,255,255,0.12) !important' : '#cbd5e1 !important',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: '#ffffff',
                    borderColor: 'primary.main !important',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                },
              }}
            >
              <ToggleButton value="just_me">
                <User size={14} style={{ marginRight: 4 }} /> Just Me
              </ToggleButton>
              <ToggleButton value="equal_split">
                <Users size={14} style={{ marginRight: 4 }} /> Split Equally
              </ToggleButton>
              <ToggleButton value="for_friend">
                <CreditCard size={14} style={{ marginRight: 4 }} /> 100% For Friend
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Core Form Fields */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              label="Item Name (Description)"
              size="small"
              fullWidth
              value={activeDraft.description}
              onChange={(e) => setActiveDraft({ ...activeDraft, description: e.target.value })}
              placeholder="e.g. Poha"
              InputProps={{ sx: { borderRadius: '6px' } }}
            />

            <TextField
              label={`Total Amount (${currency})`}
              type="number"
              size="small"
              fullWidth
              value={activeDraft.amount || ''}
              InputProps={{ sx: { borderRadius: '6px' } }}
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
                }
                setActiveDraft({ ...activeDraft, amount: newAmt, myShare: my, friendShare: fr });
              }}
            />

            {/* Friend / Contact Input with Autocomplete & Multi-Select */}
            {activeDraft.splitMode !== 'just_me' && (
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
                      sx={{ borderRadius: '4px' }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Friends / Contacts"
                    placeholder="Select or type..."
                    InputProps={{ ...params.InputProps, sx: { borderRadius: '6px' } }}
                  />
                )}
              />
            )}

            {/* Shares if Equal / Custom Split */}
            {activeDraft.splitMode === 'equal_split' && (
              <>
                <TextField
                  label={`My Share (${currency})`}
                  type="number"
                  size="small"
                  fullWidth
                  value={activeDraft.myShare ?? ''}
                  InputProps={{ sx: { borderRadius: '6px' } }}
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
                  InputProps={{ sx: { borderRadius: '6px' } }}
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
                sx={{ borderRadius: '6px' }}
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
                sx={{ borderRadius: '6px' }}
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
              InputProps={{ sx: { borderRadius: '6px' } }}
            />
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
            <Button
              size="medium"
              color="inherit"
              onClick={() => setActiveDraft(null)}
              sx={{ borderRadius: '6px', textTransform: 'none', fontWeight: 600 }}
            >
              Discard
            </Button>
            <Button
              size="medium"
              variant="contained"
              startIcon={<PlusCircle size={17} />}
              onClick={handleConfirmDraft}
              sx={{
                borderRadius: '6px',
                fontWeight: 600,
                px: 2.5,
                py: 1,
                textTransform: 'none',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
            >
              {activeDraft.splitMode === 'equal_split' ? 'Add Split Expense' : 'Add Expense'}
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
        borderTop: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 1.25,
        bgcolor: 'background.paper',
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
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                color: 'text.primary',
                fontWeight: 500,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#dbeafe',
                  borderColor: '#2563eb',
                  color: '#2563eb',
                },
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <TextField
          placeholder={isListening ? 'Listening...' : 'Type e.g. "I paid 100 for me and Alex"...'}
          size="medium"
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
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px',
              fontSize: '14px',
            },
          }}
        />

        <Tooltip title={isListening ? 'Stop mic' : 'Speak to Max'}>
          <IconButton
            color={isListening ? 'error' : 'primary'}
            onClick={toggleListening}
            sx={{
              borderRadius: '8px',
              bgcolor: isListening ? 'error.light' : (isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'),
              p: 1.25,
              animation: isListening ? 'pulse 1.2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.15)' },
                '100%': { transform: 'scale(1)' },
              },
            }}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </IconButton>
        </Tooltip>

        <IconButton
          color="primary"
          onClick={() => handleSend()}
          disabled={!inputText.trim() || loading}
          sx={{
            borderRadius: '8px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
            p: 1.25,
          }}
        >
          <Send size={18} />
        </IconButton>
      </Box>
    </DialogActions>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            height: '90vh',
            maxHeight: '90vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 4,
            bgcolor: isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1',
            borderRadius: 99,
            mx: 'auto',
            mt: 1.25,
            mb: 0.25,
            flexShrink: 0,
          }}
        />
        {headerContent}
        {mainBodyContent}
        {footerActions}
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '14px',
          overflow: 'hidden',
          height: '82vh',
          maxHeight: '780px',
          maxWidth: '740px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        },
      }}
    >
      {headerContent}
      {mainBodyContent}
      {footerActions}
    </Dialog>
  );
}
