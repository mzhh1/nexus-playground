/**
 * Room Page
 * View and join other users' rooms
 */

import React, { useState, useEffect } from 'react';
import { AuthAvatar, useOAuth } from '@autolabz/oauth-sdk';
import '@autolabz/oauth-sdk/dist/style.css';
import { useRoom } from '../../hooks/useRoom';
import { usePerspective } from '../../hooks/usePerspective';
import { useAction } from '../../hooks/useAction';
import { NexusControlBar } from '../../components/NexusControlBar';
import { GameUIContainer } from '../../components/GameUIContainer';
import '../../styles/global.css';

export const Room: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const { room, loading, error, fetchRoom, joinRoom } = useRoom(roomId || undefined);
  const { perspective } = usePerspective(roomId, currentRoleId, playerId || undefined);
  const { submitAction, submitting } = useAction(roomId);

  // Extract room ID from URL (/room?id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (id) {
      setRoomId(id);
    } else {
      alert('No room ID specified');
    }
  }, []);

  // Fetch room info when roomId is set
  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  // Determine current role
  useEffect(() => {
    if (!room) return;

    // Check if we're already in the room
    const myPlayerId = Object.entries(room.player_list).find(
      ([_, player]) => player.type === 'human' // M0: Simple check
    )?.[0];

    if (myPlayerId) {
      setPlayerId(myPlayerId);

      // Find role assigned to this player
      const roleId = Object.entries(room.role_mapping).find(
        ([_, pid]) => pid === myPlayerId
      )?.[0];

      if (roleId) {
        setCurrentRoleId(roleId);
      }
    }
  }, [room]);

  const handleJoin = async () => {
    const displayName = prompt('Enter your display name:');
    if (!displayName) return;

    try {
      const result = await joinRoom(displayName);
      setPlayerId(result.player_id);
      alert('Joined successfully!');
    } catch (err) {
      alert('Failed to join room');
    }
  };

  if (!roomId) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="error-message">
          <h2>Invalid Room</h2>
          <p>No room ID specified in URL</p>
        </div>
      </div>
    );
  }

  if (loading && !room) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading room...</p>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="container" style={{ paddingTop: 'var(--spacing-xl)' }}>
        <div className="error-message">
          <h2>错误</h2>
          <p>{typeof error === 'string' ? error : '加载房间失败'}</p>
          <button onClick={fetchRoom}>重试</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div>No room data</div>;
  }

  // 获取当前用户信息（使用 OAuth 的 user.id）
  const { user } = useOAuth();
  const currentUserId = user?.id || null;
  
  const isInRoom = playerId !== null;
  const isOwner = room.owner_uid === currentUserId;
  const isPlaying = room.room_status === 'playing';
  const canJoin = room.room_status === 'open' && !isInRoom;

  // 🔍 调试信息
  console.log('=== Room Owner Debug ===');
  console.log('OAuth user 对象:', user);
  console.log('当前用户ID (user.id):', currentUserId);
  console.log('房主ID (room.owner_uid):', room.owner_uid);
  console.log('是否为房主:', isOwner);
  console.log('严格相等 (===):', room.owner_uid === currentUserId);
  console.log('类型检查:', { 
    currentUserIdType: typeof currentUserId, 
    ownerUidType: typeof room.owner_uid,
    currentUserIdValue: JSON.stringify(currentUserId),
    ownerUidValue: JSON.stringify(room.owner_uid)
  });
  console.log('房间状态:', room.room_status);
  console.log('是否在房间内:', isInRoom);
  console.log('玩家ID:', playerId);
  console.log('完整房间数据:', room);
  console.log('=======================');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Control Bar */}
      {isPlaying && (
        <NexusControlBar
          room={room}
          isOwner={isOwner}
          statusText={perspective?.your_role?.is_current ? 'Your Turn' : 'Opponent Turn'}
          onExit={() => (window.location.href = '/')}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        <div className="container">
          {/* Header with Avatar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
            <h1>Room: {roomId}</h1>
            <AuthAvatar
              redirectUri={import.meta.env.VITE_OAUTH_REDIRECT_URI}
              scope={import.meta.env.VITE_OAUTH_SCOPE || 'openid profile email llmapi'}
              profileUrl={import.meta.env.VITE_OAUTH_PROFILE_URL}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}

          {/* 🔍 调试信息面板 */}
          <div className="card" style={{ 
            marginBottom: 'var(--spacing-lg)', 
            backgroundColor: '#f0f0f0', 
            border: '2px solid #ff6b00' 
          }}>
            <h3>🔍 调试信息</h3>
            <table style={{ width: '100%', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px', width: '200px' }}>OAuth User 对象:</td>
                  <td style={{ padding: '4px', fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '12px' }}>
                    {JSON.stringify(user, null, 2)}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px', width: '200px' }}>当前用户ID (user.id):</td>
                  <td style={{ padding: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {currentUserId || '(null)'}
                    <span style={{ marginLeft: '8px', color: '#666', fontSize: '12px' }}>
                      (类型: {typeof currentUserId})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px' }}>房主ID (room.owner_uid):</td>
                  <td style={{ padding: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {room.owner_uid || '(null)'}
                    <span style={{ marginLeft: '8px', color: '#666', fontSize: '12px' }}>
                      (类型: {typeof room.owner_uid})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px' }}>严格相等 (===):</td>
                  <td style={{ padding: '4px', fontWeight: 'bold', color: room.owner_uid === currentUserId ? 'green' : 'red' }}>
                    {room.owner_uid === currentUserId ? '✓ true' : '✗ false'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px' }}>是否为房主 (isOwner):</td>
                  <td style={{ padding: '4px', color: isOwner ? 'green' : 'red', fontWeight: 'bold' }}>
                    {isOwner ? '✓ 是' : '✗ 否'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px' }}>房间状态:</td>
                  <td style={{ padding: '4px' }}>{room.room_status}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px' }}>是否在房间内:</td>
                  <td style={{ padding: '4px' }}>{isInRoom ? '是' : '否'}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '4px' }}>玩家ID:</td>
                  <td style={{ padding: '4px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{playerId || '(null)'}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontSize: '12px' }}>
              <strong>修复说明：</strong> 现在使用 <code>user.id</code> 而不是 <code>getClientId()</code>。Client ID 是应用全局属性，User ID 才是用户唯一标识。
            </div>
          </div>

          {/* Join button */}
          {canJoin && (
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h2>Join this room?</h2>
              <p>Owner: {room.owner_uid}</p>
              <p>Game: {room.game_id || 'Not selected'}</p>
              <p>Players: {Object.keys(room.player_list).length}</p>
              <button onClick={handleJoin}>Join Room</button>
            </div>
          )}

          {/* Waiting message */}
          {isInRoom && !isPlaying && (
            <div className="card">
              <h2>等待游戏开始...</h2>
              {isOwner ? (
                <p>您是房主。请配置玩家和角色，然后开始游戏。</p>
              ) : (
                <p>您已加入房间。房主将很快开始游戏。</p>
              )}
            </div>
          )}

          {/* Game UI */}
          {isPlaying && room.game_id && perspective && currentRoleId && (
            <div className="card">
              <GameUIContainer
                gameId={room.game_id}
                perspective={perspective}
                onAction={submitAction}
                isMyTurn={perspective.your_role.is_current}
                readonly={room.room_status !== 'playing' || submitting}
                metadata={{
                  roomId: room.room_id,
                  roleId: currentRoleId,
                  playerId: playerId || undefined,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;

