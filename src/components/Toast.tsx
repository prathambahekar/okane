import { useStore } from '../store';
import CloseIcon from '@mui/icons-material/Close';

export default function Toast() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <span style={{ flex: 1 }}>{t.message}</span>
          {t.onUndo && (
            <button className="toast-undo" onClick={() => { t.onUndo?.(); dismissToast(t.id); }}>
              Undo
            </button>
          )}
          <button className="toast-close" onClick={() => dismissToast(t.id)}>
            <CloseIcon fontSize="inherit" />
          </button>
        </div>
      ))}
    </div>
  );
}
