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
      <svg className="root-net root-net-left" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <filter id="rootBarkLeft" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.09" numOctaves="3" seed="17" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G"/>
            <feGaussianBlur stdDeviation="0.35"/>
          </filter>
        </defs>
        <g className="root-cluster" filter="url(#rootBarkLeft)">
          <path className="root-main" d="M-90 930 C60 860 90 720 185 645 C280 570 275 450 390 385 C500 320 515 205 690 115 C790 65 875 35 1015 -10"/>
          <path className="root-main root-main-thin" d="M-70 760 C60 735 118 650 180 560 C240 475 330 460 405 370 C480 278 515 180 625 80"/>
          <path className="root-main root-main-dark" d="M-40 1015 C30 900 145 870 235 790 C325 705 330 620 455 555 C575 495 620 390 745 325 C840 275 910 200 1015 110"/>
          <path className="root-branch" d="M185 645 C140 570 80 535 15 520"/>
          <path className="root-branch" d="M270 560 C235 490 180 448 112 430"/>
          <path className="root-branch" d="M390 385 C330 332 288 265 265 195"/>
          <path className="root-branch" d="M500 320 C455 245 455 175 485 105"/>
          <path className="root-branch" d="M690 115 C670 70 655 30 665 -25"/>
          <path className="root-fine" d="M235 790 C165 820 125 865 90 925"/>
          <path className="root-fine" d="M455 555 C402 590 375 635 355 700"/>
          <path className="root-fine" d="M625 390 C580 350 565 300 575 240"/>
          <path className="root-fine" d="M745 325 C715 260 725 205 770 145"/>
          <path className="root-fine" d="M405 370 C380 300 390 240 430 185"/>
          <path className="root-fine" d="M180 560 C115 595 72 648 38 710"/>
        </g>
      </svg>
      <svg className="root-net root-net-right" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <filter id="rootBarkRight" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.085" numOctaves="3" seed="29" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="20" xChannelSelector="R" yChannelSelector="G"/>
            <feGaussianBlur stdDeviation="0.35"/>
          </filter>
        </defs>
        <g className="root-cluster" filter="url(#rootBarkRight)">
          <path className="root-main" d="M1090 930 C940 860 910 720 815 645 C720 570 725 450 610 385 C500 320 485 205 310 115 C210 65 125 35 -15 -10"/>
          <path className="root-main root-main-thin" d="M1070 760 C940 735 882 650 820 560 C760 475 670 460 595 370 C520 278 485 180 375 80"/>
          <path className="root-main root-main-dark" d="M1040 1015 C970 900 855 870 765 790 C675 705 670 620 545 555 C425 495 380 390 255 325 C160 275 90 200 -15 110"/>
          <path className="root-branch" d="M815 645 C860 570 920 535 985 520"/>
          <path className="root-branch" d="M730 560 C765 490 820 448 888 430"/>
          <path className="root-branch" d="M610 385 C670 332 712 265 735 195"/>
          <path className="root-branch" d="M500 320 C545 245 545 175 515 105"/>
          <path className="root-branch" d="M310 115 C330 70 345 30 335 -25"/>
          <path className="root-fine" d="M765 790 C835 820 875 865 910 925"/>
          <path className="root-fine" d="M545 555 C598 590 625 635 645 700"/>
          <path className="root-fine" d="M375 390 C420 350 435 300 425 240"/>
          <path className="root-fine" d="M255 325 C285 260 275 205 230 145"/>
          <path className="root-fine" d="M595 370 C620 300 610 240 570 185"/>
          <path className="root-fine" d="M820 560 C885 595 928 648 962 710"/>
        </g>
      </svg>
      <div className="escape-words">You Tried to Leave</div>
      <div className="escape-flash"/>
    </div>
  </div>;
}
