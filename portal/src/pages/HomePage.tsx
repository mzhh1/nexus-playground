import { Link } from 'react-router-dom';
import { useOAuth } from '@autolabz/oauth-sdk';

function HomePage() {
  const { isAuthenticated } = useOAuth();

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        backgroundColor: 'white',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '3rem',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            LLM原生游戏平台
          </h2>
          <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '2rem' }}>
            让AI和人类玩家一起参与各类游戏，体验前所未有的智能游戏体验
          </p>
          {isAuthenticated ? (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link
                to="/lobby"
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: '#4CAF50',
                  textDecoration: 'none',
                  borderRadius: '8px',
                }}
              >
                进入游戏大厅
              </Link>
              <Link
                to="/games"
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  color: '#4CAF50',
                  backgroundColor: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  border: '2px solid #4CAF50',
                }}
              >
                浏览游戏
              </Link>
            </div>
          ) : (
            <p style={{ color: '#999' }}>请先登录以开始游戏</p>
          )}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '4rem 2rem', backgroundColor: '#f5f5f5' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h3 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '3rem' }}>
            核心特性
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
          }}>
            <FeatureCard
              icon="🤖"
              title="LLM原生集成"
              description="大语言模型可以作为任何角色参与游戏，提供拟人化的游戏体验"
            />
            <FeatureCard
              icon="⚡"
              title="快速开发"
              description="统一的USADL描述体系，让开发者能快速将新游戏规则转化为可玩项目"
            />
            <FeatureCard
              icon="🎯"
              title="完美/不完美信息"
              description="优雅地处理各类游戏信息类型，从井字棋到德州扑克"
            />
            <FeatureCard
              icon="🔄"
              title="可复现性"
              description="支持从任意局面启动游戏，并允许玩家在任意时刻切换角色"
            />
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section style={{ padding: '4rem 2rem', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h3 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '3rem' }}>
            精选游戏
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
          }}>
            <GameCard
              title="井字棋"
              description="经典3x3井字棋游戏，完美信息游戏的代表"
              playersRange="2人"
              link="/games/tic-tac-toe"
            />
            <GameCard
              title="暗牌对战"
              description="即将推出：不完美信息游戏示例"
              playersRange="2-4人"
              link="#"
              comingSoon
            />
            <GameCard
              title="围棋"
              description="即将推出：大型行动空间游戏示例"
              playersRange="2人"
              link="#"
              comingSoon
            />
          </div>
        </div>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{title}</h4>
      <p style={{ color: '#666', lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

interface GameCardProps {
  title: string;
  description: string;
  playersRange: string;
  link: string;
  comingSoon?: boolean;
}

function GameCard({ title, description, playersRange, link, comingSoon }: GameCardProps) {
  const content = (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: comingSoon ? 'not-allowed' : 'pointer',
      opacity: comingSoon ? 0.6 : 1,
    }}>
      <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {title}
        {comingSoon && <span style={{ fontSize: '0.8rem', color: '#999', marginLeft: '0.5rem' }}>(敬请期待)</span>}
      </h4>
      <p style={{ color: '#666', marginBottom: '1rem', lineHeight: 1.6 }}>{description}</p>
      <div style={{ fontSize: '0.9rem', color: '#999' }}>
        👥 {playersRange}
      </div>
    </div>
  );

  if (comingSoon) {
    return content;
  }

  return <Link to={link} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link>;
}

export default HomePage;


