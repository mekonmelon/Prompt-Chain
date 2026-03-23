import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from '/root/.nvm/versions/node/v22.21.1/lib/node_modules/typescript/lib/typescript.js'

function loadPromptChainModule() {
  const filePath = path.resolve('lib/prompt-chain.ts')
  const source = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    fileName: filePath
  }).outputText

  const module = { exports: {} }
  const context = vm.createContext({ module, exports: module.exports, require, console })
  const script = new vm.Script(transpiled, { filename: filePath })
  script.runInContext(context)
  return module.exports
}

const require = createRequire(import.meta.url)

const promptChain = loadPromptChainModule()

test('hasStudioAccess allows superadmins and matrix admins only', () => {
  assert.equal(promptChain.hasStudioAccess({ is_superadmin: true }), true)
  assert.equal(promptChain.hasStudioAccess({ is_matrix_admin: true }), true)
  assert.equal(promptChain.hasStudioAccess({ is_superadmin: false, is_matrix_admin: false }), false)
  assert.equal(promptChain.hasStudioAccess(null), false)
})

test('moveItem and resequenceRows preserve deterministic step ordering', () => {
  const rows = [
    { id: 'a', step_order: 1 },
    { id: 'b', step_order: 2 },
    { id: 'c', step_order: 3 }
  ]

  const moved = promptChain.moveItem(rows, 2, 0)
  const resequenced = promptChain.resequenceRows(moved, 'step_order')

  assert.equal(
    JSON.stringify(resequenced.map((row) => ({ id: row.id, step_order: row.step_order }))),
    JSON.stringify([
      { id: 'c', step_order: 1 },
      { id: 'a', step_order: 2 },
      { id: 'b', step_order: 3 }
    ])
  )
})

test('normalizeApiCaptions accepts array and nested payload formats', () => {
  const direct = promptChain.normalizeApiCaptions([{ id: 1, caption_text: 'alpha', image_url: 'https://example.com/a.jpg' }])
  const nested = promptChain.normalizeApiCaptions({ captions: [{ id: 2, content: 'beta' }] })

  assert.equal(direct[0].caption, 'alpha')
  assert.equal(direct[0].imageUrl, 'https://example.com/a.jpg')
  assert.equal(nested[0].caption, 'beta')
})
