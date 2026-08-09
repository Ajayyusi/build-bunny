/**
 * Minimal typings for the untyped "js-interpreter" package (Neil Fraser's
 * JS-Interpreter, webpack-bundled). Only the surface the interpreter host
 * uses is declared.
 */
declare module "js-interpreter" {
  type InterpreterValue = unknown;

  class Interpreter {
    constructor(
      code: string,
      initFunc?: (interpreter: Interpreter, globalObject: InterpreterValue) => void,
    );

    /** Executes one AST step; false when the program has finished. */
    step(): boolean;

    /** Runs to completion (or first blocking async call); true if blocked. */
    run(): boolean;

    createNativeFunction(
      fn: (...args: InterpreterValue[]) => InterpreterValue,
    ): InterpreterValue;

    setProperty(
      object: InterpreterValue,
      name: string,
      value: InterpreterValue,
    ): void;

    value: InterpreterValue;
  }

  export default Interpreter;
}
