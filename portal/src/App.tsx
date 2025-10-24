import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamesPage from './pages/GamesPage';
import ProfilePage from './pages/ProfilePage';
import CallbackPage from './pages/CallbackPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="lobby" element={<LobbyPage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="/callback" element={<CallbackPage />} />
    </Routes>
  );
}

export default App;


