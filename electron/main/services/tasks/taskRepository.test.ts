import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTaskRepository } from './taskRepository';

function makeTmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-test-'));
  return path.join(dir, 'tasks.json');
}

let tmpFile: string;

afterEach(() => {
  if (tmpFile) {
    const dir = path.dirname(tmpFile);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('taskRepository', () => {
  it('creates an empty tasks file when none exists', () => {
    tmpFile = makeTmpFile();
    const repo = createTaskRepository(() => tmpFile);
    expect(repo.list()).toEqual([]);
  });

  it('persists tasks across reads', () => {
    tmpFile = makeTmpFile();
    const repo = createTaskRepository(() => tmpFile);
    repo.create({ taskId: 't1', name: 'first' });
    const tasks = repo.list() as Record<string, unknown>[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe('t1');
  });

  it('updates an existing task by taskId', () => {
    tmpFile = makeTmpFile();
    const repo = createTaskRepository(() => tmpFile);
    repo.create({ taskId: 't1', name: 'original' });
    repo.update({ taskId: 't1', name: 'updated' });
    const tasks = repo.list() as Record<string, unknown>[];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('updated');
  });

  it('appends when updating a non-existent taskId', () => {
    tmpFile = makeTmpFile();
    const repo = createTaskRepository(() => tmpFile);
    repo.create({ taskId: 't1', name: 'first' });
    repo.update({ taskId: 't2', name: 'second' });
    const tasks = repo.list() as Record<string, unknown>[];
    expect(tasks).toHaveLength(2);
  });
});
