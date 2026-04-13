import React, { useState } from 'react';
import supabase from '../../supabaseClient';
import './popup.css';

export default function AddDevice({ onClose }) {
  const [formData, setFormData] = useState({
    uid: '',
    name: '',
  });

  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const key in formData) {
      if (!formData[key].trim()) {
        setError(`Please complete the ${key} field`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.from('DroneList').insert([{
        uid: formData.uid,
        name: formData.name,
        type: formData.type,
      }]);

      if (error) {
        console.error(error);
        throw new Error('Failed to save the drone.');
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Error while saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="popupOverlay" onClick={onClose}>
      <div className="popupContent" onClick={e => e.stopPropagation()}>
        <div className="principalBox">
          <button onClick={onClose} className="CloseButton">✖</button>
          <h1>Add Drone</h1>

          {error && <p style={{ color: 'red' }}>{error}</p>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="uid">UID</label>
            <input
              type="text"
              id="uid"
              name="uid"
              value={formData.uid}
              onChange={handleChange}
              disabled={saving}
              placeholder="Enter UID"
            />

            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={saving}
              placeholder="Enter name"
            />

            <input
              type="submit"
              value={saving ? "Saving..." : "Save"}
              disabled={saving}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
