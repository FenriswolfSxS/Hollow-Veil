import { Routes, Route, Navigate } from 'react-router-dom';
import Entrance from './pages/Entrance';
import Home from './pages/Home';
import Roster from './pages/Roster';
import Events from './pages/Events';
import Profile from './pages/Profile';
import Layout from './components/Layout';

export default function App() {
  return <Routes>
    <Route path="/" element={<Entrance />} />
    <Route element={<Layout />}>
      <Route path="/home" element={<Home />} />
      <Route path="/roster" element={<Roster />} />
      <Route path="/events" element={<Events />} />
      <Route path="/profile" element={<Profile />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
