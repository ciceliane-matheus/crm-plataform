// src/auth/AuthProvider.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setEmpresa(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);

      // carrega o documento do usuário -> pega empresaId
      const userRef = doc(db, "usuarios", firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const { empresaId } = userSnap.data() || {};
        if (empresaId) {
          const empRef = doc(db, "empresas", empresaId);
          const empSnap = await getDoc(empRef);
          setEmpresa(empSnap.exists() ? { id: empSnap.id, ...empSnap.data() } : null);
        } else {
          setEmpresa(null);
        }
      } else {
        setEmpresa(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, empresa, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);