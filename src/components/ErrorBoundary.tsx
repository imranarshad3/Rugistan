import { Component, type ReactNode } from 'react'
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="app-recovery" role="alert"><div className="eyebrow">RUGISTAN</div><h1>Let’s get you back home.</h1><p>This page could not load. Refresh to try again.</p><button className="btn" type="button" onClick={() => window.location.reload()}>Refresh page</button><a href="/">Return to store</a></main>
    return this.props.children
  }
}
