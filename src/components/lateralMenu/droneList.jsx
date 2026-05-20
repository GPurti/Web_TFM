import { useEffect, useState } from 'react';
import supabase from '../../supabaseClient';
import AddDroneModal from '../popup/popupAddDevice';
import EditDroneModal from '../popup/popupEditDevice';
import DeleteConfirmPopup from '../popup/popupConfirmDelete';
import './droneList.css';

export default function DroneList() {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrone, setEditingDrone] = useState(null);
  const [deletingDroneId, setDeletingDroneId] = useState(null);

  const fetchDrones = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('DroneList').select('*');
    if (error) {
      setError(error);
    } else {
      setDrones(data || []);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDrones(); }, []);

  const handleAddDrone = async ({ name }) => {
    const { error } = await supabase.from('DroneList').insert([{ name }]);
    if (!error) { await fetchDrones(); setShowAddModal(false); }
  };

  const handleUpdateDrone = async ({ id, uid, name, color, SpeechBubbleDroneIcone }) => {
    const { error } = await supabase
      .from('DroneList')
      .update({ uid, name, color, SpeechBubbleDroneIcone })
      .eq('id', id);
    if (!error) { await fetchDrones(); setEditingDrone(null); }
    else console.error('Error updating drone:', error.message);
  };

  const toggleDroneVisibility = async (drone) => {
    const { error } = await supabase
      .from('DroneList').update({ show: !drone.show }).eq('id', drone.id);
    if (!error)
      setDrones(prev => prev.map(d => d.id === drone.id ? { ...d, show: !drone.show } : d));
  };

  const toggleWaterStatus = async (drone) => {
    const { error } = await supabase
      .from('DroneList').update({ water: !drone.water }).eq('id', drone.id);
    if (!error)
      setDrones(prev => prev.map(d => d.id === drone.id ? { ...d, water: !drone.water } : d));
  };

  return (
    <div className="droneContainer">

      {/* ── Barra de acciones ── */}
      <div className="droneActionBar">
        <button className="droneAddBtn" onClick={() => setShowAddModal(true)}>
          <span className="material-symbols-outlined">add</span>
          New drone
        </button>
        <button className="droneRefreshBtn" onClick={fetchDrones} title="Refresh">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      {/* ── Lista ── */}
      {error && <p className="droneError">Error: {error.message}</p>}

      <div className="droneScrollArea">
        {loading && drones.length === 0 ? (
          <p className="droneLoading">Loading…</p>
        ) : drones.length === 0 ? (
          <p className="droneEmpty">No drones added yet</p>
        ) : (
          <ul className="droneList">
            {drones.map((drone) => (
              <li key={drone.id} className="droneItem">
                <span className="droneName" title={drone.name}>{drone.name}</span>
                <div className="droneActions">
                  <span
                    className="material-symbols-outlined"
                    title="Water status"
                    onClick={() => toggleWaterStatus(drone)}
                  >
                    {drone.water ? 'humidity_low' : 'invert_colors_off'}
                  </span>
                  <span
                    className="material-symbols-outlined"
                    title={drone.show ? 'Hide on map' : 'Show on map'}
                    onClick={() => toggleDroneVisibility(drone)}
                  >
                    {drone.show ? 'visibility' : 'visibility_off'}
                  </span>
                  <span
                    className="material-symbols-outlined"
                    title="Edit"
                    onClick={() => setEditingDrone(drone)}
                  >
                    edit
                  </span>
                  <span
                    className="material-symbols-outlined"
                    title="Delete"
                    onClick={() => setDeletingDroneId(drone.id)}
                  >
                    delete
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAddModal && (
        <AddDroneModal onClose={() => setShowAddModal(false)} onAdd={handleAddDrone} />
      )}
      {editingDrone && (
        <EditDroneModal
          drone={editingDrone}
          onClose={() => setEditingDrone(null)}
          onSave={handleUpdateDrone}
        />
      )}
      {deletingDroneId && (
        <DeleteConfirmPopup
          droneId={deletingDroneId}
          onClose={() => setDeletingDroneId(null)}
          onDeleted={fetchDrones}
          table="DroneList"
        />
      )}
    </div>
  );
}
