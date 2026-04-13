import { useEffect, useState, useRef } from 'react';
import supabase from '../../supabaseClient';
import DeleteConfirmPopup from '../popup/popupConfirmDelete';
import SaveMission from '../Fire/saveMissions';
import generateRouteMission from '../Fire/generateRouteMission';

export default function FireMissions({ mqttClient, realTimeDrones }) {
  const [missions, setMissions] = useState([]);
  const [drones, setDrones] = useState([]);
  const [deletingMissionId, setDeletingMissionId] = useState(null);
  const [missionToSend, setMissionToSend] = useState(null);
  const [sendTrigger, setSendTrigger] = useState(0);
  const [routeTrigger, setRouteTrigger] = useState(0);
  const [selectedMission, setSelectedMission] = useState(null);

  const mountedRef = useRef(true);
  const GenerateRouteMissionAlias = generateRouteMission;

  const distanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const assignDroneToMission = async (missionId, missionLat, missionLng) => {
    try {
      const { data: dronesData = [], error: dronesError } = await supabase
        .from('DroneList')
        .select('uid, name, latitude, longitude, water');
      if (dronesError) throw dronesError;

      const dronesWithWater = dronesData.filter(
        (d) => d.water === true && d.latitude != null && d.longitude != null
      );

      const { data: missionsData = [], error: missionsError } = await supabase
        .from('missions')
        .select('id, drone')
        .neq('id', missionId);
      if (missionsError) throw missionsError;

      const assignedDrones = missionsData
        .filter((m) => m.drone && m.drone !== '' && m.drone !== 'Fire')
        .map((m) => m.drone);

      const freeDrones = dronesWithWater.filter((d) => !assignedDrones.includes(d.uid));

      let closestDrone = null;
      let minDist = Infinity;
      for (const drone of freeDrones) {
        const dist = distanceMeters(
          missionLat,
          missionLng,
          Number(drone.latitude),
          Number(drone.longitude)
        );
        if (dist < minDist) {
          minDist = dist;
          closestDrone = drone;
        }
      }

      if (!closestDrone) return null;

      const { error: updateError } = await supabase
        .from('missions')
        .update({ drone: closestDrone.uid })
        .eq('id', missionId);
      if (updateError) throw updateError;

      return closestDrone.uid;
    } catch (err) {
      console.error('assignDroneToMission error:', err);
      return null;
    }
  };

  const refreshData = async () => {
    try {
      const { data: dronesData = [], error: dronesError } = await supabase
        .from('DroneList')
        .select('uid, name, latitude, longitude, water')
        .eq('water', true);
      if (dronesError) throw dronesError;

      const { data: missionsData = [], error: missionsError } = await supabase
        .from('missions')
        .select('*')
        .eq('seePublic', true);
      if (missionsError) throw missionsError;

      for (const mission of missionsData) {
        if (!mission.drone || mission.drone === '' || mission.drone === 'Fire') {
          try {
            await assignDroneToMission(mission.id, mission.latitud, mission.longitude);
          } catch (err) {
            console.error('Error assigning drone to mission (refresh loop):', err);
          }
        }
      }

      const { data: updatedMissions = [], error: updatedError } = await supabase
        .from('missions')
        .select('*')
        .eq('seePublic', true);
      if (updatedError) throw updatedError;

      const assignedDrones = updatedMissions.filter((m) => m.drone).map((m) => m.drone);
      const freeDrones = dronesData.filter((d) => !assignedDrones.includes(d.uid));

      if (!mountedRef.current) return;
      setDrones(freeDrones);

      const missionsWithDroneName = updatedMissions.map((mission) => {
        const drone = dronesData.find((d) => d.uid === mission.drone);
        return {
          ...mission,
          droneName: drone ? drone.name : mission.drone,
          droneLatitude: drone ? Number(drone.latitude) : null,
          droneLongitude: drone ? Number(drone.longitude) : null,
        };
      });

      if (!mountedRef.current) return;
      setMissions(missionsWithDroneName);
    } catch (err) {
      console.error('refreshData error:', err);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    refreshData();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const toggleSee = async (mission) => {
    try {
      const newSee = !mission.see;
      const { error } = await supabase.from('missions').update({ see: newSee }).eq('id', mission.id);
      if (error) throw error;

      setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, see: newSee } : m)));
    } catch (err) {
      console.error('toggleSee error:', err);
    }
  };

  const toggleSendToDrone = async (mission) => {
    try {
      const newState = !mission.stateFireRoute;

      if (newState) {
        const confirmed = window.confirm('Are you sure you want to send this route to the drone?');
        if (!confirmed) return;
      }

      const { error: stateError } = await supabase
        .from('missions')
        .update({ stateFireRoute: newState })
        .eq('id', mission.id);
      if (stateError) throw stateError;

      setMissions((prev) => prev.map((m) => (m.id === mission.id ? { ...m, stateFireRoute: newState } : m)));

      if (!newState) {
        setMissionToSend(null);
        setSendTrigger(0);
        return;
      }

      let droneLatitude = mission.droneLatitude;
      let droneLongitude = mission.droneLongitude;

      if (droneLatitude == null || droneLongitude == null) {
        const { data: droneData, error: droneError } = await supabase
          .from('DroneList')
          .select('latitude, longitude')
          .eq('uid', mission.drone)
          .single();

        if (droneError || !droneData || droneData.latitude == null || droneData.longitude == null) {
          console.error('Failed to get drone location from database');
          alert('Failed to get drone location.');
          return;
        }

        droneLatitude = Number(droneData.latitude);
        droneLongitude = Number(droneData.longitude);
      }

      setMissionToSend({
        drone: mission.drone,
        droneLatitude,
        droneLongitude,
        latitud: Number(mission.latitud),
        longitude: Number(mission.longitude),
        waypoints: mission.waypoints || null,
      });

      await supabase.from('missions').update({ stateFireRoute: false }).eq('id', mission.id);
      setSendTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('toggleSendToDrone error:', err);
    }
  };

  const handleDeleteMission = async (id) => {
    try {
      const { error } = await supabase.from('missions').update({ seePublic: false }).eq('id', id);
      if (error) throw error;
      setMissions((prev) => prev.filter((m) => m.id !== id));
      setDeletingMissionId(null);
    } catch (err) {
      console.error('handleDeleteMission error:', err);
    }
  };

  return (
    <div className="droneContainer">
      <div className="droneHeader">
        <div className="droneHeaderName">Missions</div>
        <div className="droneHeaderButtons">
          <button onClick={refreshData} className="iconButton" title="Refresh list">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>refresh</span>
          </button>
        </div>
      </div>

      <ul className="droneList">
        {missions.map((mission) => (
          <li key={mission.id} className="droneItem">
            <div className="droneItemContent">
              <span className="droneNameTruncate" title={mission.droneName || `Mission ${mission.id}`}>
                {mission.droneName || `Mission ${mission.id}`}
              </span>

              <div className="droneActions">
                <span
                  className="material-symbols-outlined"
                  title={mission.see ? 'Hide mission' : 'Show mission'}
                  onClick={() => toggleSee(mission)}
                  style={{ cursor: 'pointer' }}
                >
                  {mission.see ? 'visibility' : 'visibility_off'}
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Assign nearest drone"
                  onClick={async () => {
                    const newDroneUid = await assignDroneToMission(mission.id, mission.latitud, mission.longitude);
                    if (newDroneUid) {
                      const { data: droneData } = await supabase
                        .from('DroneList')
                        .select('name, latitude, longitude')
                        .eq('uid', newDroneUid)
                        .single();

                      setMissions((prev) =>
                        prev.map((m) =>
                          m.id === mission.id
                            ? {
                                ...m,
                                drone: newDroneUid,
                                droneName: droneData?.name || newDroneUid,
                                droneLatitude: droneData ? Number(droneData.latitude) : null,
                                droneLongitude: droneData ? Number(droneData.longitude) : null,
                              }
                            : m
                        )
                      );  
                    } else {
                      alert('No drones are available to assign.');
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  refresh
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Generate route"
                  onClick={() => {
                    setSelectedMission(mission);
                    setRouteTrigger((prev) => prev + 1);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  route
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Send to drone"
                  onClick={() => toggleSendToDrone(mission)}
                  style={{ cursor: 'pointer' }}
                >
                  {mission.stateFireRoute ? 'send' : 'cancel_schedule_send'}
                </span>

                <span
                  className="material-symbols-outlined"
                  title="Delete mission"
                  onClick={() => setDeletingMissionId(mission.id)}
                  style={{ cursor: 'pointer' }}
                >
                  delete
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {deletingMissionId && (
        <DeleteConfirmPopup
          onConfirm={() => handleDeleteMission(deletingMissionId)}
          onCancel={() => setDeletingMissionId(null)}
          message="Do you want to delete this mission?"
        />
      )}

      {missionToSend && (
        <SaveMission
          key={sendTrigger}
          drone={{ uid: missionToSend.drone }}
          fireLocation={{ lat: missionToSend.latitud, lng: missionToSend.longitude }}
          homeLocation={{ lat: missionToSend.droneLatitude, lng: missionToSend.droneLongitude }}
          mqttClient={mqttClient}
          sendTrigger={sendTrigger}
          waypointsFromMission={missionToSend.waypoints}
          stateFireRoute={true}
        />
      )}
      
      {selectedMission && (
        <GenerateRouteMissionAlias
          key={routeTrigger}
          drone={{ uid: selectedMission.drone }}
          fireLocation={{ lat: selectedMission.latitud, lng: selectedMission.longitude }}
          homeLocation={{
            lat: selectedMission.droneLatitude,
            lng: selectedMission.droneLongitude,
          }}
          realTimeLocation={realTimeDrones[selectedMission.drone]}
          missionId={selectedMission.id}
          trigger={routeTrigger}
          onRouteGenerated={(missionData) => {
            setMissions(prev => prev.map(m => 
              m.id === selectedMission.id 
                ? { ...m, waypoints: missionData.waypoints }
                : m
            ));
            
            if (missionToSend && missionToSend.drone === selectedMission.drone) {
              setMissionToSend(prev => ({
                ...prev,
                waypoints: missionData.waypoints
              }));
            }
          }}
        />
      )}
    </div>
  );
}