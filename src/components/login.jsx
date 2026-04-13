import { useState } from "react";
import supabase from "../supabaseClient";
import "./login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
  };
  
  return (
    <div className="ringBody" >

        <div className="ring" >
        <i style={{ "--clr": "#00ff0a" }}></i>
        <i style={{ "--clr": "#ff0057" }}></i>
        <i style={{ "--clr": "#fffd44" }}></i>

        <div className="login">
            <h2>Login</h2>
            {error && <p className="error">{error}</p>}

            <form onSubmit={handleLogin}>
            <div className="inputBx">
                <input
                type="user"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div className="inputBx">
                <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <div className="inputBx">
                <input type="submit" value="Sign in" />
            </div>
            </form>
        </div>
        </div>
    </div>
  );
}
