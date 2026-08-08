import React, { useState, forwardRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputBase,
  Paper,
  Slide,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import {
  X,
  BookOpen,
  HelpCircle,
  ReceiptText,
  Users,
  Handshake,
  Wallet,
  RefreshCw,
  Sparkles,
  Search,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Zap,
  Info,
} from 'lucide-react';
import type { ViewName } from '../types';

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface UserGuideModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (view: ViewName) => void;
  onAddExpense?: () => void;
  onStartExpenseTutorial?: () => void;
}

export default function UserGuideModal({
  open,
  onClose,
  onNavigate,
  onAddExpense,
  onStartExpenseTutorial,
}: UserGuideModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleAction = (action: 'addExpense' | 'view' | 'tutorial', view?: ViewName) => {
    onClose();
    if (action === 'tutorial' && onStartExpenseTutorial) {
      onStartExpenseTutorial();
    } else if (action === 'addExpense' && onAddExpense) {
      onAddExpense();
    } else if (action === 'view' && view && onNavigate) {
      onNavigate(view);
    }
  };

  const faqItems = [
    {
      q: 'What is the difference between "Paid for Friend" and "Paid by Friend"?',
      a: '• "Paid for Friend": YOU paid money out of your wallet for someone else. They owe you money (increases what they owe you).\n• "Paid by Friend": A FRIEND paid for something for you. You owe them money (increases your debt to them).',
      category: 'Expenses & Debts',
    },
    {
      q: 'How do I settle debts with a friend?',
      a: 'Go to the "Settlements" or "Contacts" tab, select the friend, and click "Settle Up". You can choose to settle all pending items at once or record a partial payment using cash or any wallet.',
      category: 'Settlements',
    },
    {
      q: 'How do Wallets work in Okane?',
      a: 'Wallets represent your real-world money accounts (e.g., Cash, Bank, Credit Card, Paytm). When you log an expense, the money is automatically deducted from your chosen wallet. You can also transfer money between wallets under the Wallets tab.',
      category: 'Wallets',
    },
    {
      q: 'Will transferring money between wallets change my total spending?',
      a: 'No! Wallet transfers move funds internally from one account to another (e.g., ATM Cash withdrawal from Bank). It does not count as spending or income.',
      category: 'Wallets',
    },
    {
      q: 'What are Autopays & Subscriptions?',
      a: 'Autopay keeps track of recurring bills like Netflix, Rent, Broadband, or SIPs. Okane alerts you when a bill is due and lets you record it in one click.',
      category: 'Autopay',
    },
    {
      q: 'How does the Smart AI Assistant work?',
      a: 'Click the AI icon or open Assistant in Okane and type natural sentences like "Paid $30 for lunch with Rahul" or "Borrowed 500 from Priya for groceries". The AI automatically understands categories, friends, and amounts!',
      category: 'AI Assistant',
    },
    {
      q: 'How do I track split expenses with multiple people?',
      a: 'When creating an expense, pick "Split Expense" mode. You can split equally among contacts or enter custom amounts for each person.',
      category: 'Expenses & Debts',
    },
  ];

  const filteredFaqs = searchQuery.trim()
    ? faqItems.filter(
        f =>
          f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqItems;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      TransitionComponent={isMobile ? Transition : undefined}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? '24px 24px 0 0' : '18px',
          m: isMobile ? 0 : 2,
          position: isMobile ? 'fixed' : 'relative',
          bottom: isMobile ? 0 : 'auto',
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 'auto',
          width: '100%',
          maxHeight: isMobile ? '88vh' : '90vh',
          bgcolor: 'var(--surface)',
          color: 'var(--text-1)',
          backgroundImage: 'none',
          boxShadow: isMobile ? '0 -10px 40px rgba(0,0,0,0.35)' : '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Mobile Drag Handle Indicator */}
      {isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.2, pb: 0.2, bgcolor: 'var(--surface2)' }}>
          <Box sx={{ width: 38, height: 4, borderRadius: 2, bgcolor: 'var(--border2)' }} />
        </Box>
      )}

      {/* Modal Header */}
      <DialogTitle
        sx={{
          m: 0,
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          bgcolor: 'var(--surface2)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '12px',
              bgcolor: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={20} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
              Okane User Guide & Help
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-2)', fontSize: '0.78rem' }}>
              Learn how to track expenses, manage debts, and settle up easily
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'var(--text-2)',
            borderRadius: '10px',
            p: 0.8,
            '&:hover': { bgcolor: 'var(--surface3)', color: 'var(--text-1)' },
          }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid var(--border)', bgcolor: 'var(--surface)' }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: 'var(--text-2)',
              py: 1,
              px: 2,
              '&.Mui-selected': {
                color: 'var(--accent)',
              },
            },
            '& .MuiTabs-indicator': {
              bgcolor: 'var(--accent)',
              height: 3,
              borderRadius: '3px 3px 0 0',
            },
          }}
        >
          <Tab icon={<Lightbulb size={16} />} iconPosition="start" label="Overview" />
          <Tab icon={<ReceiptText size={16} />} iconPosition="start" label="Expense Types" />
          <Tab icon={<Handshake size={16} />} iconPosition="start" label="Settle Up & Debts" />
          <Tab icon={<Wallet size={16} />} iconPosition="start" label="Wallets & Autopay" />
          <Tab icon={<Sparkles size={16} />} iconPosition="start" label="AI Assistant" />
          <Tab icon={<HelpCircle size={16} />} iconPosition="start" label="FAQs & Help" />
        </Tabs>
      </Box>

      {/* Modal Content */}
      <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto' }}>
        {/* TAB 0: OVERVIEW */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box
              sx={{
                p: 2.5,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, var(--accent-soft) 0%, rgba(59, 130, 246, 0.08) 100%)',
                border: '1px solid var(--accent-soft)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  p: 1.2,
                  borderRadius: '12px',
                  bgcolor: 'var(--surface)',
                  color: 'var(--accent)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              >
                <Zap size={24} />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: 'var(--text-1)' }}>
                  Welcome to Okane! 🌸
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Okane is designed to make personal finance & shared group expenses completely effortless. Whether you are tracking daily coffee runs, splitting restaurant bills, or settling monthly rent with friends — Okane keeps everything clear and balanced.
                </Typography>
              </Box>
            </Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '0.95rem' }}>
              Core Features at a Glance:
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'var(--accent)' }}>
                  <ReceiptText size={18} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    1. Log Expenses Easily
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  Track personal spending, vendor payments, or expenses paid for/by friends with flexible wallet selection.
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'var(--credit)' }}>
                  <Users size={18} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    2. Clear Friend Balances
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  See exactly who owes you money and whom you owe, down to the exact rupee or dollar without awkward math.
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'var(--info)' }}>
                  <Handshake size={18} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    3. One-Click Settle Up
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  Settle up pending debts in full or partially. Payment updates wallet balances and friend ledgers instantly.
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: '#ec4899' }}>
                  <Sparkles size={18} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    4. Smart AI Assistant
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  Simply speak or type natural phrases like "Dinner with Rahul $40" and let AI auto-fill your log!
                </Typography>
              </Paper>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => handleAction('tutorial')}
                startIcon={<Sparkles size={16} />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: 'var(--accent)',
                  color: '#fff',
                  boxShadow: '0 4px 14px var(--accent-soft)',
                  '&:hover': { bgcolor: 'var(--accent)', filter: 'brightness(0.95)' },
                }}
              >
                Start Interactive Expense Tutorial ✨
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleAction('addExpense')}
                startIcon={<ReceiptText size={16} />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: 'var(--border)',
                  color: 'var(--text-1)',
                  '&:hover': { borderColor: 'var(--border2)', bgcolor: 'var(--surface2)' },
                }}
              >
                Add Real Expense
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleAction('view', 'friends')}
                endIcon={<ArrowRight size={16} />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: 'var(--border)',
                  color: 'var(--text-1)',
                  '&:hover': { borderColor: 'var(--border2)', bgcolor: 'var(--surface2)' },
                }}
              >
                View Contacts
              </Button>
            </Box>
          </Box>
        )}

        {/* TAB 1: EXPENSE TYPES */}
        {activeTab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'var(--text-2)' }}>
              Understanding the 4 expense modes in Okane prevents confusion about who paid and who owes what:
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Type 1: Personal */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label="Personal" size="small" sx={{ fontWeight: 700, bgcolor: 'var(--surface3)', color: 'var(--text-1)' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      My Own Personal Expense
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.85rem', mb: 1 }}>
                  <strong>Who paid:</strong> You paid out of your wallet.<br />
                  <strong>Impact:</strong> Reduces your wallet balance. No friends involved.
                </Typography>
                <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'var(--surface)', fontSize: '0.78rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>
                  Example: Coffee for $4 paid via Google Pay cash wallet.
                </Box>
              </Paper>

              {/* Type 2: Paid for Friend */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                  borderLeft: '4px solid var(--credit)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip label="For Friend" size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(74, 222, 128, 0.15)', color: 'var(--credit)' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    I Paid for a Friend (They owe me)
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.85rem', mb: 1 }}>
                  <strong>Who paid:</strong> You paid the bill for a friend.<br />
                  <strong>Impact:</strong> Reduces your wallet balance, but increases <em>Friend's Debt to You</em> (Credit badge).
                </Typography>
                <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'var(--surface)', fontSize: '0.78rem', color: 'var(--credit)', fontFamily: 'monospace' }}>
                  Example: You paid $50 for Rahul's concert ticket. Rahul now owes you $50.
                </Box>
              </Paper>

              {/* Type 3: Paid by Friend */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                  borderLeft: '4px solid var(--debit)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip label="By Friend" size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(248, 113, 113, 0.15)', color: 'var(--debit)' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Paid by Friend for Me (I owe them)
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.85rem', mb: 1 }}>
                  <strong>Who paid:</strong> A friend paid a bill on your behalf.<br />
                  <strong>Impact:</strong> No cash leaves your wallet right now, but increases <em>Your Debt to Friend</em> (Debit badge).
                </Typography>
                <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'var(--surface)', fontSize: '0.78rem', color: 'var(--debit)', fontFamily: 'monospace' }}>
                  Example: Priya paid $30 for your cab fare. You now owe Priya $30.
                </Box>
              </Paper>

              {/* Type 4: Split Bill */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  bgcolor: 'var(--surface2)',
                  borderLeft: '4px solid var(--info)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip label="Split Bill" size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(56, 189, 248, 0.15)', color: 'var(--info)' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Shared / Group Bill Split
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.85rem', mb: 1 }}>
                  <strong>Who paid:</strong> You (or a friend) paid a total bill shared among 2+ people.<br />
                  <strong>Impact:</strong> Automatically splits total amount equally or with custom percentages/amounts into individual friend debts.
                </Typography>
                <Box sx={{ p: 1, borderRadius: '8px', bgcolor: 'var(--surface)', fontSize: '0.78rem', color: 'var(--info)', fontFamily: 'monospace' }}>
                  Example: $100 dinner bill paid by you. You split 50/50 with Amit. Your personal share is $50, and Amit owes you $50.
                </Box>
              </Paper>
            </Box>

            <Button
              variant="contained"
              onClick={() => handleAction('tutorial')}
              startIcon={<Sparkles size={16} />}
              sx={{
                mt: 1,
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: 'var(--accent)',
                color: '#fff',
                py: 1.2,
                '&:hover': { bgcolor: 'var(--accent)', filter: 'brightness(0.95)' },
              }}
            >
              Try Interactive Expense & Debt Tutorial ✨
            </Button>
          </Box>
        )}

        {/* TAB 2: SETTLE UP & DEBTS */}
        {activeTab === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '14px',
                bgcolor: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, color: 'var(--accent)' }}>
                <Handshake size={22} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  How Debt Settlement Works
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'var(--text-2)', lineHeight: 1.6, mb: 2 }}>
                Whenever you or a friend pay back money, use the <strong>"Settle Up"</strong> button in Settlements or Contact details instead of adding a new random expense. This ensures your friend ledger is cleanly cleared!
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--credit)', marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Full Settlement:
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block' }}>
                      Marks all selected pending expenses as "Settled" in one tap and updates your chosen Wallet.
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Partial Payment:
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block' }}>
                      If a friend pays back ₹500 out of ₹1,500 owed, record a custom partial settlement. It reduces the net balance directly without erasing history!
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Undo & History:
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block' }}>
                      Made a mistake? Every settlement is saved in Settlement History with a single-click "Undo" button to restore unsettled states effortlessly.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                variant="contained"
                onClick={() => handleAction('view', 'settlements')}
                startIcon={<Handshake size={16} />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  bgcolor: 'var(--accent)',
                }}
              >
                Go to Settlements Tab
              </Button>
            </Box>
          </Box>
        )}

        {/* TAB 3: WALLETS & AUTOPAY */}
        {activeTab === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  bgcolor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'var(--accent)' }}>
                  <Wallet size={20} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Wallets & Transfers
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.84rem', lineHeight: 1.5, mb: 1.5 }}>
                  Keep separate accounts for Cash, HDFC Bank, Credit Card, or UPI Wallets.
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block', mb: 1 }}>
                  💡 <strong>Internal Transfer:</strong> Moving ₹2,000 from Bank to Cash Wallet updates both balances instantly without affecting your monthly expense metrics!
                </Typography>
                <Button
                  size="small"
                  onClick={() => handleAction('view', 'wallets')}
                  sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--accent)', p: 0 }}
                >
                  Manage Wallets →
                </Button>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  bgcolor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: '#ef5350' }}>
                  <RefreshCw size={20} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Autopay & Recurring Bills
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.84rem', lineHeight: 1.5, mb: 1.5 }}>
                  Set up monthly rent, Wi-Fi bills, Spotify, or gym subscriptions once.
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-2)', display: 'block', mb: 1 }}>
                  🔔 <strong>Smart Reminders:</strong> Okane badges upcoming due dates in red so you never miss a bill or get hit with late fees.
                </Typography>
                <Button
                  size="small"
                  onClick={() => handleAction('view', 'recurring')}
                  sx={{ textTransform: 'none', fontWeight: 600, color: '#ef5350', p: 0 }}
                >
                  View Autopays →
                </Button>
              </Paper>
            </Box>
          </Box>
        )}

        {/* TAB 4: AI ASSISTANT */}
        {activeTab === 4 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, color: '#a855f7' }}>
                <Sparkles size={22} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Okane Smart AI Assistant
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'var(--text-2)', lineHeight: 1.6, mb: 2 }}>
                Skip manual form filling! Open the AI Assistant from the bottom floating bar or AI modal and type or speak naturally:
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Paper sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--accent)' }}>
                    💬 "Paid 450 for Tiffin with Aunty yesterday"
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-2)' }}>
                    → Automatically logs $450 under Food/Tiffin category linked to contact Tiffin Aunty!
                  </Typography>
                </Paper>

                <Paper sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--accent)' }}>
                    💬 "Split 1200 restaurant bill equally with Hrishikesh and Parth"
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-2)' }}>
                    → Creates a 3-way equal split ($400 each) and assigns friend debts instantly!
                  </Typography>
                </Paper>
              </Box>
            </Paper>
          </Box>
        )}

        {/* TAB 5: FAQs & SEARCH */}
        {activeTab === 5 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: '12px',
                border: '1px solid var(--border)',
                bgcolor: 'var(--surface2)',
              }}
            >
              <Search size={18} style={{ color: 'var(--text-3)' }} />
              <InputBase
                placeholder="Search help topics (e.g. debt, settle, wallet, split)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                sx={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-1)' }}
              />
              {searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </IconButton>
              )}
            </Paper>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredFaqs.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'var(--text-2)', textAlign: 'center', py: 3 }}>
                  No matching help topics found for "{searchQuery}". Try searching for "wallet", "settle", or "split".
                </Typography>
              ) : (
                filteredFaqs.map((faq, index) => (
                  <Accordion
                    key={index}
                    elevation={0}
                    sx={{
                      bgcolor: 'var(--surface2)',
                      color: 'var(--text-1)',
                      borderRadius: '12px !important',
                      border: '1px solid var(--border)',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<Info size={16} style={{ color: 'var(--text-3)' }} />}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        {faq.q}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0, pb: 2, px: 2 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-2)', fontSize: '0.83rem', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                        {faq.a}
                      </Typography>
                      <Chip label={faq.category} size="small" sx={{ mt: 1.5, height: 20, fontSize: '0.7rem', bgcolor: 'var(--surface3)' }} />
                    </AccordionDetails>
                  </Accordion>
                ))
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* Modal Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid var(--border)',
          bgcolor: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" sx={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HelpCircle size={14} /> Need more help? Tap AI Assistant anytime.
        </Typography>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: 'var(--accent)',
            px: 3,
          }}
        >
          Got it!
        </Button>
      </Box>
    </Dialog>
  );
}
