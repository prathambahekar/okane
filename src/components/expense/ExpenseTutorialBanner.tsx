import React from 'react';
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ExpenseTutorialBannerProps {
  tutorialStep: number;
  setTutorialStep: React.Dispatch<React.SetStateAction<number>>;
  flow: 'in' | 'out';
  splitMode: 'just_me' | 'for_friend' | 'pay_debt';
  amount: string;
  selectedFriendIds: string[];
  onFillSampleData: () => void;
}

export function ExpenseTutorialBanner({
  tutorialStep,
  setTutorialStep,
  flow,
  splitMode,
  amount,
  selectedFriendIds,
  onFillSampleData,
}: ExpenseTutorialBannerProps) {
  return (
    <div
      style={{
        margin: '0 16px 14px',
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(235, 94, 40, 0.12), rgba(235, 94, 40, 0.04))',
        border: '1px solid rgba(235, 94, 40, 0.35)',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>
            Interactive Guide ({tutorialStep}/4)
          </span>
        </div>
        <button
          type="button"
          onClick={onFillSampleData}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'var(--surface)',
            border: '1px solid rgba(235, 94, 40, 0.3)',
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          Auto-fill Sample
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
        {tutorialStep === 1 && (
          <span>
            <strong>Step 1: Choose Flow.</strong> Select <em>Expense</em> to track spending, or <em>Income</em> to record incoming money or friend paybacks.
          </span>
        )}
        {tutorialStep === 2 && (
          <span>
            <strong>Step 2: Enter Amount.</strong> Type the total bill or transaction amount in the big input above.
          </span>
        )}
        {tutorialStep === 3 && (
          <span>
            <strong>Step 3: Split Rule.</strong> Choose <em>Just Me</em> for personal expenses or <em>With Friends</em> to split equally/custom among group members.
          </span>
        )}
        {tutorialStep === 4 && (
          <span>
            <strong>Step 4: Save!</strong> Choose category, wallet, and click <em>Save Expense</em> below to record it.
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4].map(st => (
            <div
              key={st}
              style={{
                width: 18,
                height: 4,
                borderRadius: 2,
                background: st <= tutorialStep ? 'var(--accent)' : 'var(--border2)',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {tutorialStep > 1 && (
            <button
              type="button"
              onClick={() => setTutorialStep(prev => Math.max(1, prev - 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={11} /> Back
            </button>
          )}
          {tutorialStep < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (tutorialStep === 1 && flow === 'out') setTutorialStep(2);
                else if (tutorialStep === 2 && amount) setTutorialStep(3);
                else if (tutorialStep === 3 && (splitMode === 'just_me' || selectedFriendIds.length > 0)) setTutorialStep(4);
                else setTutorialStep(prev => Math.min(4, prev + 1));
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Next <ArrowRight size={11} />
            </button>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--credit)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <CheckCircle2 size={12} /> Ready to submit
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
