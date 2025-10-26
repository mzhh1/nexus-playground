/**
 * Index Page
 * Landing page
 */

import React, { useEffect } from 'react';
import { getApiClient } from '../../lib/api-client';
import '../../styles/global.css';

export const Index: React.FC = () => {
  const apiClient = getApiClient();

  useEffect(() => {
    // M0: Simplified - redirect to my-nexus directly
    // In production, check authentication status first
    const userId = apiClient.getUserId();
    
    if (!userId || userId === 'test_user_1') {
      // For testing, allow setting user ID
      const urlParams = new URLSearchParams(window.location.search);
      const userIdParam = urlParams.get('userId');
      
      if (userIdParam) {
        apiClient.setUserId(userIdParam);
      }
    }

    // Redirect to my-nexus
    setTimeout(() => {
      window.location.href = '/my-nexus.html';
    }, 1000);
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

