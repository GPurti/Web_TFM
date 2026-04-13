import { useState, useEffect, useRef, Suspense } from "react";
import { Rnd } from "react-rnd";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import "./floatingWindows.css";

function DroneModel({ modelPath, modelScale }) {
  try {
    const { scene } = useGLTF(modelPath);
    return <primitive object={scene} scale={modelScale} position={[0, 40, 0]} />;
  } catch {
    return null;
  }
}

export default function FloatingDroneList({ drones, onMinimize, onControlDrone }) { 
  const [activeTab, setActiveTab] = useState(drones?.[0]?.id || null);
  const [isPinned, setIsPinned] = useState(false);
  const [isDraggingWithHand, setIsDraggingWithHand] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [isCamaraOpen, setIsCamaraOpen] = useState(true);
  const [is3DOpen, setIs3DOpen] = useState(true);

  const rndRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const modelScale = 0.3;

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (drones?.length && !drones.find((d) => d.id === activeTab)) {
      setActiveTab(drones[0].id);
    }
  }, [drones]);

  const handleMouseMove = (e) => {
    if (!isDraggingWithHand || !rndRef.current) return;
    window.requestAnimationFrame(() => {
      rndRef.current.updatePosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    });
  };

  const handleMouseUp = () => {
    setIsDraggingWithHand(false);
  };

  const handleMouseDownHand = (e) => {
    e.stopPropagation();
    if (!rndRef.current || isPinned) return;
    const rect = rndRef.current.resizableElement.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDraggingWithHand(true);
  };

  useEffect(() => {
    if (isDraggingWithHand) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "auto";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "auto";
    };
  }, [isDraggingWithHand]);

  if (!drones || drones.length === 0) return null;

  return (
    <Rnd
      ref={rndRef}
      default={{
        x: windowSize.width - 420,
        y: 20,
        width: 400,
        height: 450,
      }}
      bounds="window"
      enableResizing={!isPinned}
      disableDragging={!isPinned && !isDraggingWithHand}
      dragHandleClassName="widgetHeader"
      className={`floatingWidget ${isPinned ? "pinned" : ""}`}
    >
      <div className="widgetHeader"></div>

      <div className="tabsBar">
        <div className="tabsList">
          {drones.map((drone) => (
            <div
              key={drone.id}
              className={`tab ${activeTab === drone.id ? "activeTab" : ""}`}
              onClick={() => setActiveTab(drone.id)}
              title={drone.name} 
            >
              <span className="tabText">{drone.name}</span>
            </div>
          ))}
        </div>

        <div className="tabsButtons">
          <span
            className="material-symbols-outlined iconBtn"
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? "Desbloquear" : "Fijar"}
          >
            {isPinned ? "keep" : "keep_off"}
          </span>

          <span
            className="material-symbols-outlined iconBtn"
            title={isPinned ? "Hand Gesture Off" : "Hand Gesture"}
            onMouseDown={handleMouseDownHand}
          >
            {isPinned ? "hand_gesture_off" : "hand_gesture"}
          </span>

          <span
            className="material-symbols-outlined iconBtn"
            onClick={onMinimize}
            title="Minimizar"
          >
            minimize
          </span>
        </div>
      </div>

      <div className="widgetContent">
        {drones.map(
          (drone) =>
            drone.id === activeTab &&
            drone.uid && (
              <div key={drone.id} className="tabContent">
                <div className="infoRow" style={{ marginBottom: "8px" }}>
                  <strong>Name:</strong>{" "}
                  <span className="infoValue">{drone.name}</span>
                </div>

                {/* 👇 NUEVO: Botón de control del drone */}
                <div className="controlButtonRow">
                  <button 
                    className="controlDroneBtn"
                    onClick={() => onControlDrone?.(drone)}
                    title="Controlar este drone"
                  >
                    <span className="material-symbols-outlined">flight_takeoff</span>
                    Control Drone
                  </button>
                </div>

                <div
                  className="collapsibleHeader"
                  onClick={() => setIsCamaraOpen(!isCamaraOpen)}
                >
                  <strong>Camara</strong>
                  <span>{isCamaraOpen ? "▲" : "▼"}</span>
                </div>
                {isCamaraOpen && (
                  <div className="collapsibleContent">
                    <div></div>
                  </div>
                )}

                <hr className="separator" />

                <div
                  className="collapsibleHeader"
                  onClick={() => setIs3DOpen(!is3DOpen)}
                >
                  <strong>3D Design</strong>
                  <span>{is3DOpen ? "▲" : "▼"}</span>
                </div>
                {is3DOpen && (
                  <div className="collapsibleContent">
                    <div className="drone3DContainer">
                      <Canvas
                        style={{ height: "180px", width: "100%" }}
                        camera={{ position: [-248.81, 113.56, 141.66], fov: 50 }}
                      >
                        <ambientLight intensity={0.6} />
                        <directionalLight position={[10, 10, 5]} intensity={1} />
                        <Suspense fallback={null}>
                          <DroneModel
                            modelPath={`/models/${drone.uid}.glb`}
                            modelScale={modelScale}
                          />
                        </Suspense>
                        <OrbitControls
                          enablePan={false}
                          enableZoom={true}
                          enableRotate={true}
                          maxPolarAngle={Math.PI / 2}
                          minPolarAngle={0}
                          target={[0, 0, 0]}
                        />
                      </Canvas>
                    </div>
                  </div>
                )}
              </div>
            )
        )}
      </div>
    </Rnd>
  );
}