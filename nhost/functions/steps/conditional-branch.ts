export interface ConditionalBranchConfig {
  field?: string;
  operator?: 'contains' | 'equals' | 'exists';
  value?: any;
  then_skip_to?: number | null;
  else_skip_to?: number | null;
}

export interface ConditionalBranchResult {
  output: {
    result: boolean;
    evaluated_field: string;
    operator: string;
    value: any;
    skip_to: number | null;
  };
  skip_to_order: number | null;
}

export function executeConditionalBranch(
  config: ConditionalBranchConfig,
  previousStepOutput?: any
): ConditionalBranchResult {
  if (previousStepOutput === undefined || previousStepOutput === null) {
    throw new Error('Conditional branch step failed: No previous step output available to evaluate');
  }

  const field = config.field || 'response';
  const operator = config.operator || 'contains';
  const targetValue = config.value !== undefined ? config.value : '';

  let fieldValue: any = undefined;
  if (typeof previousStepOutput === 'object' && previousStepOutput !== null) {
    fieldValue = previousStepOutput[field] !== undefined ? previousStepOutput[field] : previousStepOutput;
  } else {
    fieldValue = previousStepOutput;
  }

  let evaluationResult = false;

  if (operator === 'contains') {
    const hay = typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue || '');
    const needle = String(targetValue);
    evaluationResult = hay.toLowerCase().includes(needle.toLowerCase());
  } else if (operator === 'equals') {
    evaluationResult = String(fieldValue) === String(targetValue);
  } else if (operator === 'exists') {
    evaluationResult = fieldValue !== undefined && fieldValue !== null;
  }

  const skipToOrder = evaluationResult
    ? (config.then_skip_to !== undefined && config.then_skip_to !== null ? config.then_skip_to : null)
    : (config.else_skip_to !== undefined && config.else_skip_to !== null ? config.else_skip_to : null);

  return {
    output: {
      result: evaluationResult,
      evaluated_field: field,
      operator,
      value: targetValue,
      skip_to: skipToOrder
    },
    skip_to_order: skipToOrder
  };
}
