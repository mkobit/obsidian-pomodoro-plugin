/** The subset of the interval timer API TimerTicker needs, swappable in tests without touching the real `window`. */
export interface TickerTimers {
  readonly setInterval: (callback: () => void, delayMs: number) => number
  readonly clearInterval: (id: number) => void
}

const windowTimers: TickerTimers = {
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: id => window.clearInterval(id),
}

export class TimerTicker {
  private dispatch: (action: { type: 'tick' }) => void
  private intervalId: number | null = null
  private readonly timers: TickerTimers

  constructor(dispatch: (action: { type: 'tick' }) => void, timers: TickerTimers = windowTimers) {
    this.dispatch = dispatch
    this.timers = timers
  }

  public start() {
    if (this.intervalId !== null) {
      return
    }
    this.intervalId = this.timers.setInterval(() => {
      this.dispatch({ type: 'tick' })
    }, 1000)
  }

  public stop() {
    if (this.intervalId !== null) {
      this.timers.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
