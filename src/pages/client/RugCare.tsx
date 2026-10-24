import { Link } from 'react-router-dom'
import { Accordion } from '../../components/client/Primitives'
import Icon from '../../components/client/Icon'

const TIPS = [
  ['Regular Cleaning', 'Vacuum your rug 1–2 times a week using a suction-only vacuum (no beater bar) to remove dust and keep fibers fresh.', 'vacuum'],
  ['Stain Care', 'Blot spills immediately with a clean, dry cloth. Use cold water and a mild, pH-neutral soap after testing a hidden area. Avoid harsh chemicals or rubbing.', 'drop'],
  ['Rotate Your Rug', 'Rotate your rug every 3–6 months to ensure even wear, especially in high-traffic and sunlit spaces.', 'rotate'],
  ['Storing Rugs', 'Clean your rug thoroughly before storing. Roll it (don’t fold), wrap in a breathable cotton sheet, and keep in a cool, dry place.', 'box'],
  ['Preserve Wool Quality', 'Keep natural wool away from excessive moisture and direct sunlight to maintain its natural beauty and softness.', 'leaf'],
  ['Deep Cleaning', 'For a deeper clean, consult a professional rug cleaner familiar with your rug’s fibers and construction.', 'spark'],
] as const
const FAQS = [
  ['How often should I vacuum my rug?', 'Vacuum gently once or twice a week with suction only. Avoid a rotating beater bar, and keep the vacuum away from fringes.'],
  ['What’s the best way to remove stains?', 'Blot immediately with a clean, dry cloth. Do not rub. Test a mild wool-safe cleaning solution on a hidden spot first, and ask a professional about persistent stains.'],
  ['Can I use a steam cleaner?', 'Avoid household steam cleaners on handmade wool rugs. Heat and excess water can affect fibers and dyes. Ask a specialist to recommend the right method.'],
  ['How do I store my rug?', 'Make sure it is clean and completely dry, roll rather than fold it, and wrap it in a breathable cotton sheet. Store in a cool, dry place.'],
  ['Will my rug shed?', 'Some shedding is normal with natural wool, particularly when a rug is new. Gentle regular vacuuming helps remove loose fibers.'],
  ['Can I use the rug in high-traffic areas?', 'Choose a construction suited to the room, use a rug pad, and rotate the rug regularly. Contact us for advice on a particular piece.'],
  ['How often should I get my rug professionally cleaned?', 'The right interval depends on traffic, pets and spills. A specialist can assess your rug; many homes benefit from a professional clean every two to three years.'],
  ['What if my rug gets wet?', 'Blot away moisture immediately and dry with good airflow. Avoid direct heat. For a soaked rug, contact a professional promptly.'],
]
function CareIcon({ name }: { name: typeof TIPS[number][2] }) {
  if (name === 'leaf' || name === 'spark') return <Icon name={name} />
  const paths = {
    vacuum: <><path d="m15 3-3 14M10 17h6l3 4H6l4-4ZM14 7l3 1M8 14H5v7H2v-8a3 3 0 0 1 6 0v1Z" /></>,
    drop: <><path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" /><path d="M9 14c-1 3 1 4 3 4" /></>,
    rotate: <><path d="M20 9A8 8 0 0 0 5 6L3 9m0-6v6h6M4 15a8 8 0 0 0 15 3l2-3m0 6v-6h-6" /></>,
    box: <><path d="M4 8h16v13H4zM3 4h18v4H3zM9 12h6" /></>,
  }
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export default function RugCare() {
  return <>
    <section className="care-hero">
      <div className="care-hero-photo care-photo-2" />
      <div className="care-hero-copy">
        <div className="care-crumb"><Link to="/">Home</Link><span>/</span>Rug Care</div>
        <h1>Rug Care</h1>
        <h2>Simple Care for a Longer, More Beautiful Life</h2>
        <p>Our handmade rugs are crafted to be lived with and loved for years. With a little care, your Rugistan rug will continue to bring warmth, beauty and comfort to your home for generations.</p>
        <Link className="btn" to="/shop">Shop Handmade Rugs <Icon name="arrow" /></Link>
      </div>
    </section>
    <section className="care-essentials">
      <h2>Care Essentials</h2>
      <p className="care-intro">Follow these simple steps to keep your Rugistan rug looking beautiful for years to come.</p>
      <div className="care-grid">{TIPS.map(([title, body, icon], i) => <article className="care-card" key={title}>
        <div role="img" aria-label={title} className={`care-card-photo care-photo-${i}`} />
        <div className="care-card-body"><span className="care-icon"><CareIcon name={icon} /></span><h3>{i + 1}. {title}</h3><p>{body}</p></div>
      </article>)}</div>
    </section>
    <section className="care-questions">
      <div className="care-question-heading"><div><h2>Frequently Asked Questions</h2><p>Everything you need to know about caring for your Rugistan rug.</p></div><p>Still have a question? <Link className="inline-link" to="/contact?topic=Rug%20care">Contact Us →</Link></p></div>
      <div className="care-faq-grid">{[FAQS.slice(0,4), FAQS.slice(4)].map((column,i)=><div key={i}>{column.map(([q,a])=><Accordion title={q} key={q}><p>{a}</p></Accordion>)}</div>)}</div>
      <div className="care-support"><svg width="72" height="72" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 35v-5a21 21 0 0 1 42 0v9M11 27H8a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h7V27h-4Zm42 0h3a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-7V27h4ZM53 47c0 8-9 10-17 10" /><rect x="27" y="54" width="10" height="6" rx="3" /></svg><div><div className="eyebrow">WE’RE HERE TO HELP</div><h3>Need More Advice?</h3><p>Our team is happy to help with personalized care<br className="desktop-only" /> recommendations for your Rugistan rug.</p></div><div className="care-support-action"><Link className="btn" to="/contact?topic=Rug%20care"><Icon name="mail" /> Contact Support <Icon name="arrow" /></Link><small>Let’s find the right care for your rug.</small></div></div>
      <h3 className="care-gallery-heading">More Inspiration for a Beautiful Home</h3>
      <div className="care-gallery">{[4,2,0,5,3,2].map((position,i)=><Link to="/collections" aria-label="Explore rug collections" className={`care-photo-${position}`} key={i} />)}</div>
    </section>
  </>
}
