import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{display:"grid",placeItems:"center",minHeight:"100vh"}}>
      <form onSubmit={onSubmit} style={{width:360,padding:24,border:"1px solid #eee",borderRadius:12}}>
        <h2 style={{marginTop:0, marginBottom:16}}>Acessar</h2>
        <label style={{display:"block", marginBottom:8}}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          style={{width:"100%", padding:10, borderRadius:8, border:"1px solid #ddd"}}
          required
        />
        <label style={{display:"block", marginTop:12, marginBottom:8}}>Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          placeholder="••••••••"
          style={{width:"100%", padding:10, borderRadius:8, border:"1px solid #ddd"}}
          required
        />
        {error && <p style={{color:"#b00020", marginTop:12}}>{error}</p>}
        <button type="submit" style={{marginTop:16, width:"100%", padding:10, borderRadius:8, border:"none"}}>
          Entrar
        </button>
      </form>
    </div>
  );
}
