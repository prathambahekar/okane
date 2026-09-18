import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Okane ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('okane_sql_database_dump_v1');
      localStorage.removeItem('ledger_app_db_v2');
      localStorage.removeItem('okane_active_trip_v1');
      localStorage.removeItem('okane_trip_history_v1');
      localStorage.removeItem('okane_preset_groups_v1');
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: "var(--font-sans)",
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-floating)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--debit-bg)',
                color: 'var(--debit)',
                border: '1px solid var(--debit-border)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-4)',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h1
              style={{
                fontSize: 'var(--fs-xl)',
                fontWeight: 'var(--fw-bold)',
                marginBottom: 'var(--space-2)',
                color: 'var(--text)',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: 'var(--fs-base)',
                color: 'var(--text-2)',
                lineHeight: 1.5,
                marginBottom: 'var(--space-5)',
              }}
            >
              Okane encountered an unexpected issue while rendering. You can try refreshing the app or resetting the local cache if data is corrupted.
            </p>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-3)',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--debit)',
                  fontFamily: 'monospace',
                  textAlign: 'left',
                  overflowX: 'auto',
                  marginBottom: 'var(--space-6)',
                  maxHeight: '120px',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                  border: 'none',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 'var(--fw-semibold)',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                <RotateCcw size={16} />
                <span>Reload App</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 'var(--fw-medium)',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={16} />
                <span>Reset Local Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
