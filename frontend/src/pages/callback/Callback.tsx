/**
 * OAuth Callback Page (Placeholder for M0)
 */

import React, { useEffect } from 'react';
import '../../styles/global.css';

export const Callback: React.FC = () => {
  useEffect(() => {
    // M0: Simplified - just redirect back
    // In production, handle OAuth callback properly
    window.location.href = '/';
  }, []);

  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>Processing callback...</p>
    </div>
  );
};

export default Callback;

