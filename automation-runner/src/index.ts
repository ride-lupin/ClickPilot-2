import { executeTask } from "./executeTask.js";
import type { RunnerRequest } from "./protocol.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const input = await readStdin();
const request = JSON.parse(input) as RunnerRequest;
const result = await executeTask(request);
process.stdout.write(JSON.stringify(result));
