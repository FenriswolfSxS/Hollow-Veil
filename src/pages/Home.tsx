import { CalendarDays, Moon, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function Home(){return <section className="page home-page">
  <header className="hero-panel ornamental"><div className="moon-seal"><Moon/></div><p className="eyebrow">虚紗 · Hollow Veil Free Company</p><h1>The forest remembers.</h1><p>Beyond the last torii lies a home for the lost, the weary, and those searching for something they cannot name.</p></header>
  <div className="feature-grid">
    <Link className="feature-card" to="/roster"><Users/><h2>The Remembered</h2><p>Walk among the names claimed by the Veil.</p></Link>
    <Link className="feature-card" to="/events"><CalendarDays/><h2>Gatherings</h2><p>Plan ceremonies, raids, maps, and nights beneath the moon.</p></Link>
    <div className="feature-card"><Moon/><h2>The Hollow Path</h2><p>Lore, guides, and member stories will live here next.</p></div>
  </div>
  <section className="lore-strip"><span>“Together, we walk the path that never ends.”</span></section>
</section>}
