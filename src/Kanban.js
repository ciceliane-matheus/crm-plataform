import React, { useEffect, useMemo, useState } from "react";
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebaseConfig";

const STATUSES = ["Novo", "Qualificado", "Em negociação", "Fechado"];

export default function Kanban({ empresaId, currentUser }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!empresaId) return;
    const q = query(collection(db, "cards"), where("empresaId", "==", empresaId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCards(list);
      setLoading(false);
    });
    return () => unsub();
  }, [empresaId]);

  const grouped = useMemo(() => {
    const m = {};
    STATUSES.forEach(s => m[s] = []);
    cards.forEach(c => { (m[c.status] || (m[c.status] = [])).push(c); });
    return m;
  }, [cards]);

  const createCard = async () => {
    if (!newTitle.trim()) return;
    await addDoc(collection(db, "cards"), {
      empresaId,
      titulo: newTitle.trim(),
      status: "Novo",
      createdAt: serverTimestamp(),
      createdBy: currentUser?.uid || null
    });
    setNewTitle("");
  };

  const moveCard = async (id, nextStatus) => {
    await updateDoc(doc(db, "cards", id), { status: nextStatus });
  };

  const removeCard = async (id) => {
    await deleteDoc(doc(db, "cards", id));
  };

  if (loading) return <p>Carregando Kanban...</p>;

  return (
    <div style={{display:"grid", gridTemplateColumns:`repeat(${STATUSES.length}, 1fr)`, gap:16}}>
      <div style={{gridColumn: `1 / -1`, display:"flex", gap:8, marginBottom:8}}>
        <input
          placeholder="Novo lead..."
          value={newTitle}
          onChange={(e)=>setNewTitle(e.target.value)}
          style={{flex:1, padding:10, border:"1px solid #ddd", borderRadius:8}}
        />
        <button onClick={createCard} style={{padding:"10px 14px", borderRadius:8, border:"none"}}>
          Adicionar
        </button>
      </div>

      {STATUSES.map(status => (
        <div key={status} style={{background:"#fafafa", border:"1px solid #eee", borderRadius:12, padding:12}}>
          <h3 style={{marginTop:0}}>{status}</h3>
          <div style={{display:"grid", gap:8}}>
            {grouped[status]?.map(card => (
              <div key={card.id} style={{background:"#fff", border:"1px solid #eee", borderRadius:10, padding:10}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <strong>{card.titulo}</strong>
                  <button onClick={() => removeCard(card.id)} style={{border:"none"}}>✕</button>
                </div>
                <div style={{display:"flex", gap:8, marginTop:8, flexWrap:"wrap"}}>
                  {STATUSES.filter(s => s !== card.status).map(s => (
                    <button key={s} onClick={() => moveCard(card.id, s)} style={{border:"1px solid #ddd", borderRadius:8, padding:"6px 8px"}}>
                      → {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
