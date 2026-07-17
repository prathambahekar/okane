import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '../store';
import type { Friend } from '../types';
import { FRIEND_PALETTE } from '../db';

interface Props {
  friend?: Friend | null;
  onClose: () => void;
}

export default function FriendModal({ friend, onClose }: Props) {
  const { db, addFriend, updateFriend, showToast } = useStore();
  const [name, setName] = useState(friend?.name ?? '');
  const [email, setEmail] = useState(friend?.email ?? '');
  const [phone, setPhone] = useState(friend?.phone ?? '');
  const [notes, setNotes] = useState(friend?.notes ?? '');
  const [color, setColor] = useState(friend?.color ?? FRIEND_PALETTE[db.friends.length % FRIEND_PALETTE.length]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    if (friend) {
      updateFriend(friend.id, { name: name.trim(), email, phone, notes, color });
      showToast('Friend updated');
    } else {
      addFriend({ name: name.trim(), email, phone, notes, color });
      showToast('Friend added');
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{friend ? 'Edit Friend' : 'Add Friend'}</span>
          <button className="btn-icon" onClick={onClose}><CloseIcon fontSize="small" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Friend's name" autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 0000" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="color-swatch-grid">
                  {FRIEND_PALETTE.map(c => (
                    <button key={c} type="button"
                      className={`color-swatch ${color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
              {error && <p className="form-error">{error}</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">{friend ? 'Save Changes' : 'Add Friend'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
