import React, { useState } from 'react';
import { useStore } from '../store';
import { PieChart, Loader2 } from 'lucide-react';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const register = useStore((state) => state.register);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações básicas no frontend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        setError('Por favor, insira um email válido.');
        return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    setIsLoading(true);

    try {
      await register(name, email, password);
      window.location.hash = '#/';
    } catch (err: any) {
      // Mensagem de erro já tratada no store, mas garantimos fallback
      let msg = err.message || 'Erro ao criar conta.';
      if (msg === 'Failed to fetch') msg = 'Erro de conexão com o servidor.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center mb-4">
            <PieChart className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">FinControl AI</h1>
          <p className="text-zinc-400 text-sm mt-1">Crie sua conta gratuita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Seu nome"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Confirmar</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Criar conta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-sm">
            Já tem uma conta?{' '}
            <a href="#/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
              Entrar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
