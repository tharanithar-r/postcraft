'use client';

import { useState } from 'react';

export default function PostTweetForm() {
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const remainingChars = 280 - text.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!text.trim()) {
      setMessage({ type: 'error', text: 'Please enter tweet text' });
      return;
    }

    if (text.length > 280) {
      setMessage({ type: 'error', text: 'Tweet is too long' });
      return;
    }

    setIsPosting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/x/post-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Tweet posted successfully! 🎉' });
        setText('');
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to post tweet',
        });
      }
    } catch (error) {
      console.error('Post tweet error:', error);
      setMessage({ type: 'error', text: 'Failed to post tweet' });
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="tweet-text"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          What's happening?
        </label>
        <textarea
          id="tweet-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your tweet..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={isPosting}
        />
        <div className="flex justify-between items-center mt-2">
          <span
            className={`text-sm ${
              remainingChars < 0
                ? 'text-red-500'
                : remainingChars < 20
                ? 'text-yellow-500'
                : 'text-gray-500'
            }`}
          >
            {remainingChars} characters remaining
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={isPosting || text.length === 0 || text.length > 280}
        className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isPosting ? 'Posting...' : 'Post Tweet'}
      </button>
    </form>
  );
}
