import { mock, test, expect, describe } from 'bun:test'
import type { FileMutation } from '../src/domain/mutation/file-mutation'
import { TaskQueueItemIdSchema } from '../src/domain/queue/task-source'
import { ObsidianFileMutationPort } from '../src/timer/obsidian-file-mutation-port'
import type { ObsidianFileMutationPortDeps, VaultFile } from '../src/timer/obsidian-file-mutation-port'

const itemId = TaskQueueItemIdSchema.parse('item-1')

const fakeFile = (path: string): VaultFile => ({ path })

// bun-types' `Matchers.toThrow()` is declared to return `void` even under
// `.rejects`, so `await expect(promise).rejects.toThrow()` trips
// `@typescript-eslint/await-thenable`. Await the promise's own outcome instead.
async function expectToReject(promise: Promise<unknown>): Promise<void> {
  const settled = await promise.then(() => 'resolved' as const, () => 'rejected' as const)
  expect(settled).toBe('rejected')
}

function createFakeDeps(file: VaultFile | null) {
  const getFileByPath = mock((_path: string) => file)
  const append = mock(async (_file: VaultFile, _data: string) => {})
  let writtenFrontmatter: Record<string, unknown> | undefined
  const processFrontMatter = mock(async (_file: VaultFile, fn: (frontmatter: Record<string, unknown>) => void) => {
    const frontmatter: Record<string, unknown> = {}
    fn(frontmatter)
    writtenFrontmatter = frontmatter
  })
  const deps: ObsidianFileMutationPortDeps = {
    vault: { getFileByPath, append },
    fileManager: { processFrontMatter },
  }
  return { deps, getFileByPath, append, processFrontMatter, getWrittenFrontmatter: () => writtenFrontmatter }
}

const frontmatterMutation = {
  kind: 'frontmatter',
  filePath: 'task.md',
  property: 'pomodoros',
  value: 1,
} as const satisfies FileMutation

const appendMutation = {
  kind: 'append',
  filePath: 'daily-note.md',
  text: '- Completed a focus phase',
} as const satisfies FileMutation

const reorderMutation = {
  kind: 'queueReorder',
  itemId,
  position: 'back',
} as const satisfies FileMutation

const statusChangeMutation = {
  kind: 'queueStatusChange',
  itemId,
  status: 'done',
} as const satisfies FileMutation

describe('ObsidianFileMutationPort', () => {
  test('writeFrontmatter sets the property on the resolved file', async () => {
    const file = fakeFile('task.md')
    const { deps, processFrontMatter, getWrittenFrontmatter } = createFakeDeps(file)
    const port = new ObsidianFileMutationPort(deps)

    await port.writeFrontmatter(frontmatterMutation)

    expect(processFrontMatter).toHaveBeenCalledTimes(1)
    expect(processFrontMatter.mock.calls[0]?.[0]).toBe(file)
    expect(getWrittenFrontmatter()).toEqual({ pomodoros: 1 })
  })

  test('writeFrontmatter rejects when the path does not resolve to a file', async () => {
    const { deps, processFrontMatter } = createFakeDeps(null)
    const port = new ObsidianFileMutationPort(deps)

    await expectToReject(port.writeFrontmatter(frontmatterMutation))
    expect(processFrontMatter).not.toHaveBeenCalled()
  })

  test('appendText appends text on the resolved file', async () => {
    const file = fakeFile('daily-note.md')
    const { deps, append } = createFakeDeps(file)
    const port = new ObsidianFileMutationPort(deps)

    await port.appendText(appendMutation)

    expect(append).toHaveBeenCalledTimes(1)
    expect(append).toHaveBeenCalledWith(file, appendMutation.text)
  })

  test('appendText rejects when the path does not resolve to a file', async () => {
    const { deps, append } = createFakeDeps(null)
    const port = new ObsidianFileMutationPort(deps)

    await expectToReject(port.appendText(appendMutation))
    expect(append).not.toHaveBeenCalled()
  })

  test('reorderQueueItem always rejects', async () => {
    const { deps } = createFakeDeps(fakeFile('irrelevant.md'))
    const port = new ObsidianFileMutationPort(deps)

    await expectToReject(port.reorderQueueItem(reorderMutation))
  })

  test('changeQueueItemStatus always rejects', async () => {
    const { deps } = createFakeDeps(fakeFile('irrelevant.md'))
    const port = new ObsidianFileMutationPort(deps)

    await expectToReject(port.changeQueueItemStatus(statusChangeMutation))
  })
})
