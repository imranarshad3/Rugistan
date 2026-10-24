import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPage } from '../../lib/api'
import { PageBanner } from '../../components/client/Sections'
import { EmptyState } from '../../components/client/Primitives'
import type { Page } from '../../lib/types'

export default function CmsPage() {
  const { slug = '' } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    void fetchPage(slug).then((found) => {
      if (!active) return
      setPage(found)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    if (page?.meta_title) document.title = page.meta_title
  }, [page?.meta_title])

  if (loading) {
    return (
      <section className="section wrap">
        <div className="skeleton" style={{ height: 320 }} />
      </section>
    )
  }

  if (!page) {
    return (
      <section className="section wrap">
        <EmptyState
          title="Page not found"
          message="This page may have been moved or is not published yet."
          actionLabel="Back to home"
          actionTo="/"
        />
      </section>
    )
  }

  return (
    <>
      <PageBanner
        title={page.hero_heading || page.title}
        description={page.meta_description}
        image={page.hero_image_url || '/assets/rug_lifestyle_2.jpg'}
      />
      <section className="section wrap">
        <div className="cms-content" dangerouslySetInnerHTML={{ __html: page.content }} />
      </section>
    </>
  )
}
