import { CALENDAR_SOLVER_MODEL, solveCalendarPuzzle, type CalendarSolveInput } from '../../../../Games/games/calendar-puzzle/solver';
const scope = globalThis as unknown as { onmessage: (event: { data: { kind: string; version: number; id: number; input: CalendarSolveInput } }) => void; postMessage: (data: unknown) => void };
scope.onmessage = ({ data }) => {
  if (data.kind !== 'calendar-solve' || data.version !== 1) return;
  try { scope.postMessage({ kind: 'calendar-solution', id: data.id, result: solveCalendarPuzzle(data.input, CALENDAR_SOLVER_MODEL) }); }
  catch (error) { scope.postMessage({ kind: 'calendar-solution', id: data.id, error: String(error) }); }
};
