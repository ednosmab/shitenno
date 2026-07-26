#!/usr/bin/env node
/**
 * mcp-client.mjs — Reusable MCP Client for Shitenno
 *
 * Usage:
 *   node scripts/mcp-client.mjs <toolName> [jsonArgs]
 *   node scripts/mcp-client.mjs getBriefing '{"format":"summary","depth":"minimal"}'
 *   node scripts/mcp-client.mjs getRules '{"type":"context","format":"json"}'
 *   node scripts/mcp-client.mjs --list
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const listMode = args.includes('--list');
const toolName = listMode ? null : args[0];
let toolArgs = {};
if (args[1]) {
  try {
    toolArgs = JSON.parse(args[1]);
  } catch {
    console.error('Invalid JSON args:', args[1]);
    process.exit(1);
  }
}

if (!listMode && !toolName) {
  console.error('Usage: node scripts/mcp-client.mjs <toolName> [jsonArgs]');
  console.error('       node scripts/mcp-client.mjs --list');
  process.exit(1);
}

// Start the MCP server
const server = spawn('node', [join(projectRoot, 'dist/bin/shugo.js'), 'mcp', '--dir', projectRoot], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: projectRoot,
});

let msgId = 0;
const pending = new Map();

// Read JSON-RPC responses from stdout
const rl = createInterface({ input: server.stdout });
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg);
      pending.delete(msg.id);
    }
  } catch { /* not JSON */ }
});

// Collect stderr silently
server.stderr.on('data', () => {});

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }
    }, 15000);
  });
}

function sendNotification(method, params = {}) {
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

async function main() {
  // Wait for server startup (5s to handle slower machines)
  await new Promise(r => setTimeout(r, 5000));

  // Initialize handshake
  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'buffy-mcp-client', version: '1.0.0' },
  });
  sendNotification('notifications/initialized');
  await new Promise(r => setTimeout(r, 500));

  // Fetch available tools for validation
  const listResult = await sendRequest('tools/list');
  const availableTools = (listResult.result?.tools || []).map(t => t.name);

  if (listMode) {
    // List all tools
    const tools = listResult.result?.tools || [];
    console.log(JSON.stringify(tools.map(t => ({ name: t.name, description: t.description })), null, 2));
  } else {
    // Validate tool name
    if (!availableTools.includes(toolName)) {
      console.error(`Unknown tool: ${toolName}`);
      console.error(`Available: ${availableTools.join(', ')}`);
      rl.close();
      server.kill();
      process.exit(1);
    }
    // Call the specified tool
    const result = await sendRequest('tools/call', { name: toolName, arguments: toolArgs });
    if (result.result?.content) {
      result.result.content.forEach(c => process.stdout.write(c.text + '\n'));
    } else if (result.error) {
      console.error(JSON.stringify(result.error, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }

  rl.close();
  server.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err.message);
  rl.close();
  server.kill();
  process.exit(1);
});
