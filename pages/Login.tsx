import React, { useState } from 'react';
import { useStore } from '../store';
import { PieChart, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      window.location.hash = '#/';
    } catch (err: any) {
      setError('Email ou senha inválidos.');
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
          <p className="text-zinc-400 text-sm mt-1">Entre para gerenciar suas finanças</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-sm">
            Não tem uma conta?{' '}
            <a href="#/register" className="text-emerald-500 hover:text-emerald-400 font-medium">
              Criar conta
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
