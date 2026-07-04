import { Modal, Setting, AbstractInputSuggest } from 'obsidian'
import type { App, TFile } from 'obsidian'
import type { WriteBackFormValues, WriteBackPromptPort, WriteBackPromptResult } from '../domain/mutation/write-back-prompt'
import { coerceWriteBackValue } from '../domain/mutation/write-back-prompt'

/** Vault-wide file suggest, not limited to LogTargetResolverRegistry-resolvable paths (see design.md decision 3). */
class VaultFileSuggest extends AbstractInputSuggest<TFile> {
  getSuggestions(query: string): TFile[] {
    const q = query.trim().toLowerCase()
    return this.app.vault.getFiles().filter(file => file.path.toLowerCase().includes(q))
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path)
  }
}

/**
 * Prompts the user to confirm or edit a write-back's resolved defaults
 * before anything is applied. A `Modal` instance is single-use (can't be
 * reopened after `close()`), so `waitForResult` both opens it and returns
 * the one promise it will ever resolve — see design.md decision 2.
 */
export class WriteBackModal extends Modal {
  private submitted = false
  private resolveResult: (result: WriteBackPromptResult) => void = () => {}
  private filePath: string
  private property: string
  private rawValue: string

  constructor(app: App, defaults: WriteBackFormValues) {
    super(app)
    this.filePath = defaults.filePath
    this.property = defaults.property
    this.rawValue = String(defaults.value)
  }

  waitForResult(): Promise<WriteBackPromptResult> {
    return new Promise((resolve) => {
      this.resolveResult = resolve
      this.open()
    })
  }

  onOpen(): void {
    this.setTitle('Confirm write-back')

    new Setting(this.contentEl)
      .setName('File')
      .addText((text) => {
        text.setValue(this.filePath).onChange((value) => {
          this.filePath = value
        })
        const suggest = new VaultFileSuggest(this.app, text.inputEl)
        suggest.onSelect((file) => {
          text.setValue(file.path)
          this.filePath = file.path
          suggest.close()
        })
      })

    new Setting(this.contentEl)
      .setName('Property')
      .addText(text => text.setValue(this.property).onChange((value) => { this.property = value }))

    new Setting(this.contentEl)
      .setName('Value')
      .addText(text => text.setValue(this.rawValue).onChange((value) => { this.rawValue = value }))

    new Setting(this.contentEl)
      .addButton(button => button.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(button => button.setButtonText('Submit').setCta().onClick(() => this.submit()))
  }

  onClose(): void {
    this.contentEl.empty()
    if (!this.submitted) {
      this.resolveResult({ kind: 'cancelled' })
    }
  }

  private submit(): void {
    this.submitted = true
    this.resolveResult({
      kind: 'submitted',
      values: {
        filePath: this.filePath,
        property: this.property,
        value: coerceWriteBackValue(this.rawValue),
      },
    })
    this.close()
  }
}

/** Real, Obsidian-backed WriteBackPromptPort. Constructs a fresh WriteBackModal per call since a Modal is single-use. */
export class ObsidianWriteBackPromptPort implements WriteBackPromptPort {
  constructor(private readonly app: App) {}

  prompt(defaults: WriteBackFormValues): Promise<WriteBackPromptResult> {
    return new WriteBackModal(this.app, defaults).waitForResult()
  }
}
