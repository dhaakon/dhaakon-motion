import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

/** Dependency-free CDP harness. CHROME_PATH is the only machine-specific input. */
export async function launchBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'dhaakon-motion-smoke-'));
  const chrome = spawn(
    process.env.CHROME_PATH || '/usr/bin/google-chrome',
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--autoplay-policy=no-user-gesture-required',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let launchError;
  chrome.on('error', (error) => {
    launchError = error;
  });
  const close = async () => {
    if (chrome.exitCode === null && chrome.pid) {
      const exited = new Promise((resolve) => chrome.once('exit', resolve));
      chrome.kill('SIGTERM');
      await Promise.race([exited, delay(3000)]);
      if (chrome.exitCode === null) {
        chrome.kill('SIGKILL');
        await exited;
      }
    }
    // Only remove the unique profile created by this invocation.
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  };
  try {
    let port;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (launchError) throw launchError;
      try {
        port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
        break;
      } catch {
        await delay(100);
      }
    }
    if (!port)
      throw new Error('Chrome did not start. Set CHROME_PATH to your Chromium executable.');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    let serial = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        clearTimeout(entry.timer);
        message.error
          ? entry.reject(new Error(JSON.stringify(message.error)))
          : entry.resolve(message.result);
      } else events.push(message);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++serial;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 20_000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
        );
      return result.result.value;
    };
    return {
      send,
      evaluate,
      events,
      async close() {
        ws.close();
        for (const entry of pending.values()) clearTimeout(entry.timer);
        await close();
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
