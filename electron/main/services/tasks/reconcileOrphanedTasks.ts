import type { TaskRecord } from '../../../../src/shared/domain/tasks.js';
import type { TaskRepository } from './taskRepository.js';
import { getAppLogger } from '../logger/appLogger.js';

const SHUTDOWN_MESSAGE = '应用意外退出，任务已终止';

export function reconcileOrphanedProfileTasks(repo: TaskRepository) {
  const tasks = repo.list() as TaskRecord[];
  const now = new Date().toISOString();
  const logger = getAppLogger();
  let reconciledCount = 0;

  for (const task of tasks) {
    if (task.status !== 'Running' && task.status !== 'Pending') {
      continue;
    }

    reconciledCount += 1;
    logger.warn('task', '启动时回收孤儿任务', {
      taskId: task.taskId,
      feature: task.feature,
      previousStatus: task.status,
    });

    repo.update({
      ...task,
      status: 'Failed',
      error: {
        code: 'app_shutdown',
        message: SHUTDOWN_MESSAGE,
      },
      updatedAt: now,
    } as unknown as Record<string, unknown>);
  }

  if (reconciledCount > 0) {
    logger.info('task', `孤儿任务回收完成，共 ${reconciledCount} 条`);
  } else {
    logger.info('task', '未发现需要回收的孤儿任务');
  }
}

export const APP_SHUTDOWN_MESSAGE = '应用关闭，任务已终止';
