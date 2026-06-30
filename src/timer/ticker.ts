export class TimerTicker {
  private dispatch: (action: { type: 'tick' }) => void
  private intervalId: number | null = null

  constructor(dispatch: (action: { type: 'tick' }) => void) {
    this.dispatch = dispatch
  }

  public start() {
    if (this.intervalId !== null) {
      return
    }
    this.intervalId = window.setInterval(() => {
      this.dispatch({ type: 'tick' })
    }, 1000)
  }

  public stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
