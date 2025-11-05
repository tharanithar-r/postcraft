'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface XTokenData {
  id: string;
  expires_at: string;
  created_at: string;
}

export default function XConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<XTokenData | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    try {
      const { data, error } = await supabase
        .from('social_accounts')
        .select('id, expires_at, created_at')
        .single();

      if (data && !error) {
        setIsConnected(true);
        setTokenData(data);
      } else {
        setIsConnected(false);
        setTokenData(null);
      }
    } catch (error) {
      console.error('Error checking X connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect your X account?')) {
      return;
    }

    try {
      const response = await fetch('/api/x/disconnect', {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsConnected(false);
        setTokenData(null);
        alert('X account disconnected successfully');
      } else {
        alert('Failed to disconnect X account');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect X account');
    }
  }

  if (isLoading) {
    return <div className="text-gray-500">Checking connection...</div>;
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-red-500">❌ X Not Connected</span>
      </div>
    );
  }

  const expiresAt = tokenData?.expires_at
    ? new Date(tokenData.expires_at).toLocaleString()
    : 'Unknown';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-green-500">✅ X Connected</span>
      </div>
      <div className="text-sm text-gray-600">
        <p>Token expires: {expiresAt}</p>
        <p className="text-xs mt-1">
          (Tokens refresh automatically when needed)
        </p>
      </div>
      <button
        onClick={handleDisconnect}
        className="text-sm text-red-600 hover:text-red-800 underline"
      >
        Disconnect X Account
      </button>
    </div>
  );
}
