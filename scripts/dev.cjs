#!/usr/bin/env node
/**
 * 루트 개발 서버 런처 — Node 내장 child_process.spawn만 사용한다.
 * 신규 npm 의존성(concurrently 등)을 추가하지 않는다.
 * (02-01-PLAN.md tracer task — RESEARCH.md Package Legitimacy Audit에 없는
 * 패키지를 신규 감사 없이 도입하지 않기 위한 결정)
 *
 * apps/api(NestJS)와 apps/web(Next.js)의 "dev" 스크립트를 동시에 실행하고,
 * 두 프로세스의 stdout/stderr를 접두어를 붙여 그대로 중계한다.
 * 한쪽이 예기치 않게 종료되면 나머지 프로세스도 정리하고 종료 코드를 전파한다.
 */

'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/** @type {{ name: string, cwd: string }[]} */
const TARGETS = [
  { name: 'api', cwd: path.join(ROOT, 'apps', 'api') },
  { name: 'web', cwd: path.join(ROOT, 'apps', 'web') },
];

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
// Node refuses to spawn .cmd/.bat files directly on Windows without `shell: true`
// (hardened in Node >=18.19/20.x/22.x against command-injection via cmd.exe argv
// parsing — throws `spawn EINVAL` otherwise). Passing a single fixed command string
// (no separate args array) with `shell: true` avoids Node's DEP0190 warning, which
// only fires when args are supplied alongside shell:true (arg-escaping concern that
// doesn't apply here since the command is a static literal, not untrusted input).

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function prefixedWrite(stream, name, chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (i === lines.length - 1 && lines[i] === '') continue;
    stream.write(`[${name}] ${lines[i]}\n`);
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exitCode = code ?? 0;
}

for (const target of TARGETS) {
  const child = isWindows
    ? spawn(`${npmCmd} run dev`, {
        shell: true,
        cwd: target.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      })
    : spawn(npmCmd, ['run', 'dev'], {
        cwd: target.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });

  children.push(child);

  child.stdout.on('data', (chunk) => prefixedWrite(process.stdout, target.name, chunk));
  child.stderr.on('data', (chunk) => prefixedWrite(process.stderr, target.name, chunk));

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    process.stderr.write(
      `[dev.cjs] "${target.name}" exited (code=${code}, signal=${signal}) — shutting down remaining processes\n`,
    );
    shutdown(code ?? 1);
  });

  child.on('error', (err) => {
    process.stderr.write(`[dev.cjs] failed to start "${target.name}": ${err.message}\n`);
    shutdown(1);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
