import { useState } from 'react';
import { Store, X } from 'lucide-react';
import type { Friend } from '../../types';

interface VendorQuickAddProps {
  vendorId: string;
  setVendorId: (id: string) => void;
  vendorsList: Friend[];
  addFriend: (friend: { name: string; type: 'friend' | 'vendor' }) => { id: string; name: string };
  showToast: (msg: string) => void;
}

export function VendorQuickAdd({
  vendorId,
  setVendorId,
  vendorsList,
  addFriend,
  showToast,
}: VendorQuickAddProps) {
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');

  const handleCreateVendor = () => {
    if (newVendorName.trim()) {
      const created = addFriend({ name: newVendorName.trim(), type: 'vendor' });
      setVendorId(created.id);
      showToast(`Added vendor ${created.name}`);
      setNewVendorName('');
      setIsAddingVendor(false);
    }
  };

  return (
    <div className="form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label className="form-label" style={{ margin: 0, fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Store size={12} style={{ color: 'var(--text-3)' }} /> Vendor (Optional)
        </label>
        {!isAddingVendor && (
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 10.5,
              fontWeight: 600,
              color: 'var(--accent)',
              cursor: 'pointer',
              padding: 0,
            }}
            onClick={() => setIsAddingVendor(true)}
          >
            + Add
          </button>
        )}
      </div>

      {isAddingVendor ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', animation: 'fadein 0.15s ease' }}>
          <input
            className="form-input"
            style={{ fontSize: 11.5, height: 34, flex: 1, padding: '0 8px' }}
            placeholder="Store name..."
            value={newVendorName}
            onChange={e => setNewVendorName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateVendor();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ height: 34, padding: '0 8px', fontSize: 10.5 }}
            onClick={handleCreateVendor}
          >
            Add
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ height: 34, padding: '0 6px', fontSize: 10.5 }}
            onClick={() => {
              setIsAddingVendor(false);
              setNewVendorName('');
            }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <select
          className="form-select"
          value={vendorId}
          onChange={e => {
            if (e.target.value === '__add_new__') {
              setIsAddingVendor(true);
            } else {
              setVendorId(e.target.value);
            }
          }}
        >
          <option value="">— None —</option>
          {vendorsList.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
          <option value="__add_new__">+ Add Store...</option>
        </select>
      )}
    </div>
  );
}
