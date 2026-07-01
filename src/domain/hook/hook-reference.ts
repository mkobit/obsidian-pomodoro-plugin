import { z } from 'zod'

/**
 * Name of a hook resolved via a HookRegistry (name -> function). Never eval'd
 * from settings/frontmatter — always a lookup against code the plugin (or a
 * registering third party) actually shipped.
 */
export const HookNameSchema = z.string().min(1).brand<'HookName'>()
export type HookName = z.infer<typeof HookNameSchema>

/**
 * A reference to a hook plus the parameters to invoke it with, embeddable on
 * a Phase (onEnter/onComplete/onSkip/onExit) or a PhaseTransition (custom
 * condition predicate) without pulling in the full Hook/HookContext types —
 * keeps Phase from cyclically depending on the hook execution model.
 */
export const HookReferenceSchema = z.object({
  name: HookNameSchema,
  params: z.record(z.string(), z.unknown()).readonly(),
}).readonly()

export type HookReference = z.infer<typeof HookReferenceSchema>
