// SPDX-License-Identifier: MIT
// Copyright (c) 2026 1mesto Flow team (veberonin)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PillWindow from './components/PillWindow.jsx'
import './index.css'

// ?pill=1 → режим плавающей пилюли (отдельное прозрачное окно в десктоп-приложении)
const pillMode = new URLSearchParams(window.location.search).get('pill') === '1'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {pillMode ? <PillWindow /> : <App />}
  </React.StrictMode>,
)
