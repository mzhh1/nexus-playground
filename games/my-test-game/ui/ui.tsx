import React from 'react';
import styles from './ui.module.css';
import type { GameUIProps } from '@nexusgame/game-sdk';

const helloUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly, metadata }) => {
  const { current_state, your_role } = perspective;
  const roleId = metadata?.roleId ?? perspective.your_role.identity;

  // Helper to get display name
  const getDisplayName = (pid: string) => {
    if (metadata?.roleDisplayMapping && metadata.roleDisplayMapping[pid]) {
      return metadata.roleDisplayMapping[pid].name;
    }
    return pid;
  };

  const handleAction = () => {
    if (!isMyTurn || readonly) return;

    onAction({
      action_id: 'example_action',
      role_id: roleId,
      params: {}
    });
  };

  return (
    <div className={styles.container}>
      <h2>hello</h2>
      <div className={styles.board}>
        <p>Your Role: {getDisplayName(roleId)}</p>
        <p>Current Turn: {current_state.turn}</p>
        <button
          onClick={handleAction}
          disabled={!isMyTurn || readonly}
          className={styles.button}
        >
          Do Action
        </button>
      </div>
    </div>
  );
};

export default helloUI;
