import { sanitizeHtml } from '../../lib/html'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchBanners, fetchPage } from '../../lib/api'
import {
  PageBanner,
  PhilosophyBand,
  ProcessSteps,
} from '../../components/client/Sections'
import type { Banner, Page } from '../../lib/types'

const PROCESS: [string, string, string][] = [
  ['01', 'Material Selection', 'Natural fibers chosen for texture and character.'],
  ['02', 'Color & Design', 'A considered palette brings the design together.'],
  ['03', 'Hand Weaving', 'Patient work brings every pattern to life.'],
  ['04', 'Finishing', 'Careful finishing brings out the texture.'],
  ['05', 'A Timeless Rug', 'Ready for a home and a life of its own.'],
]

export default function OurStory() {
  const [page, setPage] = useState<Page | null>(null)
  const [banners, setBanners] = useState<Record<string, Banner>>({})

  useEffect(() => {
    void fetchPage('our-story').then(setPage).catch(() => setPage(null))
    void fetchBanners().then(setBanners)
  }, [])

  const heroImage = page?.hero_image_url || '/assets/rug_handmade_blue.jpg'

  return (
    <>
      <PageBanner
        title={page?.hero_heading || 'A Story Woven by Hand'}
        cta="Our Philosophy"
        ctaTo="#our-philosophy"
        description="More than beautiful interiors: a celebration of patient craftsmanship and timeless design."
        image={heroImage}
      />

      <div className="storyband" id="our-philosophy">
        <img src={banners.home_hero?.image_url || '/assets/rug-living-hero.webp'} alt="" aria-hidden="true" />
        <div className="storycopy">
          <div className="eyebrow">OUR STORY</div>
          {page?.content ? (
            <div className="cms" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }} />
          ) : (
            <>
              <h2>Rooted in Heritage, Made for Modern Homes</h2>
              <p>
                Rugistan brings together authentic textures, expressive patterns, and natural materials in pieces that
                enrich everyday life.
              </p>
            </>
          )}
          <Link className="btn" to="/shop">
            Browse the Collection →
          </Link>
        </div>
      </div>

      <section className="section wrap story-foundations">
        <div className="foundation-grid">
          {[
            ['The Beauty of Natural Materials', 'Texture, warmth and character begin with the fibers that make up every rug.', 'foundation-wool', '/shop?material=Natural%20Wool'],
            ['Time-Honored Craftsmanship', 'Patient hands bring patterns to life, one considered detail at a time.', 'foundation-hands', '/shop'],
            ['A Naturally Rich Palette', 'Quiet neutrals and expressive blues create a foundation for individual spaces.', 'foundation-palette', '/collections'],
            ['Designed for Generations', 'Thoughtful design and careful everyday care help your rug become part of your story.', 'foundation-rugs', '/rug-care'],
          ].map(([title,body,photo,to])=><article key={title}><div className={`foundation-photo ${photo}`} role="img" aria-label={title}/><h3>{title}</h3><p>{body}</p><Link className="inline-link" to={to}>Discover More →</Link></article>)}
        </div>
      </section>

      <div className="storyband">
        <div className="storycopy">
          <div className="eyebrow">OUR HERITAGE</div>
          <h2>
            A Legacy That Lives On
          </h2>
          <p>
            Thoughtful material selection, careful weaving and hand finishing define the character of each rug.
          </p>
        </div>
        <div className="heritage-photo" role="img" aria-label="An artisan working at a traditional loom" />
      </div>

      <section className="section wrap cream" id="process">
        <div className="eyebrow">THE MAKING OF A RUG</div>
        <h2 style={{ marginBottom: 25 }}>A Thoughtful Process</h2>
        <ProcessSteps steps={PROCESS} />
      </section>

      <PhilosophyBand />
    </>
  )
}
