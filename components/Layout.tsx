import React from 'react';
import { LayoutDashboard, Receipt, Tags, PiggyBank, PieChart, Menu, X, Bot, LogOut, User as UserIcon, CalendarClock } from 'lucide-react';
import { useStore } from '../store';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, href, active, onClick }) => (
  <button
    onClick={() => {
      window.location.hash = href;
      onClick();
    }}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
      active 
        ? 'bg-zinc-800 text-white' 
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentPath, setCurrentPath] = React.useState(window.location.hash || '#/');
  const logout = useStore((state) => state.logout);
  const user = useStore((state) => state.user);

  React.useEffect(() => {
    const handleHashChange = () => setCurrentPath(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLogout = () => {
      logout();
      window.location.hash = '#/'; // Will redirect to login via App.tsx logic
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex font-sans">
      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-zinc-950 border-r border-zinc-800 transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center gap-2 px-2 mb-8 mt-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <PieChart className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">FinControl AI</span>
          </div>

          <nav className="flex-1 space-y-1">
            <NavItem 
              icon={LayoutDashboard} 
              label="Visão Geral" 
              href="#/" 
              active={currentPath === '#/' || currentPath === ''} 
              onClick={() => setIsOpen(false)}
            />
            <NavItem 
              icon={Receipt} 
              label="Transações" 
              href="#/transactions" 
              active={currentPath === '#/transactions'} 
              onClick={() => setIsOpen(false)}
            />
            <NavItem 
              icon={Tags} 
              label="Categorias" 
              href="#/categories" 
              active={currentPath === '#/categories'} 
              onClick={() => setIsOpen(false)}
            />
            <NavItem
              icon={CalendarClock}
              label="Recorrências"
              href="#/recurring"
              active={currentPath === '#/recurring'}
              onClick={() => setIsOpen(false)}
            />
            <NavItem 
              icon={PiggyBank} 
              label="Reservas" 
              href="#/reserves" 
              active={currentPath === '#/reserves'} 
              onClick={() => setIsOpen(false)}
            />
          </nav>

          <div className="space-y-4 pt-4 border-t border-zinc-800">
            {/* User Info */}
            <div className="px-2 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                    <UserIcon size={16} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{user?.name || 'Usuário'}</p>
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
            </div>

             {/* Logout Button */}
            <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-zinc-400 hover:text-red-400 hover:bg-zinc-900"
            >
                <LogOut size={20} />
                <span className="font-medium text-sm">Sair</span>
            </button>

            <div className="px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500 uppercase">Status IA</span>
              </div>
              <p className="text-xs text-zinc-500">
                Projeções ativas baseadas em regras de recorrência.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
          <span className="font-bold text-lg">FinControl</span>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
