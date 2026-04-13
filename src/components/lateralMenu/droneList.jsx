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

  useEffect(() => {
    fetchDrones();
  }, []);

  const handleAddDrone = async ({ name }) => {
    const { error } = await supabase.from('DroneList').insert([{ name }]);
    if (!error) {
      await fetchDrones();
      setShowAddModal(false);
    }
  };

  const handleUpdateDrone = async ({ id, uid, name, color, SpeechBubbleDroneIcone }) => {
    const { error } = await supabase
      .from('DroneList')
      .update({
        uid,
        name,
        color,
        SpeechBubbleDroneIcone,
      })
      .eq('id', id);

    if (!error) {
      await fetchDrones();
      setEditingDrone(null);
    } else {
      console.error('Error updating drone:', error.message);
    }
  };

  const toggleDroneVisibility = async (drone) => {
    const { error } = await supabase
      .from('DroneList')
      .update({ show: !drone.show })
      .eq('id', drone.id);

    if (error) {
      console.error('Error updating visibility:', error.message);
    } else {
      setDrones((prevDrones) =>
        prevDrones.map((d) =>
          d.id === drone.id ? { ...d, show: !drone.show } : d
        )
      );
    }
  };

  const toggleWaterStatus = async (drone) => {
    const { error } = await supabase
      .from('DroneList')
      .update({ water: !drone.water })
      .eq('id', drone.id);

    if (error) {
      console.error('Error updating water status:', error.message);
    } else {
      setDrones((prevDrones) =>
        prevDrones.map((d) =>
          d.id === drone.id ? { ...d, water: !drone.water } : d
        )
      );
    }
  };

  return (
    <div className="droneContainer">
      <div className="droneHeader">
        <div className="droneHeaderName">Name</div>
        <div className="droneHeaderButtons">
          <button onClick={() => setShowAddModal(true)} className="iconButton" title="Add drone">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>add</span>
          </button>
          <button
            onClick={fetchDrones}
            className="iconButton"
            title="Refresh list"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>refresh</span>
          </button>
        </div>
      </div>

      {error && <p className="errorMessage">Error: {error.message}</p>}

      <ul className="droneList">
        {drones.map((drone) => (
          <li key={drone.id} className="droneItem">
            <div className="droneItemContent">
              <span className="droneNameTruncate">{drone.name}</span>
              <div className="droneActions">
                <span
                  className="material-symbols-outlined"
                  title="Water/Humidity status"
                  onClick={() => toggleWaterStatus(drone)}
                  style={{ cursor: 'pointer' }}
                >
                  {drone.water ? 'humidity_low' : 'invert_colors_off'}
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Show/Hide on map"
                  onClick={() => toggleDroneVisibility(drone)}
                  style={{ cursor: 'pointer' }}
                >
                  {drone.show ? 'visibility' : 'visibility_off'}
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Edit"
                  onClick={() => setEditingDrone(drone)}
                  style={{ cursor: 'pointer' }}
                >
                  edit
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Delete"
                  onClick={() => setDeletingDroneId(drone.id)}
                  style={{ cursor: 'pointer' }}
                >
                  delete
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showAddModal && (
        <AddDroneModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddDrone}
        />
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
