import { useState, useEffect, useRef } from 'react';
import PopupLogin from '../popup/popupLogin';
import AddDroneModal from '../popup/popupAddDevice';
import EditDroneModal from '../popup/popupEditDevice';
import DeleteConfirmPopup from '../popup/popupConfirmDelete';
import SaveMission from '../Fire/saveMissions';
import generateRouteMission from '../Fire/generateRouteMission';
import supabase from '../../supabaseClient';
import './lateralMenu.css';

export default function LateralMenu({
  hidden,
  visibleDrones,
  onEditDrone,
  mqttClient,
  realTimeDrones,
  isFloatingDronesVisible,
  isFloatingUsersVisible,
  onRestoreDrones,
  onRestoreUsers,
  onAddFireMode,
  isAddFireModeActive,
}) {

  // ── Auth ──────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [isLoginPopupVisible, setIsLoginPopupVisible] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  // ── UAS ───────────────────────────────────────────────────
  const [uasOpen, setUasOpen] = useState(false);
  const [drones, setDrones] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrone, setEditingDrone] = useState(null);
  const [deletingDroneId, setDeletingDroneId] = useState(null);

  const fetchDrones = async () => {
    const { data } = await supabase.from('DroneList').select('*');
    if (data) setDrones(data);
  };

  useEffect(() => { fetchDrones(); }, []);

  const handleAddDrone = async ({ name }) => {
    const { error } = await supabase.from('DroneList').insert([{ name }]);
    if (!error) { await fetchDrones(); setShowAddModal(false); }
  };

  const handleUpdateDrone = async (drone) => {
    const { error } = await supabase
      .from('DroneList')
      .update({ uid: drone.uid, name: drone.name, color: drone.color, SpeechBubbleDroneIcone: drone.SpeechBubbleDroneIcone })
      .eq('id', drone.id);
    if (!error) { await fetchDrones(); setEditingDrone(null); }
  };

  const toggleDroneVisibility = async (drone) => {
    const { error } = await supabase.from('DroneList').update({ show: !drone.show }).eq('id', drone.id);
    if (!error) setDrones(prev => prev.map(d => d.id === drone.id ? { ...d, show: !drone.show } : d));
  };

  const toggleWater = async (drone) => {
    const { error } = await supabase.from('DroneList').update({ water: !drone.water }).eq('id', drone.id);
    if (!error) setDrones(prev => prev.map(d => d.id === drone.id ? { ...d, water: !drone.water } : d));
  };

  // ── Fire ──────────────────────────────────────────────────
  const [fireOpen, setFireOpen] = useState(false);
  const [missions, setMissions] = useState([]);
  const [deletingMissionId, setDeletingMissionId] = useState(null);
  const [missionToSend, setMissionToSend] = useState(null);
  const [sendTrigger, setSendTrigger] = useState(0);
  const [routeTrigger, setRouteTrigger] = useState(0);
  const [selectedMission, setSelectedMission] = useState(null);
  const mountedRef = useRef(true);
  const GenerateRoute = generateRouteMission;

  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const assignDroneToMission = async (missionId, missionLat, missionLng) => {
    const { data: dronesData = [] } = await supabase.from('DroneList').select('uid, name, latitude, longitude, water');
    const { data: missionsData = [] } = await supabase.from('missions').select('id, drone').neq('id', missionId);
    const assignedUids = missionsData.filter(m => m.drone && m.drone !== 'Fire').map(m => m.drone);
    const free = dronesData.filter(d => d.water && d.latitude != null && !assignedUids.includes(d.uid));
    let closest = null, minDist = Infinity;
    for (const d of free) {
      const dist = distanceMeters(missionLat, missionLng, +d.latitude, +d.longitude);
      if (dist < minDist) { minDist = dist; closest = d; }
    }
    if (!closest) return null;
    await supabase.from('missions').update({ drone: closest.uid }).eq('id', missionId);
    return closest.uid;
  };

  const fetchMissions = async () => {
    const { data: dronesData = [] } = await supabase.from('DroneList').select('uid, name, latitude, longitude, water').eq('water', true);
    const { data: missionsData = [] } = await supabase.from('missions').select('*').eq('seePublic', true);

    for (const m of missionsData) {
      if (!m.drone || m.drone === '' || m.drone === 'Fire')
        await assignDroneToMission(m.id, m.latitud, m.longitude).catch(() => {});
    }

    const { data: updated = [] } = await supabase.from('missions').select('*').eq('seePublic', true);
    const assignedUids = updated.filter(m => m.drone).map(m => m.drone);
    if (!mountedRef.current) return;
    setMissions(updated.map(m => {
      const drone = dronesData.find(d => d.uid === m.drone);
      return { ...m, droneName: drone?.name ?? m.drone, droneLatitude: drone ? +drone.latitude : null, droneLongitude: drone ? +drone.longitude : null };
    }));
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchMissions();
    return () => { mountedRef.current = false; };
  }, []);

  const toggleSee = async (mission) => {
    const newSee = !mission.see;
    await supabase.from('missions').update({ see: newSee }).eq('id', mission.id);
    setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, see: newSee } : m));
  };

  const toggleSendToDrone = async (mission) => {
    const newState = !mission.stateFireRoute;
    if (newState && !window.confirm('Send this route to the drone?')) return;
    await supabase.from('missions').update({ stateFireRoute: newState }).eq('id', mission.id);
    setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, stateFireRoute: newState } : m));
    if (!newState) { setMissionToSend(null); setSendTrigger(0); return; }
    let { droneLatitude, droneLongitude } = mission;
    if (droneLatitude == null) {
      const { data } = await supabase.from('DroneList').select('latitude,longitude').eq('uid', mission.drone).single();
      if (!data?.latitude) { alert('Failed to get drone location.'); return; }
      droneLatitude = +data.latitude; droneLongitude = +data.longitude;
    }
    setMissionToSend({ drone: mission.drone, droneLatitude, droneLongitude, latitud: +mission.latitud, longitude: +mission.longitude, waypoints: mission.waypoints ?? null });
    await supabase.from('missions').update({ stateFireRoute: false }).eq('id', mission.id);
    setSendTrigger(p => p + 1);
  };

  const handleDeleteMission = async (id) => {
    await supabase.from('missions').update({ seePublic: false }).eq('id', id);
    setMissions(prev => prev.filter(m => m.id !== id));
    setDeletingMissionId(null);
  };

  const reassignDrone = async (mission) => {
    const uid = await assignDroneToMission(mission.id, mission.latitud, mission.longitude);
    if (!uid) { alert('No drones available.'); return; }
    const { data } = await supabase.from('DroneList').select('name,latitude,longitude').eq('uid', uid).single();
    setMissions(prev => prev.map(m => m.id === mission.id
      ? { ...m, drone: uid, droneName: data?.name ?? uid, droneLatitude: data ? +data.latitude : null, droneLongitude: data ? +data.longitude : null }
      : m));
  };

  // ─────────────────────────────────────────────────────────
  if (hidden) return null;

  return (
    <nav className="sidebar" onMouseLeave={() => { setUasOpen(false); setFireOpen(false); }}>

      {/* Logo */}
      <div className="sb-logo">
        <img src="/iconeDrone.png" alt="AeroWatch" className="sb-logo-img" />
        <span className="sb-logo-text">AeroWatch</span>
      </div>

      <div className="sb-divider" />

      {/* ── UAS ── */}
      <div className="sb-item" onClick={() => setUasOpen(o => !o)}>
        <span className="material-symbols-outlined">connecting_airports</span>
        <span className="sb-item-label">UAS</span>
        <span className="sb-chevron material-symbols-outlined">{uasOpen ? 'expand_less' : 'expand_more'}</span>
      </div>

      {uasOpen && (
        <div className="sb-panel">
          <div className="sb-panel-actions">
            {/* onClick={() => setShowAddModal(true)} <span className="material-symbols-outlined">add</span> */}
            <p className="sb-item-label">
              Active drones
            </p>
            <button className="sb-btn-refresh" title="Refresh" onClick={fetchDrones}>
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          {drones.length === 0
            ? <p className="sb-empty">No drones yet</p>
            : <ul className="sb-drone-list">
                {drones.map(drone => (
                  <li key={drone.id} className="sb-drone-item">
                    <span className="sb-drone-name" title={drone.name}>{drone.name}</span>
                    <div className="sb-drone-actions">
                      <span className="material-symbols-outlined" title="Water" onClick={() => toggleWater(drone)}>{drone.water ? 'humidity_low' : 'invert_colors_off'}</span>
                      <span className="material-symbols-outlined" title={drone.show ? 'Hide' : 'Show'} onClick={() => toggleDroneVisibility(drone)}>{drone.show ? 'visibility' : 'visibility_off'}</span>
                      <span className="material-symbols-outlined" title="Edit" onClick={() => setEditingDrone(drone)}>edit</span>
                      <span className="material-symbols-outlined" title="Delete" onClick={() => setDeletingDroneId(drone.id)}>delete</span>
                    </div>
                  </li>
                ))}
              </ul>
          }
        </div>
      )}

      {/* ── Fire ── */}
      <div className="sb-item" onClick={() => setFireOpen(o => !o)}>
        <span className="material-symbols-outlined">mode_heat</span>
        <span className="sb-item-label">Fire</span>
        <span className="sb-chevron material-symbols-outlined">{fireOpen ? 'expand_less' : 'expand_more'}</span>
      </div>

      {fireOpen && (
        <div className="sb-panel">
          <div className="sb-panel-actions">
            <button
              className={`sb-btn-fire${isAddFireModeActive ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onAddFireMode?.(); }}
            >
              <span className="material-symbols-outlined">add_location</span>
              {isAddFireModeActive ? 'Accept' : 'Add fire'}
            </button>
            <button className="sb-btn-refresh" title="Refresh" onClick={fetchMissions}>
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          {missions.length === 0
            ? <p className="sb-empty">No active missions</p>
            : <ul className="sb-drone-list">
                {missions.map(mission => (
                  <li key={mission.id} className="sb-drone-item">
                    <span className="sb-drone-name" title={mission.droneName || `Mission ${mission.id}`}>
                      {mission.droneName || `Mission ${mission.id}`}
                    </span>
                    <div className="sb-drone-actions">
                      <span className="material-symbols-outlined" title={mission.see ? 'Hide' : 'Show'} onClick={() => toggleSee(mission)}>{mission.see ? 'visibility' : 'visibility_off'}</span>
                      <span className="material-symbols-outlined" title="Reassign drone" onClick={() => reassignDrone(mission)}>refresh</span>
                      <span className="material-symbols-outlined" title="Generate route" onClick={() => { setSelectedMission(mission); setRouteTrigger(p => p + 1); }}>route</span>
                      <span className="material-symbols-outlined" title="Send to drone" onClick={() => toggleSendToDrone(mission)}>{mission.stateFireRoute ? 'send' : 'cancel_schedule_send'}</span>
                      <span className="material-symbols-outlined" title="Delete" onClick={() => setDeletingMissionId(mission.id)}>delete</span>
                    </div>
                  </li>
                ))}
              </ul>
          }
        </div>
      )}

      <div className="sb-divider" />

      {!isFloatingDronesVisible && (
        <div className="sb-item" onClick={onRestoreDrones}>
          <span className="material-symbols-outlined">info</span>
          <span className="sb-item-label">Drones</span>
        </div>
      )}

      {!isFloatingUsersVisible && (
        <div className="sb-item" onClick={onRestoreUsers}>
          <span className="material-symbols-outlined">groups</span>
          <span className="sb-item-label">Users</span>
        </div>
      )}

      <div className="sb-item">
        <span className="material-symbols-outlined">settings</span>
        <span className="sb-item-label">Config</span>
      </div>

      <div className="sb-spacer" />
      <div className="sb-divider" />

      <div className="sb-item" onClick={() => setIsLoginPopupVisible(true)}>
        <span className="material-symbols-outlined">account_circle</span>
        <span className="sb-item-label">
          {user ? (user.user_metadata?.full_name ?? user.email) : 'Sign in'}
        </span>
        {isLoginPopupVisible && (
          <PopupLogin
            user={user}
            onClose={() => setIsLoginPopupVisible(false)}
            onUserUpdate={async () => {
              const { data } = await supabase.auth.getSession();
              setUser(data.session?.user ?? null);
            }}
          />
        )}
      </div>

      {/* ── Modals & headless components ── */}
      {showAddModal && <AddDroneModal onClose={() => setShowAddModal(false)} onAdd={handleAddDrone} />}
      {editingDrone && <EditDroneModal drone={editingDrone} onClose={() => setEditingDrone(null)} onSave={handleUpdateDrone} />}
      {deletingDroneId && <DeleteConfirmPopup droneId={deletingDroneId} onClose={() => setDeletingDroneId(null)} onDeleted={fetchDrones} table="DroneList" />}
      {deletingMissionId && <DeleteConfirmPopup onConfirm={() => handleDeleteMission(deletingMissionId)} onCancel={() => setDeletingMissionId(null)} message="Delete this mission?" />}
      {missionToSend && <SaveMission key={sendTrigger} drone={{ uid: missionToSend.drone }} fireLocation={{ lat: missionToSend.latitud, lng: missionToSend.longitude }} homeLocation={{ lat: missionToSend.droneLatitude, lng: missionToSend.droneLongitude }} mqttClient={mqttClient} sendTrigger={sendTrigger} waypointsFromMission={missionToSend.waypoints} stateFireRoute={true} />}
      {selectedMission && <GenerateRoute key={routeTrigger} drone={{ uid: selectedMission.drone }} fireLocation={{ lat: selectedMission.latitud, lng: selectedMission.longitude }} homeLocation={{ lat: selectedMission.droneLatitude, lng: selectedMission.droneLongitude }} realTimeLocation={realTimeDrones[selectedMission.drone]} missionId={selectedMission.id} trigger={routeTrigger} onRouteGenerated={(d) => { setMissions(prev => prev.map(m => m.id === selectedMission.id ? { ...m, waypoints: d.waypoints } : m)); if (missionToSend?.drone === selectedMission.drone) setMissionToSend(p => ({ ...p, waypoints: d.waypoints })); }} />}

    </nav>
  );
}
