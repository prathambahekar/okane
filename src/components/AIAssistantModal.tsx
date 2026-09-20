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
  ArrowUp,
  X,
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
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Layers as LayersIcon,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { useStore } from '../store';
import { currencySymbol, resolveCategoryMeta, getAvatarStyle as getAppAvatarStyle } from '../utils';
import { parseLocallyClient } from '../nlp';
import { uid, todayISO } from '../db';
import type { ExpenseType, ExpenseFlow, Category, AppDB } from '../types';
import CategoryIcon, { CategoryBadge } from './CategoryIcon';
import type { ExpenseInitialData } from './ExpenseModal';
import { renderWalletIcon } from './WalletIconRenderer';
import { getFrequentTasks, type FrequentTaskItem } from '../utils/frequentTasks';
import { showSoftKeyboard } from '../utils/keyboard';

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
        borderRadius: 'var(--radius-full)',
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
              borderRadius: 'var(--radius-full)',
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



function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|₹[\d,.]+|\$[\d,.]+|€[\d,.]+|£[\d,.]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} style={{ fontWeight: 700, color: 'inherit', letterSpacing: '-0.01em' }}>
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.match(/^(?:₹|\$|€|£)[\d,.]+/)) {
      return (
        <span
          key={i}
          style={{
            fontWeight: 650,
            color: 'inherit',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function parseBulletLine(line: string, previousContext?: string, db?: AppDB): ParsedBullet {
  const clean = line.replace(/^[•\-*\d.]+\s*/, '').trim();

  // Pattern 1: Debt/Friend: e.g. "Hrishi: owes you ₹975" or "Hrishi: you owe ₹200" or "Hrishi owes you ₹975"
  const owesMatch = clean.match(/^([^:-]+)[:-]?\s*(owes you|you owe|owes|is owed)\s*(?:₹|\$|€|£|INR)?\s*([\d,.]+)/i);
  if (owesMatch) {
    const name = owesMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
    const relation = owesMatch[2].toLowerCase();
    const amtStr = owesMatch[3];
    const isOwedToMe = relation.includes('owes you') || relation === 'owes';
    const symMatch = clean.match(/(₹|\$|€|£)/);
    const sym = symMatch ? symMatch[1] : '₹';
    return {
      raw: clean,
      kind: 'friend_debt',
      label: name,
      amount: `${sym}${amtStr}`,
      badgeText: isOwedToMe ? `Owes you ${sym}${amtStr}` : `You owe ${sym}${amtStr}`,
      badgeType: isOwedToMe ? 'credit' : 'debit',
      isOwedToMe,
    };
  }

  // Pattern 2: Transaction item e.g. "2026-08-27: Tiffin (+₹75) [Food & Dining]"
  const txMatch = clean.match(/^([\d-]+)[:-]\s*(.*?)\s*\(([+-]?)(?:₹|\$|€|£|INR)?([\d,.]+)\)\s*(?:\[(.*?)\])?/i);
  if (txMatch) {
    const date = txMatch[1];
    const desc = txMatch[2].trim();
    const sign = txMatch[3] || '-';
    const amt = txMatch[4];
    const cat = txMatch[5];
    const isCredit = sign === '+';
    const symMatch = clean.match(/(₹|\$|€|£)/);
    const sym = symMatch ? symMatch[1] : '₹';
    return {
      raw: clean,
      kind: 'transaction',
      label: desc,
      subText: `${date}${cat ? ` • ${cat}` : ''}`,
      amount: `${sign}${sym}${amt}`,
      badgeType: isCredit ? 'credit' : 'neutral',
      category: cat,
    };
  }

  // Pattern 3: Name: Amount (Could be Category spend, Wallet, or Friend)
  const accountMatch = clean.match(/^([^:-]+)[:-]\s*(?:₹|\$|€|£|INR)?\s*([\d,.]+)/i);
  if (accountMatch) {
    const name = accountMatch[1].replace(/^\*\*|\*\*$/g, '').trim();
    const amtStr = accountMatch[2];
    const symMatch = clean.match(/(₹|\$|€|£)/);
    const sym = symMatch ? symMatch[1] : '₹';

    const prev = (previousContext || '').toLowerCase();
    const isCategoryContext = prev.includes('top categories') || prev.includes('category') || prev.includes('categories') || prev.includes('spent') || prev.includes('spending');

    const walletObj = db?.wallets?.find(w => w.name.toLowerCase() === name.toLowerCase());
    const isKnownCat = db?.settings?.categories?.some(c => c.name.toLowerCase() === name.toLowerCase()) ||
      ['food', 'shopping', 'rent', 'housing', 'transfer', 'travel', 'transport', 'bills', 'utilities', 'entertainment', 'health', 'medical', 'education', 'groceries', 'personal', 'dining', 'general', 'income', 'salary'].includes(name.toLowerCase());

    if (isCategoryContext && !walletObj) {
      return {
        raw: clean,
        kind: 'category_spending',
        label: name,
        category: name,
        amount: `${sym}${amtStr}`,
        subText: 'Category Spend',
        badgeType: 'neutral',
      };
    }

    if (walletObj) {
      return {
        raw: clean,
        kind: 'wallet',
        label: name,
        amount: `${sym}${amtStr}`,
        subText: 'Account',
        badgeType: 'neutral',
      };
    }

    if (isKnownCat) {
      return {
        raw: clean,
        kind: 'category_spending',
        label: name,
        category: name,
        amount: `${sym}${amtStr}`,
        subText: 'Category Spend',
        badgeType: 'neutral',
      };
    }

    return {
      raw: clean,
      kind: 'wallet',
      label: name,
      amount: `${sym}${amtStr}`,
      subText: 'Account',
      badgeType: 'neutral',
    };
  }

  // Pattern 4: Informational / Feature Help Bullet e.g. "**Log transactions**: e.g., *"Spent ₹150 on Lunch"*"
  const helpMatch = clean.match(/^\*\*([^*]+)\*\*[:-]?\s*(.*)/);
  if (helpMatch) {
    const title = helpMatch[1].trim();
    const desc = helpMatch[2].replace(/\*+/g, '').trim();
    return {
      raw: clean,
      kind: 'generic',
      label: title,
      subText: desc || undefined,
      badgeType: 'neutral',
    };
  }

  // Pattern 5: Expense format e.g. "Coffee - ₹30 (Food, Cash)"
  const expMatch = clean.match(/^([^-:]+)(?:[-:]\s*(?:₹|\$|€|£|INR)?\s*([\d,.]+))?\s*(?:\((.*?)\))?/i);
  if (expMatch && expMatch[2]) {
    const symMatch = clean.match(/(₹|\$|€|£)/);
    const sym = symMatch ? symMatch[1] : '₹';
    return {
      raw: clean,
      kind: 'generic',
      label: expMatch[1].trim(),
      amount: `${sym}${expMatch[2]}`,
      subText: expMatch[3] ? expMatch[3].trim() : undefined,
      badgeType: 'neutral',
    };
  }

  return {
    raw: clean,
    kind: 'generic',
    label: clean.replace(/\*+/g, ''),
  };
}

interface TextMessageBlock {
  type: 'text';
  content: string;
}

interface CardsMessageBlock {
  type: 'cards';
  headerTitle: string;
  headerKind: 'category_spending' | 'wallet' | 'friend_debt' | 'transaction' | 'generic';
  badgeText?: string;
  items: ParsedBullet[];
}

type MessageBlock = TextMessageBlock | CardsMessageBlock;

function BotMessageBubble({ text }: { text: string }) {
  const { db } = useStore();

  const blocks: MessageBlock[] = useMemo(() => {
    const rawLines = text.split('\n');
    const result: MessageBlock[] = [];
    let currentTextLines: string[] = [];
    let currentBullets: ParsedBullet[] = [];

    const flushText = () => {
      if (currentTextLines.length > 0) {
        const content = currentTextLines.join('\n').trim();
        if (content) {
          result.push({ type: 'text', content });
        }
        currentTextLines = [];
      }
    };

    const flushBullets = () => {
      if (currentBullets.length > 0) {
        let headerTitle = '';
        const firstKind = currentBullets[0].kind;
        const count = currentBullets.length;

        // Check if the immediately preceding text line was a section label / header
        if (currentTextLines.length > 0) {
          const lastLine = currentTextLines[currentTextLines.length - 1].trim();
          const isHeaderLike =
            /^top\s+(spending\s+)?categories[:]?$/i.test(lastLine) ||
            /^categories[:]?$/i.test(lastLine) ||
            /^top\s+expenses?[:]?$/i.test(lastLine) ||
            /^account\s+balances?[:]?$/i.test(lastLine) ||
            /^accounts?[:]?$/i.test(lastLine) ||
            /^wallets?[:]?$/i.test(lastLine) ||
            /^recent\s+transactions?[:]?$/i.test(lastLine) ||
            /^pending\s+(debts|balances)?[:]?$/i.test(lastLine) ||
            /^who\s+owes\s+you[:]?$/i.test(lastLine) ||
            (lastLine.endsWith(':') && lastLine.length <= 32 && !lastLine.includes(' spent ') && !lastLine.includes(' balance is '));

          if (isHeaderLike) {
            currentTextLines.pop();
            headerTitle = lastLine.replace(/[:]+$/, '').trim();
          }
        }

        // Flush preceding conversational text into its own distinct speech box
        flushText();

        // If no explicit header was extracted from preceding line, provide clean semantic fallback
        if (!headerTitle) {
          if (firstKind === 'category_spending') {
            headerTitle = 'Top Categories';
          } else if (firstKind === 'wallet') {
            headerTitle = 'Accounts Breakdown';
          } else if (firstKind === 'friend_debt') {
            const hasOwedToMe = currentBullets.some((b) => b.isOwedToMe || b.badgeType === 'credit');
            headerTitle = hasOwedToMe ? 'Pending Balances' : 'Pending Debts';
          } else if (firstKind === 'transaction') {
            headerTitle = 'Recent Transactions';
          } else {
            headerTitle = 'Overview';
          }
        }

        let badgeText = '';
        if (firstKind === 'category_spending') {
          badgeText = `${count} ${count === 1 ? 'category' : 'categories'}`;
        } else if (firstKind === 'wallet') {
          badgeText = `${count} ${count === 1 ? 'account' : 'accounts'}`;
        } else if (firstKind === 'friend_debt') {
          badgeText = `${count} ${count === 1 ? 'contact' : 'contacts'}`;
        } else if (firstKind === 'transaction') {
          badgeText = `${count} ${count === 1 ? 'entry' : 'entries'}`;
        }

        result.push({
          type: 'cards',
          headerTitle,
          headerKind: firstKind,
          badgeText,
          items: [...currentBullets],
        });

        currentBullets = [];
      }
    };

    for (const line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.match(/^[•\-*]/) || trimmed.match(/^\d+[.)]/)) {
        const prevContext = currentTextLines.length > 0 ? currentTextLines[currentTextLines.length - 1] : '';
        currentBullets.push(parseBulletLine(trimmed, prevContext, db));
      } else {
        flushBullets();
        currentTextLines.push(trimmed);
      }
    }

    flushBullets();
    flushText();

    return result;
  }, [text, db]);

  const cardTileSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1.5,
    px: 1,
    py: 0.85,
    minHeight: 46,
    borderRadius: 'var(--radius-md)',
    bgcolor: 'transparent',
    border: '1px solid transparent',
    boxShadow: 'none',
    transition: 'background-color 0.15s ease',
    '&:hover': {
      bgcolor: 'rgba(255, 255, 255, 0.04)',
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {blocks.map((block, idx) => {
        if (block.type === 'text') {
          return (
            <Paper
              key={idx}
              elevation={0}
              sx={{
                px: { xs: 2, sm: 2.25 },
                py: { xs: 1.35, sm: 1.55 },
                borderRadius: '18px 18px 18px 4px',
                bgcolor: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
                width: 'fit-content',
                maxWidth: '100%',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.55,
                  fontSize: 'var(--fs-base)',
                  color: 'var(--text)',
                  fontWeight: 550,
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '-0.012em',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                }}
              >
                {renderFormattedText(block.content)}
              </Typography>
            </Paper>
          );
        }

        return (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 1.75 },
              borderRadius: 'var(--radius-lg)',
              bgcolor: 'var(--surface2)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              width: '100%',
              maxWidth: '100%',
            }}
          >
            {/* Header row for structured categories/accounts/debts container */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 0.5,
                pt: 0.25,
                pb: 0.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    color: 'var(--text-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {block.headerKind === 'category_spending' && <LayersIcon size={15} strokeWidth={2} />}
                  {block.headerKind === 'wallet' && <LayersIcon size={15} strokeWidth={2} />}
                  {block.headerKind === 'friend_debt' && <Users size={15} strokeWidth={2} />}
                  {block.headerKind === 'transaction' && <ReceiptIcon size={15} strokeWidth={2} />}
                  {block.headerKind === 'generic' && <Sparkles size={15} strokeWidth={2} />}
                </Box>
                <Typography
                  sx={{
                    fontSize: 'var(--fs-base)',
                    fontWeight: 700,
                    color: 'var(--text)',
                    letterSpacing: '-0.01em',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {block.headerTitle}
                </Typography>
              </Box>

              {block.badgeText && (
                <Box
                  sx={{
                    fontSize: 'var(--fs-caption)',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    bgcolor: 'var(--accent-soft)',
                    border: '1px solid var(--accent-border-soft)',
                    borderRadius: 'var(--radius-full)',
                    px: 1.1,
                    py: 0.25,
                    fontFamily: 'var(--font-sans)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {block.badgeText}
                </Box>
              )}
            </Box>

            {/* List of sub-card items */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
              {block.items.map((bullet, bIdx) => {
                if (bullet.kind === 'friend_debt') {
                  const friendObj = db.friends.find(
                    (f) => f.name.toLowerCase() === bullet.label.toLowerCase()
                  );
                  const friendColor = friendObj?.color || bullet.label;
                  const avatarStyle = getAppAvatarStyle(friendColor);
                  const displayInitial = friendObj
                    ? (friendObj.avatarNumber !== undefined ? String(friendObj.avatarNumber) : friendObj.name.charAt(0).toUpperCase())
                    : bullet.label.trim().charAt(0).toUpperCase() || 'F';
                  const isPositive = bullet.isOwedToMe ?? bullet.badgeType === 'credit';

                  return (
                    <Box key={bIdx} sx={cardTileSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.35, minWidth: 0, flex: 1 }}>
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 'var(--radius-md)',
                            background: avatarStyle.background,
                            color: avatarStyle.color,
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: 'var(--fs-sm)',
                            flexShrink: 0,
                            border: '1px solid var(--border)',
                          }}
                        >
                          {displayInitial}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontSize: 'var(--fs-base)',
                              fontWeight: 650,
                              color: 'var(--text)',
                              lineHeight: 1.25,
                              letterSpacing: '-0.01em',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {bullet.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              fontSize: 'var(--fs-caption)',
                              color: 'var(--text-3)',
                              fontWeight: 500,
                              letterSpacing: '0.01em',
                              lineHeight: 1.2,
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {friendObj?.type ? friendObj.type.charAt(0).toUpperCase() + friendObj.type.slice(1) : (isPositive ? 'Owes you' : 'You owe')}
                          </Typography>
                        </Box>
                      </Box>

                      {bullet.badgeText && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.6,
                            px: 1.15,
                            py: 0.35,
                            borderRadius: 'var(--radius-full)',
                            bgcolor: isPositive ? 'var(--credit-bg)' : 'var(--debit-bg)',
                            border: '1px solid',
                            borderColor: isPositive ? 'var(--credit-border)' : 'var(--debit-border)',
                            color: isPositive ? 'var(--credit)' : 'var(--debit)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            fontFamily: 'var(--font-sans)',
                            flexShrink: 0,
                          }}
                        >
                          {isPositive ? (
                            <ArrowDownLeft size={13} strokeWidth={2.6} />
                          ) : (
                            <ArrowUpRight size={13} strokeWidth={2.6} />
                          )}
                          <span>{bullet.badgeText}</span>
                        </Box>
                      )}
                    </Box>
                  );
                }

                if (bullet.kind === 'wallet') {
                  const walletObj = db.wallets.find(
                    (w) => w.name.toLowerCase() === bullet.label.toLowerCase()
                  );
                  const walletColor = walletObj?.color || '#3b82f6';
                  const iconKey = walletObj?.icon || walletObj?.name || 'wallet';

                  return (
                    <Box key={bIdx} sx={cardTileSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.35, minWidth: 0, flex: 1 }}>
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {renderWalletIcon(iconKey, 34, walletColor)}
                        </Box>
                        <Typography
                          noWrap
                          sx={{
                            fontSize: 'var(--fs-base)',
                            fontWeight: 650,
                            color: 'var(--text)',
                            lineHeight: 1.25,
                            letterSpacing: '-0.01em',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {bullet.label}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 'var(--fs-md)',
                            fontWeight: 750,
                            color: 'var(--text)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.01em',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {bullet.amount}
                        </Typography>
                        <ChevronRight size={14} style={{ color: 'var(--text-3)', opacity: 0.55 }} />
                      </Box>
                    </Box>
                  );
                }

                if (bullet.kind === 'category_spending') {
                  const matchedCatObj = db.settings?.categories?.find(
                    (c) => c.name.toLowerCase() === bullet.label.toLowerCase()
                  );
                  const catMeta = resolveCategoryMeta(bullet.label, matchedCatObj);

                  return (
                    <Box key={bIdx} sx={cardTileSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.35, minWidth: 0, flex: 1 }}>
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 'var(--radius-md)',
                            background: `${catMeta.color}18`,
                            border: '1px solid var(--border)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon icon={catMeta.icon} color={catMeta.color} size={17} />
                        </Box>
                        <Typography
                          noWrap
                          sx={{
                            fontSize: 'var(--fs-base)',
                            fontWeight: 650,
                            color: 'var(--text)',
                            lineHeight: 1.25,
                            letterSpacing: '-0.01em',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {bullet.label}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 'var(--fs-md)',
                            fontWeight: 750,
                            color: 'var(--text)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.01em',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {bullet.amount}
                        </Typography>
                        <ChevronRight size={14} style={{ color: 'var(--text-3)', opacity: 0.55 }} />
                      </Box>
                    </Box>
                  );
                }

                if (bullet.kind === 'transaction') {
                  const matchedCatObj = db.settings?.categories?.find(
                    (c) => c.name.toLowerCase() === (bullet.category || '').toLowerCase()
                  );
                  const catMeta = resolveCategoryMeta(bullet.category || 'Expense', matchedCatObj);
                  const isCredit = bullet.amount?.startsWith('+') ?? false;

                  return (
                    <Box key={bIdx} sx={cardTileSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.35, minWidth: 0, flex: 1 }}>
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 'var(--radius-md)',
                            background: `${catMeta.color}18`,
                            border: '1px solid var(--border)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon icon={catMeta.icon} color={catMeta.color} size={16} />
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontSize: 'var(--fs-base)',
                              fontWeight: 650,
                              color: 'var(--text)',
                              lineHeight: 1.25,
                              letterSpacing: '-0.01em',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {bullet.label}
                          </Typography>
                          {bullet.subText && (
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{
                                fontSize: 'var(--fs-caption)',
                                color: 'var(--text-3)',
                                fontWeight: 500,
                                letterSpacing: '0.01em',
                                lineHeight: 1.2,
                                fontFamily: 'var(--font-sans)',
                              }}
                            >
                              {bullet.subText}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {bullet.amount && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                          <Typography
                            sx={{
                              fontSize: 'var(--fs-md)',
                              fontWeight: 750,
                              color: isCredit ? 'var(--credit)' : 'var(--text)',
                              fontVariantNumeric: 'tabular-nums',
                              letterSpacing: '-0.01em',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {bullet.amount}
                          </Typography>
                          <ChevronRight size={14} style={{ color: 'var(--text-3)', opacity: 0.55 }} />
                        </Box>
                      )}
                    </Box>
                  );
                }

                // Generic item fallback
                const matchedCatObj = db.settings?.categories?.find(
                  (c) => c.name.toLowerCase() === (bullet.category || bullet.label || '').toLowerCase()
                );
                const catMeta = resolveCategoryMeta(bullet.category || bullet.label || 'Expense', matchedCatObj);

                return (
                  <Box key={bIdx} sx={cardTileSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.35, minWidth: 0, flex: 1 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '9px',
                          bgcolor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {bullet.amount ? (
                          <CategoryIcon icon={catMeta.icon} color={catMeta.color} size={15} />
                        ) : (
                          <Sparkles size={14} color="var(--text-2)" opacity={0.8} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontSize: 'var(--fs-base)',
                            fontWeight: 650,
                            color: 'var(--text)',
                            lineHeight: 1.25,
                            letterSpacing: '-0.01em',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {bullet.label}
                        </Typography>
                        {bullet.subText && (
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{
                              fontSize: 'var(--fs-caption)',
                              color: 'var(--text-3)',
                              fontWeight: 500,
                              letterSpacing: '0.01em',
                              lineHeight: 1.2,
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {bullet.subText}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {bullet.amount && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 'var(--fs-md)',
                            fontWeight: 750,
                            color: 'var(--text)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.01em',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {bullet.amount}
                        </Typography>
                        <ChevronRight size={14} style={{ color: 'var(--text-3)', opacity: 0.55 }} />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>
        );
      })}
    </Box>
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
    const categoriesMap = new Map<string, Category>();
    (db.settings?.categories || []).forEach(c => categoriesMap.set(c.name, c));

    const frequent: Array<{
      icon: React.ReactNode;
      label: string;
      subText?: string;
      prompt: string;
      taskItem?: FrequentTaskItem;
      color: string;
      bg: string;
      border: string;
      isVendor?: boolean;
    }> = [];

    const others: Array<{
      icon: React.ReactNode;
      label: string;
      prompt: string;
    }> = [];

    const getIconForTask = (task: FrequentTaskItem, color: string) => {
      if (task.vendorId || task.vendorName || task.isVendor) return <Store size={15} style={{ color }} />;
      const lower = (task.description || '').toLowerCase();
      if (lower.includes('coffee') || lower.includes('tea') || lower.includes('chai') || lower.includes('cafe')) return <Coffee size={15} style={{ color }} />;
      if (lower.includes('food') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('meal') || lower.includes('snack') || lower.includes('tiffin') || lower.includes('burger') || lower.includes('poha')) return <Utensils size={15} style={{ color }} />;
      if (lower.includes('groc') || lower.includes('mart') || lower.includes('store') || lower.includes('shop')) return <ShoppingBag size={15} style={{ color }} />;
      if (lower.includes('salary') || lower.includes('income') || lower.includes('pay')) return <TrendingUp size={15} style={{ color }} />;
      if (lower.includes('bill') || lower.includes('util') || lower.includes('rent') || lower.includes('wifi')) return <CreditCard size={15} style={{ color }} />;
      if (lower.includes('auto') || lower.includes('uber') || lower.includes('cab') || lower.includes('fuel') || lower.includes('petrol')) return <Zap size={15} style={{ color }} />;
      return <CategoryIcon category={task.category} size={15} style={{ color }} />;
    };

    const frequentTasksList = getFrequentTasks(db);
    frequentTasksList.forEach(task => {
      // Find matching vendor contact if any
      const vendorContact = task.vendorId
        ? db.friends.find(f => f.id === task.vendorId)
        : (task.vendorName
            ? db.friends.find(f => f.name.toLowerCase() === task.vendorName?.toLowerCase() && f.type === 'vendor')
            : db.friends.find(f => f.type === 'vendor' && (
                f.name.toLowerCase() === task.description.toLowerCase() ||
                task.description.toLowerCase().startsWith(f.name.toLowerCase()) ||
                f.name.toLowerCase().includes(task.description.toLowerCase())
              )));

      const isVendor = Boolean(vendorContact || task.vendorId || task.vendorName || task.isVendor);

      let itemIcon: React.ReactNode;
      let itemColor: string;
      let itemBg: string;
      let itemBorder: string;

      if (isVendor) {
        // Sync color directly from Contact Page!
        // Contact page uses getAvatarStyle(vendor.color || '#f59e0b')
        const vendorColor = (vendorContact?.color && vendorContact.color !== '#6366f1')
          ? vendorContact.color
          : (task.vendorColor || '#f59e0b');
        const vStyle = getAppAvatarStyle(vendorColor);

        itemColor = vendorColor;
        itemBg = (vStyle.background as string) || `${vendorColor}24`;
        const rawBorder = (vStyle.border as string) || '';
        itemBorder = rawBorder.replace(/^1px solid\s*/, '') || `${vendorColor}55`;
        itemIcon = <Store size={15} style={{ color: vendorColor }} />;
      } else {
        // Category expense styling from App Settings / Categories!
        const catMeta = resolveCategoryMeta(task.category, undefined, false, categoriesMap);
        itemColor = catMeta.color;
        itemBg = catMeta.bg;
        itemBorder = catMeta.border;
        itemIcon = getIconForTask(task, catMeta.color);
      }

      frequent.push({
        icon: itemIcon,
        label: task.label,
        subText: task.subText,
        prompt: task.prompt,
        taskItem: task,
        color: itemColor,
        bg: itemBg,
        border: itemBorder,
        isVendor,
      });
    });

    // 2. Other actions (Insights, Balances, Debts, History)
    others.push({
      icon: <Banknote size={18} />,
      label: 'Account balances',
      prompt: 'What are my account balances?',
    });

    others.push({
      icon: <Users size={18} />,
      label: 'Who owes me',
      prompt: 'Who owes me money right now?',
    });

    others.push({
      icon: <Clock size={18} />,
      label: 'Monthly spend',
      prompt: 'How much did I spend this month?',
    });

    others.push({
      icon: <TrendingDown size={18} />,
      label: 'Recent expenses',
      prompt: 'Show my recent transactions',
    });

    return { frequentActions: frequent.slice(0, 6), otherActions: others.slice(0, 4) };
  }, [db]);


  // Header without any horizontal divider lines
  const headerContent = (
    <Box
      sx={{
        px: { xs: 2.5, sm: 3 },
        pt: isMobile ? 0.75 : 2,
        pb: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'var(--surface)',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        {/* Top left icon blends seamlessly with card bg (no box, no border) */}
        <Box
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={22} strokeWidth={2.2} color="currentColor" />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'nowrap' }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 750,
                fontSize: { xs: '15.5px', sm: '16.5px' },
                color: 'var(--text)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              Max Assistant
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {messages.length > 0 && (
          <Tooltip title="Restart chat & clear history">
            <IconButton
              size="small"
              onClick={handleRestartChat}
              aria-label="Restart chat"
              sx={{
                color: 'var(--text-2)',
                p: 0,
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-full)',
                bgcolor: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'grid',
                placeItems: 'center',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'var(--surface3)',
                  color: 'var(--text)',
                  borderColor: 'var(--border2)',
                },
                '&:active': {
                  transform: 'scale(0.92)',
                },
              }}
            >
              <RotateCcw size={16} />
            </IconButton>
          </Tooltip>
        )}

        {/* Rounded close button */}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Close assistant"
          sx={{
            color: 'var(--text-2)',
            p: 0,
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            bgcolor: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: 'var(--surface3)',
              color: 'var(--text)',
              borderColor: 'var(--border2)',
            },
            '&:active': {
              transform: 'scale(0.92)',
            },
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </IconButton>
      </Box>
    </Box>
  );

  // Main body without splitting lines
  const mainBodyContent = (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 0.5, sm: 0.75 },
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.25, sm: 2 },
        flex: 1,
        overflowY: 'auto',
        bgcolor: 'var(--surface)',
      }}
    >
      {/* Empty State: Minimal, Clean Actions */}
      {messages.length === 0 && !activeDraft && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 }, my: 'auto', py: { xs: 0.5, sm: 1 } }}>
          {/* Frequent Actions - Minimal Rounded Chips */}
          {frequentActions.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 'var(--fw-bold)',
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: 'var(--fs-caption)',
                  px: 0.25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Sparkles size={11} color="var(--text-3)" />
                Frequent Actions
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  width: '100%',
                }}
              >
                {frequentActions.map((item, idx) => (
                  <Box
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
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.85,
                      px: 1.5,
                      py: 0.75,
                      minHeight: '34px',
                      borderRadius: 'var(--radius-full)',
                      bgcolor: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        bgcolor: 'var(--surface3)',
                        borderColor: 'var(--border2)',
                        transform: 'translateY(-1px)',
                      },
                      '&:active': {
                        bgcolor: 'var(--surface3)',
                        borderColor: 'var(--border2)',
                        transform: 'scale(0.97)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        color: item.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography
                      sx={{
                        fontWeight: 'var(--fw-semibold)',
                        fontSize: 'var(--fs-sm)',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}
                    >
                      {item.taskItem?.description || item.label}
                    </Typography>

                    {/* Friend Badge with Trend Icon (No 'by') */}
                    {item.taskItem && ((item.taskItem.friendNames && item.taskItem.friendNames.length > 0) || item.taskItem.friendName) && (() => {
                      const names = item.taskItem.friendNames && item.taskItem.friendNames.length > 0
                        ? item.taskItem.friendNames
                        : (item.taskItem.friendName ? [item.taskItem.friendName] : []);
                      if (names.length === 0) return null;
                      const isByOther = item.taskItem.whoPaid === 'other' || item.taskItem.type === 'by_friend';

                      const matchedFriend = (item.taskItem.friendIds && item.taskItem.friendIds.length > 0)
                        ? db.friends.find(f => item.taskItem?.friendIds?.includes(f.id))
                        : db.friends.find(f => f.name.toLowerCase() === names[0].toLowerCase());

                      const friendColor = matchedFriend?.color || (isByOther ? '#10b981' : '#6366f1');
                      const friendStyle = getAppAvatarStyle(friendColor);

                      return (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.35,
                            px: 0.75,
                            py: 0.15,
                            borderRadius: 'var(--radius-full)',
                            fontSize: 'var(--fs-caption)',
                            fontWeight: 'var(--fw-semibold)',
                            flexShrink: 0,
                            background: friendStyle.background,
                            color: friendStyle.color,
                            border: friendStyle.border,
                            lineHeight: 1.2,
                          }}
                        >
                          {isByOther ? (
                            <TrendingDown size={11} style={{ strokeWidth: 2.5 }} />
                          ) : (
                            <TrendingUp size={11} style={{ strokeWidth: 2.5 }} />
                          )}
                          <span>{names.length === 1 ? names[0] : names.map(n => n.charAt(0).toUpperCase()).join('+')}</span>
                        </Box>
                      );
                    })()}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Quick Insights & Actions - Bigger & Theme Matched */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 'var(--fw-bold)',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontSize: 'var(--fs-caption)',
                px: 0.25,
              }}
            >
              Quick Insights & Actions
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: { xs: 1, sm: 1.25 },
                width: '100%',
              }}
            >
              {otherActions.map((item, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1, sm: 1.25 },
                    px: { xs: 1.35, sm: 1.6 },
                    py: { xs: 1.25, sm: 1.4 },
                    minHeight: { xs: '44px', sm: '48px' },
                    borderRadius: 'var(--radius-md, 12px)',
                    bgcolor: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    minWidth: 0,
                    overflow: 'hidden',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: 'var(--surface3)',
                      borderColor: 'var(--border2)',
                      color: 'var(--text)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': {
                      bgcolor: 'var(--surface3)',
                      borderColor: 'var(--border2)',
                      transform: 'scale(0.98)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      color: 'var(--text-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 'var(--fw-semibold)',
                      fontSize: { xs: '12px', sm: 'var(--fs-sm)' },
                      color: 'var(--text)',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {item.label}
                  </Typography>
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
                gap: 1.25,
                width: '100%',
              }}
            >
              {m.sender === 'bot' && (
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '11px',
                    bgcolor: 'var(--surface2)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <Sparkles size={16} strokeWidth={2.2} color="currentColor" />
                </Box>
              )}

              {m.sender === 'bot' ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: { xs: '92%', sm: '86%' }, width: '100%', minWidth: 0 }}>
                  <BotMessageBubble text={m.text} />
                  {m.timestamp && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--text-3)',
                        mt: 0.5,
                        ml: 1,
                        fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {m.timestamp}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    maxWidth: { xs: '85%', sm: '75%' },
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      px: { xs: 2, sm: 2.25 },
                      py: { xs: 1.25, sm: 1.5 },
                      borderRadius: '18px 18px 4px 18px',
                      bgcolor: 'var(--surface2)',
                      color: 'var(--text)',
                      whiteSpace: 'pre-line',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow)',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        lineHeight: 1.55,
                        fontSize: 'var(--fs-base)',
                        fontWeight: 550,
                        fontFamily: 'var(--font-sans)',
                        color: 'var(--text)',
                        letterSpacing: '-0.012em',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </Typography>
                  </Paper>
                  {m.timestamp && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--text-3)',
                        mt: 0.5,
                        mr: 1,
                        fontWeight: 500,
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {m.timestamp}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'var(--text-2)', p: 1, ml: 4 }}>
              <CircularProgress size={15} sx={{ color: 'var(--accent)' }} />
              <Typography variant="body2" sx={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-2)' }}>
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
            borderRadius: 'var(--radius-md)',
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
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
              Extracted Record Details
            </Typography>
            <Chip
              label={`${currSym} ${activeDraft.amount != null && !isNaN(activeDraft.amount) ? activeDraft.amount : 0}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: 'var(--fs-sm)',
                borderRadius: 'var(--radius-xs)',
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
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--text-3)', fontSize: 'var(--fs-caption)' }}>
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
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    borderRadius: '6px !important',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 'var(--fs-xs)',
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
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--text-3)', fontSize: 'var(--fs-caption)' }}>
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
                    sx={{ borderRadius: 'var(--radius-sm)', bgcolor: 'var(--surface)' }}
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
                borderRadius: 'var(--radius-sm)',
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
                      sx={{ borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-caption)' }}
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
                {categories.map((cat, idx) => (
                  <MenuItem key={`${cat}-${idx}`} value={cat}>
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
                {wallets.map((w, idx) => (
                  <MenuItem key={`${w.id}-${idx}`} value={w.name}>
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
              sx={{ borderRadius: 'var(--radius-sm)', textTransform: 'none', fontWeight: 600, px: 2, color: 'var(--text-3)' }}
            >
              Discard
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusCircle size={15} />}
              onClick={handleConfirmDraft}
              sx={{
                borderRadius: 'var(--radius-sm)',
                fontWeight: 650,
                px: 2.5,
                py: 0.7,
                fontSize: 'var(--fs-sm)',
                textTransform: 'none',
                bgcolor: activeDraft.flow === 'in' ? 'var(--credit)' : 'var(--accent)',
                color: activeDraft.flow === 'in' ? '#ffffff' : 'var(--accent-contrast)',
                boxShadow: 'var(--shadow)',
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
        pb: { xs: 1.75, sm: 2.5 },
        pt: 0.5,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--surface)',
      }}
    >
      {messages.length > 0 && frequentActions.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            overflowX: 'auto',
            pb: 1.25,
            mb: 0.5,
            width: '100%',
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {frequentActions.map((item, idx) => {
            const t = item.taskItem;
            const names = t ? (t.friendNames && t.friendNames.length > 0 ? t.friendNames : (t.friendName ? [t.friendName] : [])) : [];
            const friendBadgeStr = names.length === 1 ? names[0] : (names.length > 1 ? names.map(n => n.charAt(0).toUpperCase()).join('+') : '');
            const amtStr = t ? `${currSym}${t.amount}` : (item.subText ? item.subText.replace(/[()]/g, '') : '');
            const chipLabel = t
              ? `${t.description}${friendBadgeStr ? ` • ${friendBadgeStr}` : ''}${amtStr ? ` • ${amtStr}` : ''}`
              : `${item.label}${amtStr ? ` • ${amtStr}` : ''}`;

            return (
              <Chip
                key={idx}
                icon={<Box sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.5, color: item.color }}>{item.icon}</Box>}
                label={chipLabel}
                size="small"
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
                sx={{
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-semibold)',
                  height: '32px',
                  px: 1,
                  borderRadius: 'var(--radius-full)',
                  bgcolor: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    bgcolor: 'var(--surface3)',
                    borderColor: 'var(--border2)',
                  },
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Clean search bar - no accent color for border, hover, clicked or selected */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          width: '100%',
          px: 1.75,
          py: 0.65,
          minHeight: '48px',
          bgcolor: 'var(--surface2)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid',
          borderColor: isListening ? 'var(--debit)' : 'var(--border)',
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
          '&:hover': {
            borderColor: 'var(--border2)',
          },
          '&:focus-within': {
            borderColor: 'var(--border2)',
            bgcolor: 'var(--surface2)',
            boxShadow: 'none',
          },
        }}
      >
        <AudioWaveVisualizer volume={volumeLevel} isListening={isListening} />

        <InputBase
          inputRef={textInputRef}
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
            fontSize: 'var(--fs-base)',
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
            aria-label={isListening ? 'Stop mic' : 'Speak to Max'}
            sx={{
              color: isListening ? 'var(--debit)' : 'var(--text-2)',
              p: 0,
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-full)',
              transition: 'all 0.15s ease',
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
          aria-label="Send prompt"
          sx={{
            color: inputText.trim() ? 'var(--accent-contrast)' : 'var(--text-3)',
            p: 0,
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-full)',
            bgcolor: inputText.trim() ? 'var(--accent)' : 'transparent',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              color: inputText.trim() ? 'var(--accent-contrast)' : 'var(--text)',
              bgcolor: inputText.trim() ? 'var(--accent-dark)' : 'var(--surface3)',
            },
            '&.Mui-disabled': {
              color: 'var(--text-3)',
              opacity: 0.35,
              bgcolor: 'transparent',
            },
          }}
        >
          <ArrowUp size={18} />
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
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            height: messages.length > 0 || activeDraft ? '84vh' : 'auto',
            maxHeight: '92vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'var(--surface)',
            color: 'var(--text)',
            border: 'none',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.4)',
            transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px) !important` : undefined,
            transition: dragOffsetY > 0 ? 'none !important' : 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
              bgcolor: 'var(--border2)',
              borderRadius: 'var(--radius-full)',
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
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          maxWidth: '520px',
          width: '100%',
          height: messages.length > 0 || activeDraft ? '720px' : 'auto',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: '1px solid var(--border)',
          bgcolor: 'var(--surface)',
          color: 'var(--text)',
          m: 2,
          transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }}
    >
      <Box
        sx={{
          pt: 1.5,
          pb: 0.5,
          px: 2,
          bgcolor: 'var(--surface)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 4,
            bgcolor: 'var(--border2)',
            borderRadius: 'var(--radius-full)',
          }}
        />
      </Box>
      {headerContent}
      {mainBodyContent}
      {footerActions}
    </Dialog>
  );
}
