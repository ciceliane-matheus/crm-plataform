import React, { useState, useEffect } from 'react';

// Importações do Firebase
// NOTA: Certifique-se de ter instalado o 'firebase' no seu projeto: 'npm install firebase'
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- Configuração e Inicialização do Firebase ---
// Esta função é executada uma vez para configurar o Firebase na aplicação.
const initializeFirebase = () => {
  // As variáveis de configuração são injetadas pelo ambiente de desenvolvimento.
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
    console.error("Erro: A configuração do Firebase não foi encontrada. O login não funcionará.");
    return null;
  }

  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Tenta fazer login com o token personalizado, se disponível.
    if (initialAuthToken) {
      signInWithCustomToken(auth, initialAuthToken).catch(console.error);
    }

    return auth;
  } catch (error) {
    console.error("Erro ao inicializar o Firebase. Verifique suas credenciais:", error);
    return null;
  }
};

const auth = initializeFirebase();

// --- Componente da Tela de Login ---
const LoginPage = () => {
  // Estados para controlar os dados do formulário e o status da requisição
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }
    // O onAuthStateChanged é o listener que monitora o estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
      if (user) {
        setIsLoggedIn(true);
        console.log("Usuário logado:", user.uid);
      } else {
        setIsLoggedIn(false);
        console.log("Usuário deslogado.");
      }
    });

    return () => unsubscribe(); // Limpa o listener ao desmontar o componente
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Se o serviço de autenticação não estiver pronto, para a função.
    if (!auth) {
      setError("O serviço de autenticação não está disponível. Tente novamente.");
      setLoading(false);
      return;
    }

    try {
      // Chama a função do Firebase para autenticar o usuário com e-mail e senha.
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // Trata os erros específicos do Firebase e exibe uma mensagem amigável.
      switch (err.code) {
        case 'auth/wrong-password':
          setError('Senha incorreta.');
          break;
        case 'auth/user-not-found':
          setError('E-mail não encontrado.');
          break;
        case 'auth/invalid-email':
          setError('E-mail inválido.');
          break;
        case 'auth/too-many-requests':
          setError('Muitas tentativas. Tente novamente mais tarde.');
          break;
        default:
          setError('Erro ao fazer login. Tente novamente.');
          break;
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Exibe uma mensagem de carregamento enquanto o Firebase inicializa ou faz login.
  if (!isAuthReady || (isAuthReady && isLoggedIn)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">
          {isLoggedIn ? "Logado com sucesso! Redirecionando..." : "Carregando..."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Login</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              placeholder="seuemail@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              placeholder="********"
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm font-medium text-center p-2 rounded-md bg-red-50">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-200 disabled:bg-blue-300"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;