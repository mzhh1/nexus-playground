/**
 * Index Page
 * Landing page
 */

import React, { useEffect } from 'react';
import '../../styles/global.css';

export const Index: React.FC = () => {
  useEffect(() => {
    // Redirect quickly to my-nexus to resolve roomId and jump to /room
    window.location.replace('/my-nexus.html');
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <h1>星枢沙盒</h1>
      <p>Nexus Playground - LLM-Native Game Platform</p>
      <div className="spinner"></div>
      <p>Redirecting to your nexus...</p>
      
      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        <p>M0 Testing Mode</p>
        <p>Add ?userId=your_id to URL to set user ID</p>
      </div>
    </div>
  );
};

export default Index;

