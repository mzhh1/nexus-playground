import React from 'react';
import ReactDOM from 'react-dom/client';
import { LogtoAuthProvider } from '../../components/providers/LogtoAuthProvider';
import Callback from './Callback.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LogtoAuthProvider>
      <Callback />
    </LogtoAuthProvider>
  </React.StrictMode>
);

