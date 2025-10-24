import { Link } from 'react-router-dom';

interface Game {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  thumbnail: string;
  supportsAI: boolean;
  comingSoon?: boolean;
}

const games: Game[] = [
  {
    id: 'tic-tac-toe',
    name: '井字棋',
    description: '经典3x3井字棋游戏。两名玩家轮流落子，第一个在横、竖或对角线上连成三个标记的玩家获胜。完美信息游戏的经典代表。',
    minPlayers: 2,
    maxPlayers: 2,
    thumbnail: '🎯',
    supportsAI: true,
  },
  {
    id: 'card-battle',
    name: '暗牌对战',
    description: '不完美信息游戏示例。玩家看不到对手的手牌，需要根据对手的出牌策略进行推理和决策。',
    minPlayers: 2,
    maxPlayers: 4,
    thumbnail: '🃏',
    supportsAI: true,
    comingSoon: true,
  },
  {
    id: 'go',
    name: '围棋',
    description: '古老的策略游戏，展示如何处理大型行动空间。玩家轮流在19x19的棋盘上落子，目标是围住更多地盘。',
    minPlayers: 2,
    maxPlayers: 2,
    thumbnail: '⚫',
    supportsAI: true,
    comingSoon: true,
  },
];

function GamesPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '2rem' }}>所有游戏</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '2rem',
        }}>
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface GameCardProps {
  game: Game;
}

function GameCard({ game }: GameCardProps) {
  const content = (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      cursor: game.comingSoon ? 'not-allowed' : 'pointer',
      opacity: game.comingSoon ? 0.6 : 1,
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}>
      <div style={{
        fontSize: '4rem',
        textAlign: 'center',
        marginBottom: '1rem',
      }}>
        {game.thumbnail}
      </div>

      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
        {game.name}
        {game.comingSoon && (
          <span style={{ fontSize: '0.8rem', color: '#999', marginLeft: '0.5rem' }}>
            (敬请期待)
          </span>
        )}
      </h3>

      <p style={{
        color: '#666',
        lineHeight: 1.6,
        marginBottom: '1rem',
        flexGrow: 1,
      }}>
        {game.description}
      </p>

      <div style={{
        display: 'flex',
        gap: '1rem',
        fontSize: '0.9rem',
        color: '#666',
        marginBottom: '1rem',
      }}>
        <span>👥 {game.minPlayers}-{game.maxPlayers}人</span>
        {game.supportsAI && <span>🤖 支持AI</span>}
      </div>

      {!game.comingSoon && (
        <div style={{
          padding: '0.75rem',
          textAlign: 'center',
          backgroundColor: '#4CAF50',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '4px',
        }}>
          开始游戏
        </div>
      )}
    </div>
  );

  if (game.comingSoon) {
    return content;
  }

  return (
    <Link
      to={`/games/${game.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {content}
    </Link>
  );
}

export default GamesPage;


