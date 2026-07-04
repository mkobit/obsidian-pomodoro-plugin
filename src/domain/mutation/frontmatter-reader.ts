/**
 * Reads a file's current frontmatter value at a given property. Kept
 * separate from FileMutationPort — reading isn't a mutation intent (see
 * design.md decision 3 for why FileMutationPort itself doesn't gain a read
 * method).
 */
export interface FrontmatterReader {
  readonly readValue: (filePath: string, property: string) => unknown
}
