// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react';

/**
 * Страховка от «пустого тёмного окна»: любая ошибка рендера ловится здесь,
 * пользователь видит светлый экран с понятным текстом и кнопкой перезапуска.
 * Инлайн-стили — чтобы не зависеть от CSS при любом сбое.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // в консоль devtools — для диагностики
    console.error('UI crash caught:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F5F2EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: '#FFFFFF',
            border: '1px solid #E8E2D6',
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 12px 32px rgba(23,20,15,0.08)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#DD5B0A' }}>
            1MESTO FLOW
          </div>
          <h2 style={{ margin: '8px 0 6px', fontSize: 20, color: '#17140F' }}>
            Интерфейс споткнулся, но приложение в порядке
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.5, color: '#7B7365' }}>
            Ошибка: {String(this.state.error?.message || this.state.error).slice(0, 300)}
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              if (typeof window !== 'undefined') window.location.reload();
            }}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              background: '#17140F',
              color: '#F5F2EB',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Перезапустить интерфейс
          </button>
        </div>
      </div>
    );
  }
}
