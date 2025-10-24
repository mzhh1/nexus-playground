import { Routes, Route } from 'react-router-dom';
import { useOAuth } from '@autolabz/oauth-sdk';
import GamePage from './pages/GamePage';
import LoginPage from './pages/LoginPage';

function App() {
  const { isAuthenticated } = useOAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/room/:roomId" element={<GamePage />} />
    </Routes>
  );
}

export default App;

