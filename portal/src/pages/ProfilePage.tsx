import { useOAuth } from '@autolabz/oauth-sdk';

function ProfilePage() {
  const { user, isAuthenticated } = useOAuth();

  if (!isAuthenticated || !user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>请先登录</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '2rem' }}>个人中心</h2>

        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt="Avatar"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  marginRight: '1.5rem',
                }}
              />
            ) : (
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                marginRight: '1.5rem',
              }}>
                {(user.nickname || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>
                {user.nickname || user.email}
              </h3>
              <p style={{ margin: 0, color: '#666' }}>{user.email}</p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '2rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>账户信息</h4>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <InfoRow label="用户ID" value={user.uid} />
              <InfoRow label="昵称" value={user.nickname || '未设置'} />
              <InfoRow label="邮箱" value={user.email || '未设置'} />
            </div>
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
            <h4 style={{ marginBottom: '1rem' }}>游戏统计</h4>
            <p style={{ color: '#999' }}>敬请期待...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#666', fontWeight: 'bold' }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

export default ProfilePage;

