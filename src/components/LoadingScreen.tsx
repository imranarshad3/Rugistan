import './loading-screen.css'
export default function LoadingScreen({ studio = false }: { studio?: boolean }) {
 return <div className="rugistan-loading" role="status" aria-live="polite"><div className="loading-center"><div className="loading-woven" aria-hidden="true"><span/><span/><span/></div><div className="loading-wordmark">Rugistan</div><div className="loading-tagline">HANDMADE RUGS</div><div className="loading-rule" aria-hidden="true"/><p>{studio ? 'Preparing your studio' : 'A little beauty is on its way'}</p><span className="loading-caption">{studio ? 'Your store, thoughtfully managed.' : 'Natural textures. Timeless craftsmanship.'}</span><div className="loading-track" aria-hidden="true"><span/></div></div><div className="loading-footer">CRAFTED WITH CARE · RUGISTAN</div></div>
}
