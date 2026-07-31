import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, Home, LogIn, Menu, Shield, UserRound, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Me = { authenticated: boolean; user?: { username: string; avatarUrl: string; role: string } };

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const navigate = useNavigate();
  const [me, setMe] = useState<Me>({ authenticated: false });
  useEffect(() => { fetch('/api/me').then(r => r.json()).then(setMe).catch(() => {}); }, []);
  const returnToVeil = () => {
    if (returning) return;
    setOpen(false);
    setReturning(true);
    window.setTimeout(() => navigate('/', { state: { escaped: true } }), 3200);
  };
  const links = [
    ['/home', 'Home', Home], ['/roster', 'Roster', Users], ['/events', 'Events', CalendarDays], ['/profile', 'Profile', UserRound],
  ] as const;
  return <div className={`site-shell${returning ? ' is-returning' : ''}`}>
    <div className="mist mist-a"/><div className="mist mist-b"/>
    <button className="nav-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
    <aside className={`shrine-nav ${open ? 'open' : ''}`}>
      <button className="nav-crest" type="button" onClick={returnToVeil} disabled={returning} aria-label="Return to the Hollow Veil landing page"><span>虚紗</span><small>HOLLOW VEIL</small></button>
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
    <div className="escape-transition" aria-hidden="true">
      <svg className="root-net root-net-left" viewBox="0 0 900 900" preserveAspectRatio="none">
        <path d="M-30 820 C110 740 80 570 250 520 C390 480 300 330 470 285 C610 248 545 95 760 35"/>
        <path d="M-20 675 C95 620 150 650 220 555 C280 475 245 405 365 355 C470 310 500 230 570 120"/>
        <path d="M35 900 C90 770 210 785 275 665 C335 555 450 590 515 465 C575 350 690 375 810 250"/>
        <path d="M120 900 C120 810 55 755 165 675 C265 602 170 505 305 430 C420 365 355 250 505 180"/>
        <path d="M0 540 C130 515 85 405 220 350 C355 295 285 180 455 115"/>
      </svg>
      <svg className="root-net root-net-right" viewBox="0 0 900 900" preserveAspectRatio="none">
        <path d="M930 825 C790 745 825 575 650 520 C515 477 590 330 425 282 C285 242 360 92 135 30"/>
        <path d="M920 675 C805 620 748 650 680 555 C620 475 655 405 535 355 C430 310 400 230 330 120"/>
        <path d="M865 900 C810 770 690 785 625 665 C565 555 450 590 385 465 C325 350 210 375 90 250"/>
        <path d="M780 900 C780 810 845 755 735 675 C635 602 730 505 595 430 C480 365 545 250 395 180"/>
        <path d="M900 540 C770 515 815 405 680 350 C545 295 615 180 445 115"/>
      </svg>
      <div className="escape-words">You Tried to Leave</div>
      <div className="escape-flash"/>
    </div>
  </div>;
}
