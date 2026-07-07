import { Modal, Setting } from 'obsidian'
import type { App } from 'obsidian'

export type RoutineReplaceResult = 'confirmed' | 'cancelled'

/**
 * Confirms replacing the running routine before Start discards its progress.
 * Same "Modal as an awaitable" pattern as WriteBackModal: `waitForResult`
 * both opens the modal and returns the one promise it will ever resolve,
 * regardless of which path (button, Escape, click-outside) closes it.
 */
export class RoutineReplaceModal extends Modal {
  private confirmed = false
  private resolveResult: (result: RoutineReplaceResult) => void = () => {}

  constructor(app: App, private readonly currentRoutineName: string, private readonly nextRoutineName: string) {
    super(app)
  }

  waitForResult(): Promise<RoutineReplaceResult> {
    return new Promise((resolve) => {
      this.resolveResult = resolve
      this.open()
    })
  }

  onOpen(): void {
    this.setTitle('Replace running routine?')
    this.contentEl.createEl('p', {
      text: `"${this.currentRoutineName}" is currently running. Starting "${this.nextRoutineName}" will reset it and its progress will be lost.`,
    })

    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Replace').setCta().onClick(() => this.confirm()))
  }

  onClose(): void {
    this.contentEl.empty()
    if (!this.confirmed) {
      this.resolveResult('cancelled')
    }
  }

  private confirm(): void {
    this.confirmed = true
    this.resolveResult('confirmed')
    this.close()
  }
}
