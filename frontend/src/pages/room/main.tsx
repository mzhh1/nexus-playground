import React from 'react';
import ReactDOM from 'react-dom/client';
import { LogtoAuthProvider } from '../../components/providers/LogtoAuthProvider';
import '../../styles/global.css';
import Room from './Room.tsx';

function RoomGate() {
  return <Room />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LogtoAuthProvider>
      <RoomGate />
    </LogtoAuthProvider>
  </React.StrictMode>
);

