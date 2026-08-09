import InterpreterModule from "js-interpreter";
import { Simulation } from "@/engine";
import type {
  EngineCommand,
  EngineConfig,
  GridVariantSpec,
  RunResult,
  SensorQuery,
  Termination,
} from "@/engine";

/**
 * js-interpreter host for generated bunny programs (m3 contract). Runs in
 * Node (authoritative grading) and the browser (optimistic playback) — no
 * DOM usage anywhere. The interpreter sandbox sees exactly the pinned
 * bindings; everything else (Date, Math, network…) simply does not exist
 * inside the sandbox.
 */

// The package ships a webpack UMD bundle: under Node the API arrives on the
// CJS namespace's `default`, in bundlers as a real default export.
type InterpreterClass = typeof InterpreterModule;
const Interpreter: InterpreterClass =
  (InterpreterModule as unknown as { default?: InterpreterClass }).default ??
  InterpreterModule;

/**
 * Interpreter AST-step budget. Distinct from the engine's command budget:
 * this one catches programs that loop forever without executing commands
 * (e.g. `while (!onGoal()) {}` with an empty body).
 */
export const INTERPRETER_STEP_BUDGET = 100_000;

export interface HighlightEntry {
  /**
   * 1-based engine command step at which the highlighted block begins
   * executing: an entry with step N is the block active from command N
   * until the next entry. Control blocks may share a step with the first
   * command block they contain.
   */
  step: number;
  blockId: string;
}

export interface ProgramRun extends RunResult {
  highlights: HighlightEntry[];
}

/** Structural view of the pinned Simulation class shape (test seams). */
export interface SimulationLike {
  execute(cmd: EngineCommand): void;
  sense(q: SensorQuery): boolean;
  finish(termination?: Termination): RunResult;
}

export type SimulationFactory = (
  variant: GridVariantSpec,
  config: EngineConfig,
) => SimulationLike;

const defaultFactory: SimulationFactory = (variant, config) =>
  new Simulation(variant, config);

const TERMINATIONS = new Set<Termination>([
  "COMPLETED",
  "BUMPED",
  "SPLASHED",
  "BUDGET_EXCEEDED",
  "RUNTIME_ERROR",
]);

/**
 * EngineHalt detection by shape rather than identity so injected fake
 * simulations (and cross-realm errors) halt runs just like the real class.
 */
function haltTermination(err: unknown): Termination | null {
  if (!(err instanceof Error)) return null;
  const termination = (err as { termination?: unknown }).termination;
  return typeof termination === "string" &&
    TERMINATIONS.has(termination as Termination)
    ? (termination as Termination)
    : null;
}

/**
 * Execute one generated (runnable) program against one grid variant.
 * Fatal engine events, runtime exceptions, syntax errors and the step
 * budget all resolve to a RunResult — this function never throws.
 */
export function runProgram(
  code: string,
  variant: GridVariantSpec,
  config: EngineConfig,
  createSimulation: SimulationFactory = defaultFactory,
): ProgramRun {
  const sim = createSimulation(variant, config);
  const highlights: HighlightEntry[] = [];
  let commandsExecuted = 0;

  const initFunc = (interpreter: InstanceType<InterpreterClass>, globalObject: unknown) => {
    const bind = (name: string, fn: (...args: unknown[]) => unknown) => {
      interpreter.setProperty(
        globalObject,
        name,
        interpreter.createNativeFunction(fn),
      );
    };
    const command = (cmd: EngineCommand) => {
      sim.execute(cmd);
      commandsExecuted += 1;
    };

    bind("highlight", (blockId) => {
      highlights.push({ step: commandsExecuted + 1, blockId: String(blockId) });
    });
    bind("moveForward", () => command({ type: "moveForward" }));
    bind("turnLeft", () => command({ type: "turnLeft" }));
    bind("turnRight", () => command({ type: "turnRight" }));
    bind("collect", () => command({ type: "collect" }));
    bind("say", (text) => command({ type: "say", text: String(text) }));
    bind("pathAhead", () => sim.sense({ type: "pathAhead" }));
    bind("onGoal", () => sim.sense({ type: "onGoal" }));
  };

  const finishAs = (termination?: Termination): ProgramRun => ({
    ...sim.finish(termination),
    highlights,
  });

  let interpreter: InstanceType<InterpreterClass>;
  try {
    interpreter = new Interpreter(code, initFunc);
  } catch {
    // Syntax error in generated code — infrastructure failure, not gameplay.
    return finishAs("RUNTIME_ERROR");
  }

  let steps = 0;
  try {
    while (interpreter.step()) {
      steps += 1;
      if (steps >= INTERPRETER_STEP_BUDGET) {
        const result = sim.finish("RUNTIME_ERROR");
        result.events.push({
          type: "budgetExceeded",
          step: result.commandCount + 1,
        });
        return { ...result, highlights };
      }
    }
  } catch (err) {
    const termination = haltTermination(err);
    // finish() keeps the simulation's own halted termination when set, so
    // passing RUNTIME_ERROR only labels genuine non-engine exceptions.
    return finishAs(termination ?? "RUNTIME_ERROR");
  }

  return finishAs();
}

/** The subset of a BLOCK_CODING payload the runner needs (schema defaults). */
export interface RunnableLevelConfig {
  variants: GridVariantSpec[];
  autoCollect?: boolean;
  nonFatalBumps?: boolean;
  budgets?: { maxCommands?: number };
}

/** One program, every variant — PASS requires all of them (adjudication). */
export function runProgramAllVariants(
  code: string,
  payload: RunnableLevelConfig,
  createSimulation: SimulationFactory = defaultFactory,
): ProgramRun[] {
  const config: EngineConfig = {
    autoCollect: payload.autoCollect ?? true,
    nonFatalBumps: payload.nonFatalBumps ?? false,
    maxCommands: payload.budgets?.maxCommands ?? 1000,
  };
  return payload.variants.map((variant) =>
    runProgram(code, variant, config, createSimulation),
  );
}
