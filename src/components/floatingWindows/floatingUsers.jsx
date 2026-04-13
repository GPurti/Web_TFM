import { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";
import { createClient } from "@supabase/supabase-js";
import "./floatingWindows.css";

const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

export default function FloatingUsers({ onMinimize, session }) {
  const [allUsers, setAllUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isDraggingWithHand, setIsDraggingWithHand] = useState(false);
  const rndRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      let all = [];
      let page = 1;
      let perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (error) break;
        all = all.concat(data.users);
        if (data.users.length < perPage) hasMore = false;
        else page++;
      }

      setAllUsers(all);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!session) return;

    const uniqueKey = `${session.user.id}-${crypto.randomUUID()}`;
    const channel = supabaseAdmin.channel("online_users", {
      config: { presence: { key: uniqueKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const connected = Object.values(state).flat();
        setOnlineUsers(connected);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || null,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => channel.unsubscribe();
  }, [session]);

  const handleMouseMove = (e) => {
    if (!isDraggingWithHand || !rndRef.current) return;
    window.requestAnimationFrame(() => {
      rndRef.current.updatePosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    });
  };

  const handleMouseUp = () => setIsDraggingWithHand(false);

  const handleMouseDownHand = (e) => {
    e.stopPropagation();
    if (!rndRef.current || isPinned) return;
    const rect = rndRef.current.resizableElement.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email);
    alert(`Email copied: ${email}`);
  };

  const usersWithStatus = allUsers.map((user) => {
    const isOnline = onlineUsers.some((u) => u.id === user.id);
    return { ...user, isOnline };
  });

  return (
    <Rnd
      ref={rndRef}
      default={{
        x: windowSize.width - 420,
        y: 20,
        width: 400,
        height: 500,
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
          <span style={{ fontWeight: "bold"}} >Users</span>
        </div>

        <div className="tabsButtons">
          <span
            className="material-symbols-outlined iconBtn"
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? "Unlock" : "Pin"}
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
            title="Minimize"
          >
            minimize
          </span>
        </div>
      </div>

      <div className="widgetContent">
        {usersWithStatus.length === 0 ? (
          <div>No users registered</div>
        ) : (
          <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
            {usersWithStatus.map((user) => (
              <li
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  marginBottom: "6px",
                  borderRadius: "6px",
                  background: "#fff9ce",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: user.isOnline ? "green" : "red",
                  }}
                  title={user.isOnline ? "Online" : "Offline"}
                ></span>

                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "28px", marginRight: "8px" }}
                >
                  person
                </span>

                <span style={{ flexGrow: 1, fontWeight: "bold" }}>
                  {user.user_metadata?.full_name || user.email || "Unknown"}
                </span>

                {user.email && (
                  <span
                    className="material-symbols-outlined"
                    style={{ cursor: "pointer", marginLeft: "6px" }}
                    title="Copy email"
                    onClick={() => copyEmail(user.email)}
                  >
                    mail
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Rnd>
  );
}
