import { useState, useEffect } from 'react';
import DroneList from './droneList';
import FireMissions from './fireMissions';
import PopupLogin from '../popup/popupLogin';
import supabase from '../../supabaseClient';
import './lateralMenu.css';

export default function LateralMenu({
  visibleDrones,
  toggleDroneVisibility,
  onEditDrone,
  mqttClient,
  realTimeDrones,
  isFloatingDronesVisible,
  isFloatingUsersVisible,
  onRestoreDrones,
  onRestoreUsers,
  onAddFireMode,
  isAddFireModeActive
}) {
  const [isDroneListVisible, setIsDroneListVisible] = useState(false);
  const [closingDroneList, setClosingDroneList] = useState(false);
  const [isFireVisible, setIsFireVisible] = useState(false);
  const [closingFireList, setClosingFireList] = useState(false);
  const [isLoginPopupVisible, setIsLoginPopupVisible] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleToggleDrones = () => {
    if (isDroneListVisible) {
      setClosingDroneList(true);
      setTimeout(() => {
        setClosingDroneList(false);
        setIsDroneListVisible(false);
      }, 300);
    } else {
      setIsDroneListVisible(true);
    }
  };

  const handleToggleFire = () => {
    if (isFireVisible) {
      setClosingFireList(true);
      setTimeout(() => {
        setClosingFireList(false);
        setIsFireVisible(false);
      }, 300);
    } else {
      setIsFireVisible(true);
    }
  };

  const handleToggleVisibility = (drone) => {
    toggleDroneVisibility(drone.id);
  };

  return (
    <section className='sidebar'>
      <ul className="sidebarMenu">

        {/* LOGO */}
        <li className="sidebarElement">
          <img src="/iconeDrone.png" alt="Site logo" className='sidebarLogo sidebarIcon' />
          <div className="sidebarHide">
            <h1 className='sidebarTextLogo'>Aero<br />Watch</h1>
          </div>
        </li>

        {/* DRONES */}
        <li
          className="sidebarElement"
          onClick={handleToggleDrones}
        >
          <span className="material-symbols-outlined sidebarIcon">
            connecting_airports
          </span>
          <div className="sidebarHide">
            <span className="sidebarText">UAS</span>
          </div>

          <div className={`sidebarList ${isDroneListVisible ? "show" : ""} ${closingDroneList ? "closing" : ""}`}>
            <div className="resizableList" onClick={(e) => e.stopPropagation()}>
              <DroneList
                visibleDrones={visibleDrones}
                onToggleVisibility={handleToggleVisibility}
                onEditDrone={onEditDrone}
              />
            </div>
          </div>
        </li>

        {/* FIRE */}
        <li className="sidebarElement" onClick={handleToggleFire}>
          <span className="material-symbols-outlined sidebarIcon">
            mode_heat
          </span>
          <div className="sidebarHide">
            <span className="sidebarText">Fire</span>
          </div>

          <div className={`sidebarList ${isFireVisible ? "show" : ""} ${closingFireList ? "closing" : ""}`}>
            
            <div className="resizableList" onClick={(e) => e.stopPropagation()}>

              {/* 🔥 HEADER MISSIONS + BOTÓN */}
              <div className="missions-header">
                

                <button 
                  className={`add-fire-button ${isAddFireModeActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFireMode?.();
                  }}
                >
                  <span className="material-symbols-outlined">add_location</span>
                  {isAddFireModeActive ? 'Accept' : 'Add fire'}
                </button>
              </div>

              {/* LISTA DE MISIONES */}
              <FireMissions 
                mqttClient={mqttClient} 
                realTimeDrones={realTimeDrones}
              />
            </div>
          </div>
        </li>

        {/* RESTORE DRONES */}
        {!isFloatingDronesVisible && (
          <li className="sidebarElement" onClick={onRestoreDrones}>
            <span className="material-symbols-outlined sidebarIcon">info</span>
            <div className="sidebarHide">
              <span className="sidebarText">Drones</span>
            </div>
          </li>
        )}

        {/* RESTORE USERS */}
        {!isFloatingUsersVisible && (
          <li className="sidebarElement" onClick={onRestoreUsers}>
            <span className="material-symbols-outlined sidebarIcon">groups</span>
            <div className="sidebarHide">
              <span className="sidebarText">Users</span>
            </div>
          </li>
        )}

        {/* CONFIG */}
        <li className="sidebarElement">
          <span className="material-symbols-outlined sidebarIcon">settings</span>
          <div className="sidebarHide">
            <span className="sidebarText">Config</span>
          </div>
        </li>

        {/* LOGIN */}
        <li
          className="sidebarElement sidebarLogin"
          onClick={() => setIsLoginPopupVisible(true)}
        >
          <span className="material-symbols-outlined sidebarIcon">account_circle</span>
          <div className="sidebarHide">
            {user ? (
              <span className="sidebarText">
                {user.user_metadata?.full_name ?? user.email}
              </span>
            ) : (
              <span className="sidebarText">
                Iniciar sesión
              </span>
            )}

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
        </li>

      </ul>
    </section>
  );
}