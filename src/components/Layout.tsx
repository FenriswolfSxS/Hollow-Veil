import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Home, LogIn, Menu, Shield, UserRound, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Me = { authenticated: boolean; user?: { username: string; avatarUrl: string; role: string } };

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me>({ authenticated: false });
  useEffect(() => { fetch('/api/me').then(r => r.json()).then(setMe).catch(() => {}); }, []);
  const links = [
    ['/home', 'Home', Home], ['/roster', 'Roster', Users], ['/events', 'Events', CalendarDays], ['/profile', 'Profile', UserRound],
  ] as const;
  return <div className="site-shell">
    <div className="mist mist-a"/><div className="mist mist-b"/>
    <button className="nav-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
    <aside className={`shrine-nav ${open ? 'open' : ''}`}>
      <div className="nav-crest"><span>虚紗</span><small>HOLLOW VEIL</small></div>
      <nav>{links.map(([to,label,Icon]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="account-card">
        {me.authenticated && me.user ? <>
          <img src={me.user.avatarUrl} alt="Profile" />
          <div><strong>{me.user.username}</strong><small>{me.user.role}</small></div>
          <a className="icon-link" href="/api/auth/logout" title="Log out"><Shield size={18}/></a>
        </> : <a className="login-link" href="/api/auth/discord"><LogIn size={18}/> Enter the Veil</a>}
      </div>
    </aside>
    <main className="site-main"><Outlet /></main>
  </div>;
}
