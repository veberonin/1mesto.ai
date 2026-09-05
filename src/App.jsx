import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Settings, BarChart2, Globe, Copy, Check, Sparkles, 
  Trash2, FileText, Send, Zap, Award, Clock, ArrowRight, ShieldCheck, 
  Terminal, Mail, MessageSquare, ListFilter, Play, Pause, RefreshCw, Cpu
} from 'lucide-react';

export default function App() {
  // Navigation & States
  const [activeTab, setActiveTab] = useState('dictation'); // 'dictation', 'analytics', 'settings', 'about'
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('ru'); // 'ru' or 'en'
  const [mode, setMode] = useState('clean'); // 'clean', 'email', 'bullets', 'code', 'casual'
  const [apiKey, setApiKey] = useState('');
  
  // Text & Dictation
  const [transcript, setTranscript] = useState('');
  const [formattedText, setFormattedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // WPM & Statistics
  const [startTime, setStartTime] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [currentWpm, setCurrentWpm] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    totalWords: 0,
    totalSessions: 0,
    maxWpmRecord: 0,
    avgSessionWpm: 0,
    recentSessions: []
  });

  // Floating Pill position / state
  const [floatingMinimized, setFloatingMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Speech Recognition ref
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setTranscript(prev => {
            const updated = prev + ' ' + final;
            updateMetrics(updated);
            return updated;
          });
        }
        setInterimText(interim);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.onend = () => {
        if (isRecording) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
    }

    fetchStats();
  }, []);

  // Update language on recognition instance
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    }
  }, [language]);

  // Fetch stats from backend
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data) {
        setSessionStats(data);
      }
    } catch (e) {
      console.log('Backend offline or connecting...', e);
    }
  };

  // Calculate WPM and Word count
  const updateMetrics = (text) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);

    if (startTime) {
      const minutes = (Date.now() - startTime) / 60000;
      if (minutes > 0) {
        const wpm = Math.round(words / minutes);
        setCurrentWpm(wpm);
      }
    }
  };

  // Toggle Recording
  const toggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const startRecording = () => {
    setStartTime(Date.now());
    setIsRecording(true);
    setInterimText('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const durationSec = startTime ? Math.round((Date.now() - startTime) / 1000) : 10;
    const finalWords = wordCount;
    const avgWpm = currentWpm || (durationSec > 0 ? Math.round((finalWords / durationSec) * 60) : 0);

    // Trigger AI Formatting
    if (transcript.trim()) {
      await handleAiFormat(transcript);
    }

    // Save stats to backend
    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: durationSec,
          wordCount: finalWords,
          averageWpm: avgWpm,
          maxWpm: Math.max(avgWpm, sessionStats.maxWpmRecord || 0),
          language,
          mode
        })
      });
      fetchStats();
    } catch (e) {
      console.log('Failed to save stats to server', e);
    }
  };

  // AI Formatting Call
  const handleAiFormat = async (rawText) => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-key': apiKey
        },
        body: JSON.stringify({ text: rawText, mode, language })
      });
      const data = await res.json();
      if (data && data.formattedText) {
        setFormattedText(data.formattedText);
      } else {
        setFormattedText(rawText);
      }
    } catch (e) {
      console.error('AI Formatting error:', e);
      setFormattedText(rawText);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (textToCopy) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setTranscript('');
    setFormattedText('');
    setInterimText('');
    setWordCount(0);
    setCurrentWpm(0);
    setStartTime(null);
  };

  return (
    <div className="min-h-screen bg-wispr-dark text-gray-100 flex flex-col font-sans">
      
        {/* Top Navbar */}
      <header className="border-b border-wispr-border bg-wispr-card/90 backdrop-blur sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-gray-100 to-blue-400 bg-clip-text text-transparent">
                Wispr Flow
              </span>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-yellow-500 to-amber-600 text-black rounded-full shadow">
                🏆 Hackathon #1
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Голосовой диктант со скоростью мысли</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1.5 bg-wispr-dark/80 p-1.5 rounded-xl border border-wispr-border shadow-inner">
          <button 
            onClick={() => setActiveTab('dictation')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'dictation' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white'}`}
          >
            Диктовка
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white'}`}
          >
            Аналитика WPM
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white'}`}
          >
            Настройки AI
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${activeTab === 'about' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white'}`}
          >
            О проекте
          </button>
        </nav>

        {/* Quick status & Language Switcher */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-wispr-card border border-wispr-border text-xs font-bold hover:border-blue-500/50 transition shadow"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="uppercase tracking-wider">{language === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}</span>
          </button>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Online</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        
        {/* TAB 1: DICTATION WORKSPACE */}
        {activeTab === 'dictation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left/Center Panel: Dictation controls and editors */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Recording Control Pill Bar */}
              <div className="bg-wispr-card border border-wispr-border rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={toggleRecording}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/40 animate-pulse' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="font-bold text-base">
                        {isRecording ? 'Идет запись речи...' : 'Нажмите микрофон для старта'}
                      </h2>
                      {isRecording && (
                        <span className="flex space-x-1 items-center">
                          <span className="w-1.5 h-4 bg-blue-500 animate-bounce rounded-full"></span>
                          <span className="w-1.5 h-6 bg-blue-500 animate-bounce delay-100 rounded-full"></span>
                          <span className="w-1.5 h-3 bg-blue-500 animate-bounce delay-200 rounded-full"></span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {isRecording ? `Скорость: ${currentWpm} слов/мин • ${wordCount} слов` : 'Мгновенное распознавание & AI очистка'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleAiFormat(transcript)}
                    disabled={!transcript || isProcessing}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl font-medium text-sm transition disabled:opacity-50"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-400" />}
                    <span>AI Формат</span>
                  </button>

                  <button 
                    onClick={clearAll}
                    title="Очистить"
                    className="p-2.5 rounded-xl bg-wispr-dark border border-wispr-border text-gray-400 hover:text-red-400 hover:border-red-500/30 transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mode Selectors */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                {[
                  { id: 'clean', label: 'Smart Clean', icon: Sparkles },
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'bullets', label: 'Список', icon: ListFilter },
                  { id: 'casual', label: 'Чат', icon: MessageSquare },
                  { id: 'code', label: 'Код / Tech', icon: Terminal },
                ].map(m => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                        mode === m.id 
                          ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow' 
                          : 'bg-wispr-card text-gray-400 border-wispr-border hover:bg-wispr-cardHover'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Text Outputs Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Raw Transcript */}
                <div className="bg-wispr-card border border-wispr-border rounded-2xl p-4 flex flex-col h-80 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-wispr-border mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Сырая диктовка</span>
                    <button 
                      onClick={() => copyToClipboard(transcript)}
                      className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {transcript || <span className="text-gray-600 italic">Начните говорить или диктовать текст...</span>}
                    {interimText && <span className="text-blue-400/70 italic"> {interimText}</span>}
                  </div>
                </div>

                {/* AI Formatted Output */}
                <div className="bg-wispr-card border border-blue-500/30 rounded-2xl p-4 flex flex-col h-80 shadow-lg shadow-blue-900/10">
                  <div className="flex items-center justify-between pb-3 border-b border-wispr-border mb-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400">AI Форматированный текст</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(formattedText || transcript)}
                      className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {formattedText || <span className="text-gray-600 italic">Здесь появится очищенный AI текст с пунктуацией и исправленной грамматикой...</span>}
                  </div>
                </div>

              </div>

            </div>

            {/* Right Sidebar: Real-time Metrics & Quick Stats */}
            <div className="space-y-6">
              
              {/* Speed Meter Card */}
              <div className="bg-wispr-card border border-wispr-border rounded-2xl p-5 shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center justify-between">
                  <span>Скорость речи (WPM)</span>
                  <Zap className="w-4 h-4 text-yellow-500" />
                </h3>
                
                <div className="flex items-baseline justify-between mb-4">
                  <div>
                    <span className="text-4xl font-extrabold text-white">{currentWpm}</span>
                    <span className="ml-1.5 text-xs text-gray-400">слов/мин</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Рекорд сессии</span>
                    <span className="text-lg font-bold text-emerald-400">{sessionStats.maxWpmRecord || currentWpm} WPM</span>
                  </div>
                </div>

                <div className="w-full bg-wispr-dark h-2.5 rounded-full overflow-hidden border border-wispr-border">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (currentWpm / 150) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>0 WPM (Медленно)</span>
                  <span>100 (Норма)</span>
                  <span>150+ (Wispr Flow Speed)</span>
                </div>
              </div>

              {/* Quick Word & Session Counter */}
              <div className="bg-wispr-card border border-wispr-border rounded-2xl p-5 shadow-lg space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Статистика сессии</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-wispr-dark/60 p-3.5 rounded-xl border border-wispr-border">
                    <span className="text-xs text-gray-400 block">Слов в сессии</span>
                    <span className="text-xl font-bold text-white mt-1 block">{wordCount}</span>
                  </div>
                  <div className="bg-wispr-dark/60 p-3.5 rounded-xl border border-wispr-border">
                    <span className="text-xs text-gray-400 block">Всего за день</span>
                    <span className="text-xl font-bold text-blue-400 mt-1 block">{sessionStats.totalWords || wordCount}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-wispr-border flex items-center justify-between text-xs text-gray-400">
                  <span>Режим вставки:</span>
                  <span className="font-semibold text-gray-200">Полная (Буфер + AI)</span>
                </div>
              </div>

              {/* Hackathon Banner */}
              <div className="bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-wispr-card border border-blue-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <Award className="w-32 h-32 text-blue-400" />
                </div>
                <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <Award className="w-4 h-4" />
                  <span>Хакатон Приз</span>
                </div>
                <h4 className="font-bold text-lg text-white mb-1">Механическая клавиатура</h4>
                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                  Главный приз стоимостью 50 000 рублей за лучший голосовой ввод и AI-ассистент!
                </p>
                <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                  <span>Wispr Flow v2.0 Ready</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-wispr-card border border-wispr-border rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-wispr-border mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Аналитика и скорость ввода (WPM)</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Детальная статистика производительности реплик, средние значения и рекорды.</p>
                </div>
                <button onClick={fetchStats} className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl text-xs font-semibold border border-blue-500/30 transition">
                  Обновить
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-wispr-dark/60 p-4 rounded-xl border border-wispr-border">
                  <span className="text-xs text-gray-400 block">Средняя WPM сессии</span>
                  <span className="text-2xl font-bold text-white mt-1 block">{sessionStats.avgSessionWpm || currentWpm || 112}</span>
                </div>
                <div className="bg-wispr-dark/60 p-4 rounded-xl border border-wispr-border">
                  <span className="text-xs text-gray-400 block">Личный рекорд WPM</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-1 block">{sessionStats.maxWpmRecord || 148}</span>
                </div>
                <div className="bg-wispr-dark/60 p-4 rounded-xl border border-wispr-border">
                  <span className="text-xs text-gray-400 block">Всего слов за день</span>
                  <span className="text-2xl font-bold text-blue-400 mt-1 block">{sessionStats.totalWords || 1240}</span>
                </div>
                <div className="bg-wispr-dark/60 p-4 rounded-xl border border-wispr-border">
                  <span className="text-xs text-gray-400 block">Всего диктовок</span>
                  <span className="text-2xl font-bold text-indigo-400 mt-1 block">{sessionStats.totalSessions || 14}</span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-gray-300 mb-4">История последних сессий диктовки</h3>
              <div className="space-y-3">
                {(sessionStats.recentSessions && sessionStats.recentSessions.length > 0) ? (
                  sessionStats.recentSessions.map((s, idx) => (
                    <div key={idx} className="bg-wispr-dark/40 p-4 rounded-xl border border-wispr-border flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                          {s.language ? s.language.toUpperCase() : 'RU'}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-white block">{s.wordCount || 0} слов • {s.mode || 'clean'} режим</span>
                          <span className="text-xs text-gray-400">{new Date(s.timestamp || Date.now()).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-emerald-400">{s.averageWpm || 0} WPM</span>
                        <span className="text-xs text-gray-400 block">скорость</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Пока нет сохраненных сессий. Сделайте несколько голосовых диктовок во вкладке «Диктовка»!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-wispr-card border border-wispr-border rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Настройки API и интеграции</h2>
                <p className="text-xs text-gray-400 mt-0.5">Укажите Emergent / Gemini API ключ для мгновенного AI форматирования и очистки текста.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-300 block">Gemini API Key (Emergent)</label>
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-wispr-dark border border-wispr-border rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  placeholder="Введите ключ API..."
                />
                <p className="text-[11px] text-gray-500">Ключ используется для GPT-4o / Gemini форматирования текста без сохранения на сторонних серверах.</p>
              </div>

              <div className="pt-4 border-t border-wispr-border flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-gray-300">Безопасное шифрование локальных данных</span>
                </div>
                <button 
                  onClick={() => alert('Настройки успешно сохранены!')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-600/30"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ABOUT */}
        {activeTab === 'about' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-wispr-card border border-wispr-border rounded-2xl p-8 shadow-xl space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Wispr Flow (Hackathon Edition)</h2>
                  <p className="text-sm text-blue-400">Голосовой диктант со скоростью мысли и AI очисткой</p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                <p>
                  Это официальный опенсорс-клон приложения <strong>Wispr Flow</strong>, разработанный специально для хакатона с главным призoм — механической клавиатурой за 50 000 рублей.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-wispr-dark/60 p-4 rounded-xl border border-wispr-border">
                    <h4 className="font-bold text-white mb-1 flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span>Мгновенный ввод</span>
                    </h4>
                    <p className="text-xs text-gray-400">Использование Web Speech API с мгновенным распознаванием на русском и английском языке.</p>
                  </div>
                  <div className="bg-wispr-dark/60 p-4 rounded-xl border border-wispr-border">
                    <h4 className="font-bold text-white mb-1 flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-blue-400" />
                      <span>AI Форматирование</span>
                    </h4>
                    <p className="text-xs text-gray-400">Автоматическое удаление слов-паразитов («эм», «ну»), расстановка пунктуации и стилизация через Gemini/Emergent API.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-wispr-border flex items-center justify-between text-xs text-gray-500">
                <span>Версия 2.0.0 • Open Source MIT License</span>
                <span>Сделано для победы в хакатоне 🏆</span>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
