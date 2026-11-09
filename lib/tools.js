// Tools Gideon can call while answering. These run the same published-standard checks
// a pack check runs, so a number read out on a call gets the real calculation rather
// than a model's attempt at the arithmetic.
import { checkImo, checkContainer, checkIban, checkBic, checkLei, checkAbn, checkAcn, checkIncoterm } from '../shared/checks.js';

const CHECKS = {
  imo: checkImo,
  container: checkContainer,
  iban: checkIban,
  bic: checkBic,
  lei: checkLei,
  abn: checkAbn,
  acn: checkAcn,
  incoterm: checkIncoterm,
};

export const CHECK_TOOL = {
  name: 'check_identifier',
  description: 'Runs the published check for a trade identifier: an IMO ship number, an ISO 6346 container number, an IBAN, a SWIFT or BIC code, an LEI, an Australian ABN or ACN, or an Incoterm. Use it whenever someone gives you one of these and asks about it, or when one matters to your answer, instead of working out the check digit yourself. A pass only means the number is well formed. It never proves the vessel, container, account or company exists, so say so.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: Object.keys(CHECKS), description: 'Which kind of identifier this is.' },
      value: { type: 'string', description: 'The identifier exactly as given.' },
    },
    required: ['kind', 'value'],
    additionalProperties: false,
  },
  eager_input_streaming: true,
};

export function runCheckTool(block) {
  const { kind, value } = block.input || {};
  if (!Object.hasOwn(CHECKS, kind) || typeof value !== 'string' || !value.trim() || value.length > 80) {
    return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: 'Invalid input: kind must be one of the listed kinds, and value must be the identifier as a short string.' };
  }
  return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(CHECKS[kind](value)) };
}
