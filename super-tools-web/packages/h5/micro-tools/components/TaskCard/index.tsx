/**
 * 任务卡片
 *
 * - status=in_progress + jumpPath：「去完成」按钮
 * - status=completed：「领取」按钮
 * - status=claimed：灰色「已领取」
 * - status=locked：灰色不可点
 *
 * Plan: Task 4.2
 */
import React, { FC } from 'react';
import type { TaskItem } from '../../types/points';
import './TaskCard.less';

export interface TaskCardProps {
  task: TaskItem;
  onClaim?: (code: string) => void;
  onJump?: (path: string) => void;
  claiming?: boolean;
}

const TaskCard: FC<TaskCardProps> = ({ task, onClaim, onJump, claiming }) => {
  const { status, progress } = task;

  const renderButton = () => {
    if (status === 'claimed') {
      return (
        <button className="task-card__btn is-disabled" disabled>
          已领取
        </button>
      );
    }
    if (status === 'locked') {
      return (
        <button className="task-card__btn is-disabled" disabled>
          未解锁
        </button>
      );
    }
    if (status === 'completed') {
      return (
        <button
          className="task-card__btn"
          disabled={claiming}
          onClick={() => onClaim?.(task.code)}
        >
          {claiming ? '领取中...' : '领取'}
        </button>
      );
    }
    // in_progress
    if (task.jumpPath && onJump) {
      return (
        <button
          className="task-card__btn is-secondary"
          onClick={() => onJump(task.jumpPath!)}
        >
          去完成 →
        </button>
      );
    }
    return (
      <button className="task-card__btn is-disabled" disabled>
        进行中
      </button>
    );
  };

  const progressPercent = progress
    ? Math.min(100, Math.round((progress.current / progress.target) * 100))
    : 0;

  return (
    <div className={`task-card${status === 'claimed' ? ' is-claimed' : ''}`}>
      <div className="task-card__row">
        <div className="task-card__main">
          <div className="task-card__name">{task.name}</div>
          {task.description && (
            <div className="task-card__desc">{task.description}</div>
          )}
          {progress && (
            <div className="task-card__progress">
              <div className="task-card__progress-bar">
                <div
                  className="task-card__progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="task-card__progress-text">
                {progress.current} / {progress.target}
              </div>
            </div>
          )}
          <div className="task-card__reward">
            奖励：+{task.rewardPoints} 积分
            {task.rewardGrowth ? ` +${task.rewardGrowth} 成长值` : ''}
          </div>
        </div>
        <div className="task-card__action">{renderButton()}</div>
      </div>
    </div>
  );
};

export default TaskCard;
