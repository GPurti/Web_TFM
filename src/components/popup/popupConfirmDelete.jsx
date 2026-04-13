import { useState } from 'react';
import supabase from '../../supabaseClient';
import './popup.css';

export default function DeleteConfirmPopup({ itemId, onClose, onDeleted, table }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!itemId || !table) return;
    setLoading(true);

    try {
      if (table === 'missions') {
        const { error } = await supabase
          .from('missions')
          .update({ seePublic: false })
          .eq('id', itemId);

        if (error) {
          console.error('Error hiding mission:', error.message);
        }
      } else if (table === 'DroneList') {
        const { error } = await supabase
          .from('DroneList')
          .delete()
          .eq('id', itemId);

        if (error) {
          console.error('Error deleting drone:', error.message);
        }
      }

      onDeleted();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="popupOverlay" onClick={onClose}>
      <div className="popupContent" onClick={(e) => e.stopPropagation()}>
        <div className="principalBox">
          <button onClick={onClose} className="CloseButton">×</button>
          <h1>Are you sure you want to delete?</h1>
          <p>This action cannot be undone.</p>

          <input
            type="submit"
            value={loading ? "Deleting..." : "Delete"}
            onClick={handleDelete}
            disabled={loading}
            style={{
              background: 'red',
              color: 'white',
              marginBottom: '10px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          />
        </div>
      </div>
    </div>
  );
}
