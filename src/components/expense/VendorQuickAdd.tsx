import { useState } from 'react';
import { Store } from 'lucide-react';
import type { Friend } from '../../types';
import FriendModal from '../FriendModal';

interface VendorQuickAddProps {
  vendorId: string;
  setVendorId: (id: string) => void;
  vendorsList: Friend[];
  addFriend?: (friend: Partial<Friend>) => Friend;
  showToast?: (msg: string) => void;
}

export function VendorQuickAdd({
  vendorId,
  setVendorId,
  vendorsList,
}: VendorQuickAddProps) {
  const [showVendorModal, setShowVendorModal] = useState(false);

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22, height: 22, marginBottom: 2 }}>
        <label
          className="form-label"
          style={{
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}
        >
          <Store size={12} style={{ color: 'var(--text-3)' }} />
          <span>Vendor</span>
          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 500, opacity: 0.7, letterSpacing: '0.2px', textTransform: 'lowercase' }}>
            (optional)
          </span>
        </label>
      </div>

      <select
        className="form-select"
        value={vendorId}
        onChange={e => {
          if (e.target.value === '__add_new__') {
            setShowVendorModal(true);
          } else {
            setVendorId(e.target.value);
          }
        }}
      >
        <option value="">None</option>
        {vendorsList.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
        <option value="__add_new__">+ Add Store...</option>
      </select>

      {showVendorModal && (
        <FriendModal
          defaultType="vendor"
          onClose={() => setShowVendorModal(false)}
          onSuccess={(created) => {
            if (created?.id) {
              setVendorId(created.id);
            }
          }}
        />
      )}
    </div>
  );
}
