import { AST } from '../../parser';
import O from '../object';

// Format a value for puts() output.
// Strings are displayed without surrounding quotes (unlike inspect()).
const formatPutsValue = (value: O.Obj): string => {
  if (value instanceof O.Str) {
    return value.value;
  }
  return value.inspect();
};

const puts: O.BuiltinFuncTemplate = {
  parameters: [
    {
      kind: AST.ASTKind.RestElement,
      argument: {
        kind: AST.ASTKind.Identifier,
        value: 'values',
      },
    },
  ],
  body: (environment: O.Environment) => {
    environment
      .getIO()
      .output([...environment.getVariable('values').items.map(formatPutsValue)]);
    return O.NIL;
  },
};

const read: O.BuiltinFuncTemplate = {
  parameters: [
    {
      kind: AST.ASTKind.Identifier,
      value: 'path',
    },
  ],
  body: (environment: O.Environment) => {
    return new O.Str(environment.getIO().input(environment.getVariable('path').value));
  },
};

const env: O.BuiltinFuncTemplate = {
  parameters: [],
  body: (environment: O.Environment) => {
    const output = environment.getIO().output;

    // Collect all variables from the environment chain
    const allVariables: { [key: string]: O.Obj } = {};
    let current: O.Environment | null = environment;
    while (current !== null) {
      for (const [name, { value }] of Object.entries(current.variables)) {
        // Don't override - child scope variables take precedence
        if (!(name in allVariables)) {
          allVariables[name] = value;
        }
      }
      current = current.parent;
    }

    output(['Environment:']);
    for (const [name, value] of Object.entries(allVariables)) {
      output([`  ${name} = ${value.inspect()}`]);
    }
    return O.NIL;
  },
};

export default {
  puts,
  read,
  env,
};
