import React from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Categories } from './pages/Categories';
import { RecurringRules } from './pages/RecurringRules';
import { Reserves } from './pages/Reserves';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { useStore } from './store';
import { Loader2 } from 'lucide-react';

// Simple router based on hash for SPA compatibility without server configuration
const Router = () => {
  const [route, setRoute] = React.useState(window.location.hash || '#/');
  const fetchAllData = useStore((state) => state.fetchAllData);
  const checkAuth = useStore((state) => state.checkAuth);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const [authChecked, setAuthChecked] = React.useState(false);

  React.useEffect(() => {
    const init = async () => {
      await checkAuth();
      setAuthChecked(true);
    };
    init();
  }, [checkAuth]);

  React.useEffect(() => {
    if (isAuthenticated) {
        fetchAllData();
    }
  }, [fetchAllData, isAuthenticated]);

  React.useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!authChecked) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center text-emerald-500">
              <Loader2 className="animate-spin" size={48} />
          </div>
      );
  }

  // Routes for unauthenticated users
  if (!isAuthenticated) {
    if (route === '#/register') {
      return <Register />;
    }
    // Default to Login for any other route if not authenticated
    return <Login />;
  }

  // Routes for authenticated users
  let Component;
  switch (route) {
    case '#/transactions':
      Component = Transactions;
      break;
    case '#/categories':
      Component = Categories;
      break;
    case '#/recurring':
      Component = RecurringRules;
      break;
    case '#/reserves':
      Component = Reserves;
      break;
    case '#/register': // Redirect authenticated users away from register/login if they try to access it
    case '#/login':
        window.location.hash = '#/';
        Component = Dashboard;
        break;
    case '#/':
    default:
      Component = Dashboard;
      break;
  }

  return (
      <Layout>
          <Component />
      </Layout>
  );
};

const App: React.FC = () => {
  return (
      <Router />
  );
};

export default App;
