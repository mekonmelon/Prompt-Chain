const test = require('node:test')
const assert = require('node:assert/strict')
const { swapOrderedStepValues } = require('../lib/studio/reorder.cjs')

test('swapOrderedStepValues swaps step_order between two steps', () => {
  const steps = [
    { id: 'a', step_order: 1 },
    { id: 'b', step_order: 2 },
    { id: 'c', step_order: 3 }
  ]

  const reordered = swapOrderedStepValues(steps, 'a', 'b')

  assert.deepEqual(reordered, [
    { id: 'a', step_order: 2 },
    { id: 'b', step_order: 1 },
    { id: 'c', step_order: 3 }
  ])
})

test('swapOrderedStepValues throws when a step is missing', () => {
  assert.throws(() => swapOrderedStepValues([{ id: 'a', step_order: 1 }], 'a', 'b'))
})
