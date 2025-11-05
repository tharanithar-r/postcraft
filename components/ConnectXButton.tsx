'use client';

import { useState } from 'react';

export default function ConnectXButton() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    window.location.href = '/api/auth/x/login';
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isConnecting ? 'Connecting...' : 'Connect X (Twitter)'}
    </button>
  );
}
