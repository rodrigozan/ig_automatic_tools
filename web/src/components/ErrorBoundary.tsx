import { Component, type ReactNode } from 'react'
import { ServerErrorPage } from '../pages/ErrorPages'

type State = { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (this.state.error) return <ServerErrorPage onRetry={() => this.setState({ error: null })} />
    return this.props.children
  }
}
