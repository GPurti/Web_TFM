import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './popup.css';

export default function PopupUser({ onClose, user, onUserUpdate }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.full_name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveOnClose = async () => {
    if (!user) return;
    if (displayName === user.user_metadata?.full_name && email === user.email) {
      onClose();
      return;
    }

    setLoading(true);

    const updateData = { data: { full_name: displayName } };
    if (email !== user.email) updateData.email = email;

    const { error } = await supabase.auth.updateUser(updateData);

    if (error) {
      console.error('Error updating user:', error.message);
    } else {
      onUserUpdate && onUserUpdate();
    }

    setLoading(false);
    onClose();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  return (
    <div className="popupOverlay">
      <div className="popupContent">
        <div className="principalBox">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSaveOnClose();
            }}
            className="CloseButton"
          >
            ✖
          </button>
          <h1>User Profile</h1>
          <label htmlFor="displayName">Name</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={handleLogout} class="btn">
            
            <div className="sign">
              <span className="material-symbols-outlined sign">
                logout
                </span>
              </div>
            
            <div class="text">Logout</div>
          </button>

        </div>
      </div>
    </div>
  );
}
