import { EmptyState } from '../../components/client/Primitives'

export default function NotFound() {
  return (
    <section className="section wrap" style={{ paddingTop: 90, paddingBottom: 90 }}>
      <EmptyState
        title="404 — Page not found"
        message="The page you were looking for has moved or no longer exists."
        actionLabel="Back to home"
        actionTo="/"
      />
    </section>
  )
}
