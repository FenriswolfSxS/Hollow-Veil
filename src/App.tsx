import { Routes, Route, Navigate } from 'react-router-dom';
import Entrance from './pages/Entrance';
import Home from './pages/Home';
import Roster from './pages/Roster';
import Events from './pages/Events';
import Profile from './pages/Profile';
import Forum from './pages/Forum';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Layout from './components/Layout';
import EmberField from './components/EmberField';
import { GlobalMusicProvider } from './components/GlobalMusic';
import { RitualProvider } from './ritual/RitualContext';
import RitualStage from './ritual/RitualStage';
import './ritual/ritual.css';

export default function App() {
  return <GlobalMusicProvider>
    <RitualProvider>
      <EmberField />
      <Routes>
        <Route path="/" element={<Entrance />} />
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/events" element={<Events />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RitualStage />
    </RitualProvider>
  </GlobalMusicProvider>;
}
