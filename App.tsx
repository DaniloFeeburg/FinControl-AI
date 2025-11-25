import React from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Categories } from './pages/Categories';
import { Reserves } from './pages/Reserves';
import { useStore } from './store';

// Simple router based on hash for SPA compatibility without server configuration
const Router = () => {
  const [route, setRoute] = React.useState(window.location.hash || '#/');
  const fetchAllData = useStore((state) => state.fetchAllData);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  React.useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  let Component;
  switch (route) {
    case '#/transactions':
      Component = Transactions;
      break;
    case '#/categories':
      Component = Categories;
      break;
    case '#/reserves':
      Component = Reserves;
      break;
    case '#/':
    default:
      Component = Dashboard;
      break;
  }

  return <Component />;
};

const App: React.FC = () => {
  return (
    <Layout>
      <Router />
    </Layout>
  );
};

export default App;