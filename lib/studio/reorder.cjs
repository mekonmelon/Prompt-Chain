function swapOrderedStepValues(steps, sourceId, targetId) {
  const source = steps.find((step) => step.id === sourceId)
  const target = steps.find((step) => step.id === targetId)

  if (!source || !target) {
    throw new Error('Both source and target steps are required to reorder.')
  }

  return steps.map((step) => {
    if (step.id === sourceId) return { ...step, step_order: target.step_order }
    if (step.id === targetId) return { ...step, step_order: source.step_order }
    return step
  })
}

module.exports = {
  swapOrderedStepValues
}
