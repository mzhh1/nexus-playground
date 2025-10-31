/**
 * Home Page
 * Beautiful and modern landing page for Nexus Playground
 */

import React, { useEffect, useState } from 'react';
import { OAuthProvider, useOAuth } from '@autolabz/oauth-sdk';
import './home.css';
import '../../styles/global.css';

interface Game {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

interface Room {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: 'open' | 'playing' | 'paused';
  is_public: boolean;
  player_count: number;
  created_at: string;
}

// 使用相对路径，通过 Nginx 网关访问后端
// 在 Docker 环境中，Nginx 会将 /api/ 代理到 backend:3000
const API_BASE_URL = '/api/v1';

function HomeContent() {
  const [games, setGames] = useState<Game[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const { isAuthenticated, isInitialized } = useOAuth();

  // 获取游戏列表
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/games`);
        if (!response.ok) {
          throw new Error('Failed to fetch games');
        }
        const data = await response.json();
        setGames(data.games || []);
      } catch (error) {
        console.error('Error fetching games:', error);
        setGamesError('无法加载游戏列表');
      } finally {
        setGamesLoading(false);
      }
    };

    fetchGames();
  }, []);

  // 获取房间列表
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms`);
        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }
        const data = await response.json();
        setRooms(data.rooms || []);
      } catch (error) {
        console.error('Error fetching rooms:', error);
        setRoomsError('无法加载房间列表');
      } finally {
        setRoomsLoading(false);
      }
    };

    fetchRooms();
    // 每30秒刷新一次房间列表
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEnterMyNexus = () => {
    window.location.href = '/my-nexus.html';
  };

  const handleJoinRoom = (roomId: string) => {
    window.location.href = `/room.html?id=${roomId}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return '等待中';
      case 'playing':
        return '游戏中';
      case 'paused':
        return '已暂停';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'status-open';
      case 'playing':
        return 'status-playing';
      case 'paused':
        return 'status-paused';
      default:
        return '';
    }
  };

  const getGameName = (gameId: string | null) => {
    if (!gameId) return '未选择游戏';
    const game = games.find((g) => g.id === gameId);
    return game ? game.name : gameId;
  };

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            星枢沙盒
            <span className="hero-subtitle">Nexus Playground</span>
          </h1>
          <p className="hero-description">
            可扩展的 LLM 原生游戏平台 · 让 AI 与人类共同游戏
          </p>
          <button className="btn-primary btn-large" onClick={handleEnterMyNexus}>
            {isInitialized && isAuthenticated ? '进入我的星枢' : '开始使用'}
          </button>
        </div>
      </section>

      <div className="content-wrapper">
        {/* Games Section */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="icon">🎮</span>
              游戏列表
            </h2>
            <p className="section-description">探索平台上的所有游戏</p>
          </div>

          {gamesLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>加载游戏列表中...</p>
            </div>
          ) : gamesError ? (
            <div className="error-message">
              <span className="icon">⚠️</span>
              {gamesError}
            </div>
          ) : games.length === 0 ? (
            <div className="empty-message">
              <span className="icon">📦</span>
              暂无可用游戏
            </div>
          ) : (
            <div className="games-grid">
              {games.map((game) => (
                <div key={game.id} className="game-card">
                  <div className="game-card-header">
                    <h3 className="game-name">{game.name}</h3>
                    <span className="game-id">{game.id}</span>
                  </div>
                  <p className="game-description">{game.description}</p>
                  <div className="game-meta">
                    <div className="meta-item">
                      <span className="meta-label">玩家人数：</span>
                      <span className="meta-value">
                        {game.minPlayers === game.maxPlayers
                          ? game.minPlayers
                          : `${game.minPlayers} - ${game.maxPlayers}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Rooms Section */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="icon">🚪</span>
              公开房间
            </h2>
            <p className="section-description">加入其他玩家的游戏房间</p>
          </div>

          {roomsLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>加载房间列表中...</p>
            </div>
          ) : roomsError ? (
            <div className="error-message">
              <span className="icon">⚠️</span>
              {roomsError}
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-message">
              <span className="icon">🏠</span>
              暂无公开房间
            </div>
          ) : (
            <div className="rooms-list">
              {rooms.map((room) => (
                <div key={room.room_id} className="room-card">
                  <div className="room-card-content">
                    <div className="room-info">
                      <div className="room-header">
                        <h3 className="room-id">房间 #{room.room_id.slice(0, 8)}</h3>
                        <span className={`room-status ${getStatusColor(room.room_status)}`}>
                          {getStatusText(room.room_status)}
                        </span>
                      </div>
                      <div className="room-details">
                        <div className="room-detail-item">
                          <span className="detail-label">游戏：</span>
                          <span className="detail-value">{getGameName(room.game_id)}</span>
                        </div>
                        <div className="room-detail-item">
                          <span className="detail-label">玩家：</span>
                          <span className="detail-value">{room.player_count} 人</span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => handleJoinRoom(room.room_id)}
                    >
                      加入
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="home-footer">
        <p>© 2025 Nexus Playground - LLM 原生游戏平台</p>
      </footer>
    </div>
  );
}

export const Home: React.FC = () => {
  return (
    <OAuthProvider
      authServiceUrl={import.meta.env.VITE_AUTH_API_BASE_URL}
      clientId={import.meta.env.VITE_OAUTH_CLIENT_ID}
    >
      <HomeContent />
    </OAuthProvider>
  );
};

export default Home;

