import { generate, type Options } from '../../../../Games/games/led-sudoku/rules';
const scope = globalThis as unknown as { onmessage: (e: { data: { id: number; options: Options; seed: number } }) => void; postMessage(data: unknown): void };
scope.onmessage = ({ data }) => {
  try { scope.postMessage({ id: data.id, result: generate(data.options, data.seed) }); }
  catch (error) { scope.postMessage({ id: data.id, error: String(error) }); }
};
