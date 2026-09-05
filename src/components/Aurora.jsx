export default function Aurora() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="aurora-blob animate-blob"
        style={{ width: 560, height: 560, top: -160, left: -120, background: 'rgba(255,107,74,0.20)' }}
      />
      <div
        className="aurora-blob animate-blob-slow"
        style={{ width: 640, height: 640, top: '20%', right: -220, background: 'rgba(139,92,246,0.16)' }}
      />
      <div
        className="aurora-blob animate-blob"
        style={{ width: 480, height: 480, bottom: -180, left: '30%', background: 'rgba(56,189,248,0.10)', animationDelay: '-6s' }}
      />
      {/* тонкая сетка-виньетка */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.045), transparent 60%), linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5))',
        }}
      />
    </div>
  );
}
