import {
  DIRECTION_DELTAS,
  TURN_LEFT,
  TURN_RIGHT,
  parseGrid,
  type ParsedGrid,
  type TileChar,
} from "./grid";
import type {
  EngineCommand,
  EngineConfig,
  EngineEvent,
  GridVariantSpec,
  Pose,
  RunResult,
  SensorQuery,
  Termination,
} from "./types";

/** Stamped on every ActivityAttempt so replays can pin exact semantics. */
export const ENGINE_VERSION = "1.0.0";

/**
 * Thrown by execute() on fatal events (bump / splash / budget). The command
 * runner catches it and calls finish(halt.termination) — control flow, not
 * an error condition, hence the dedicated class.
 */
export class EngineHalt extends Error {
  constructor(public termination: Termination) {
    super(`Engine halted: ${termination}`);
    this.name = "EngineHalt";
  }
}

/**
 * The pure grid-world simulation (adjudicated semantics, m3-contracts):
 * end-state goal · auto-collect vs explicit collect (+ non-fatal
 * collectFail) · fatal bump/splash/budget · sensors free of budget cost.
 * All state is derived from constructor inputs — fully deterministic.
 */
export class Simulation {
  private readonly grid: ParsedGrid;
  private readonly config: EngineConfig;
  private pose: Pose;
  private readonly events: EngineEvent[] = [];
  private readonly collectedKeys = new Set<string>();
  private readonly sayOutputs: string[] = [];
  private commandCount = 0;
  private halted: Termination | null = null;
  private goalEmitted = false;

  constructor(variant: GridVariantSpec, config: EngineConfig) {
    this.grid = parseGrid(variant.rows);
    const { x, y } = variant.start;
    if (x < 0 || y < 0 || x >= this.grid.width || y >= this.grid.height) {
      throw new Error(`Simulation: start (${x},${y}) outside the grid`);
    }
    this.config = config;
    this.pose = { ...variant.start };
    this.events.push({ type: "start", pose: { ...this.pose } });
  }

  /** Throws EngineHalt on fatal events; every command costs 1 budget unit. */
  execute(cmd: EngineCommand): void {
    if (this.halted) throw new EngineHalt(this.halted);
    // The budget-breaking command is rejected before it runs: commandCount
    // only ever counts executed commands, but the event step names the
    // offender so feedback can point at it.
    if (this.commandCount + 1 > this.config.maxCommands) {
      this.events.push({ type: "budgetExceeded", step: this.commandCount + 1 });
      this.halt("BUDGET_EXCEEDED");
    }
    this.commandCount += 1;
    const step = this.commandCount;

    switch (cmd.type) {
      case "moveForward":
        this.moveForward(step);
        break;
      case "turnLeft":
        this.pose = { ...this.pose, dir: TURN_LEFT[this.pose.dir] };
        this.events.push({ type: "turn", dir: "left", pose: { ...this.pose }, step });
        break;
      case "turnRight":
        this.pose = { ...this.pose, dir: TURN_RIGHT[this.pose.dir] };
        this.events.push({ type: "turn", dir: "right", pose: { ...this.pose }, step });
        break;
      case "collect":
        this.explicitCollect(step);
        break;
      case "say":
        this.sayOutputs.push(cmd.text);
        this.events.push({ type: "say", text: cmd.text, step });
        break;
    }
  }

  /** Sensors are value blocks: no budget cost, never fatal. */
  sense(q: SensorQuery): boolean {
    switch (q.type) {
      case "pathAhead": {
        const delta = DIRECTION_DELTAS[this.pose.dir];
        const tile = this.tileAt(this.pose.x + delta.dx, this.pose.y + delta.dy);
        // Water is fatal terrain, so it does NOT count as a walkable path.
        return tile !== null && tile !== "#" && tile !== "W";
      }
      case "onGoal":
        return this.tileAt(this.pose.x, this.pose.y) === "G";
    }
  }

  /**
   * Ends the run and evaluates the end-state goal rule: reachedGoal only
   * when the run COMPLETED with the final pose on "G" (pass-through never
   * counts). A halted simulation keeps its own termination regardless of
   * the argument; RUNTIME_ERROR passed by the interpreter wins otherwise.
   */
  finish(termination: Termination = "COMPLETED"): RunResult {
    const effective = this.halted ?? termination;
    const reachedGoal =
      effective === "COMPLETED" && this.tileAt(this.pose.x, this.pose.y) === "G";
    if (reachedGoal && !this.goalEmitted) {
      this.events.push({ type: "goal", step: this.commandCount });
      this.goalEmitted = true;
    }
    return {
      events: [...this.events],
      termination: effective,
      reachedGoal,
      collected: this.collectedKeys.size,
      totalCollectables: this.grid.collectables.length,
      finalPose: { ...this.pose },
      commandCount: this.commandCount,
      sayOutputs: [...this.sayOutputs],
    };
  }

  private moveForward(step: number): void {
    const delta = DIRECTION_DELTAS[this.pose.dir];
    const tx = this.pose.x + delta.dx;
    const ty = this.pose.y + delta.dy;
    const tile = this.tileAt(tx, ty);

    if (tile === null || tile === "#") {
      // Bump coordinates are the blocked target tile (may sit off-grid on
      // edge bumps) so feedback can point at the exact obstacle.
      this.events.push({ type: "bump", x: tx, y: ty, step });
      if (!this.config.nonFatalBumps) this.halt("BUMPED");
      return; // non-fatal bump: stay put
    }

    const from = { ...this.pose };
    this.pose = { x: tx, y: ty, dir: this.pose.dir };
    this.events.push({ type: "move", from, to: { ...this.pose }, step });

    if (tile === "W") {
      this.events.push({ type: "splash", x: tx, y: ty, step });
      this.halt("SPLASHED");
    }
    if (tile === "C" && this.config.autoCollect) {
      this.collectAt(tx, ty, step, true);
    }
  }

  private explicitCollect(step: number): void {
    const { x, y } = this.pose;
    if (this.tileAt(x, y) === "C" && !this.collectedKeys.has(`${x},${y}`)) {
      this.collectAt(x, y, step, false);
    } else {
      // Collecting on empty ground (or twice) is a mistake, not a disaster.
      this.events.push({ type: "collectFail", step });
    }
  }

  private collectAt(x: number, y: number, step: number, auto: boolean): void {
    const key = `${x},${y}`;
    if (this.collectedKeys.has(key)) return;
    this.collectedKeys.add(key);
    this.events.push({ type: "collect", x, y, step, auto });
  }

  private tileAt(x: number, y: number): TileChar | null {
    if (x < 0 || y < 0 || x >= this.grid.width || y >= this.grid.height) return null;
    return this.grid.tiles[y]?.[x] ?? null;
  }

  private halt(termination: Termination): never {
    this.halted = termination;
    throw new EngineHalt(termination);
  }
}
