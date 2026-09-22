/**
 * Icon-export guard: DSH 0.1.7 renamed the whole `ui-primitives` icon family
 * from size-suffixed names (`IconCloseFill14`) to weight-suffixed ones
 * (`IconCloseFillRegular` / `…Medium`), deleting the old names outright.
 *
 * Missing exports do not fail at load time here — the client bundle is CJS
 * with `ui-primitives` external, so a missing named export reads as
 * `undefined` and React throws "Element type is invalid" at RENDER time. That
 * is a failure mode no other spec in this repository observes, so this one
 * pins the contract directly: every icon symbol the plugin imports from the
 * package must actually be exported by the installed version.
 *
 * `pnpm typecheck` catches the same thing from the type side; this stays as
 * the runtime-side witness, and as a guard for the symbols that reach the
 * bundle through a re-export rather than a direct import.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

/** The specifier whose named exports the plugin depends on. */
const PACKAGE = '@deepseek-ai/dsh-client-ui-primitives'

/**
 * Every value symbol the repository imports from the primitives package.
 * Type-only imports are ignored: they are erased before the bundle is built
 * and therefore cannot become a missing runtime export.
 * @returns the imported symbol names, deduplicated.
 */
function importedSymbols(): string[] {
  const files = execFileSync('rg', ['-l', PACKAGE, 'src', 'tests'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
  const names = new Set<string>()
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(
      new RegExp(`import\\s+(type\\s+)?\\{([^}]*)\\}\\s+from\\s+['"]${PACKAGE}['"]`, 'g'),
    )) {
      // `import type { … }` imports nothing at runtime.
      if (match[1] !== undefined) continue
      for (const raw of match[2]!.split(',')) {
        const name = raw.trim().replace(/^type\s+/, '')
        if (name === '' || name.startsWith('type ')) continue
        // A per-specifier `type` marker has no runtime counterpart either.
        if (/^type\s/.test(raw.trim())) continue
        names.add(name)
      }
    }
  }
  return [...names].sort()
}

describe('ui-primitives exports', () => {
  const imported = importedSymbols()
  const exported = new Set(Object.keys(primitives as Record<string, unknown>))

  it('finds the plugin\'s import surface at all', () => {
    // A guard on the guard: a regex that silently stopped matching would make
    // the assertion below vacuously true.
    expect(imported.length).toBeGreaterThan(20)
    expect(imported).toContain('FileTypeIcon')
    expect(imported).toContain('MarkdownText')
  })

  it('still exports every icon symbol the plugin imports', () => {
    const missing = imported.filter(name => name.startsWith('Icon') && !exported.has(name))
    expect(missing, `these symbols are imported but not exported by ${PACKAGE}: ${missing.join(', ')}`).toEqual([])
  })

  it('still exports every other value symbol the plugin imports', () => {
    const missing = imported.filter(name => !name.startsWith('Icon') && !exported.has(name))
    expect(missing, `these symbols are imported but not exported by ${PACKAGE}: ${missing.join(', ')}`).toEqual([])
  })

  it('ships no icon whose name still carries the retired size suffix', () => {
    // The rename was wholesale: a `…14` / `…16` name reappearing would mean
    // upstream re-introduced the old scheme and the migration above is stale.
    const sized = [...exported].filter(name => /^Icon[A-Za-z]+(10|12|14|16|20|24)$/.test(name))
    expect(sized).toEqual([])
  })
})
