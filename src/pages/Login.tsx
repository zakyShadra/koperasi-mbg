import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { requestOtp, verifyOtp } from '../lib/auth-api';
import { isLoggedIn } from '../lib/auth-session';

const ROLE_HOME: Record<string, string> = {
  manager: '/manager',
  finance: '/finance',
  barista: '/barista',
};

const RESEND_COOLDOWN_S = 30;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Halaman login staff disembunyikan dari mesin pencari.
  useEffect(() => {
    document.title = 'Masuk Staff - Koperasi MBG';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.title = 'Koperasi MBG';
      meta.remove();
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (isLoggedIn()) {
    return <Navigate to="/manager" replace />;
  }

  const focusBox = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleSendCode = async () => {
    if (!email.includes('@')) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    setError('');
    setInfo('');
    setSending(true);
    try {
      const res = await requestOtp(email);
      setInfo(res.message);
      setDevCode(res.devCode ?? null);
      setStep(2);
      setCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => focusBox(0), 50);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || sending) {
      return;
    }
    setError('');
    setSending(true);
    try {
      const res = await requestOtp(email);
      setInfo(res.message);
      setDevCode(res.devCode ?? null);
      setCooldown(RESEND_COOLDOWN_S);
    } finally {
      setSending(false);
    }
  };

  const handleDigitChange = (
    index: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError('');
    if (value && index < 5) {
      focusBox(index + 1);
    }
  };

  const handleDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusBox(index - 1);
    }
  };

  const handleDigitPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) {
      return;
    }
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    focusBox(Math.min(pasted.length, 5));
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < 6) {
      setError('Masukkan 6 digit kode.');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      const res = await verifyOtp(email, code);
      if (!res.ok || !res.session) {
        setError(res.message);
        return;
      }
      const target = from ?? ROLE_HOME[res.session.role] ?? '/manager';
      navigate(target, { replace: true });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="glass-card login-card">
        <div className="login-seam" aria-hidden="true" />
        <div className="login-step" key={step}>
          {step === 1 ? (
            <>
              <h1 className="login-title">Masuk staff</h1>
              <p className="login-sub">
                Masukkan email staff, kami kirim kode masuk 6 digit ke email
                kamu.
              </p>
              <form
                className="login-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendCode();
                }}
              >
                <div>
                  <label className="input-label" htmlFor="login-email">
                    Email staff
                  </label>
                  <input
                    id="login-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@mbg.dev"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {error ? <p className="form-error">{error}</p> : null}
                  {info ? <p className="form-note">{info}</p> : null}
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending}
                >
                  {sending ? 'Mengirim...' : 'Kirim kode'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="login-title">Masukkan kode</h1>
              <p className="login-sub">
                Kode 6 digit dikirim ke {email}. Kode berlaku 5 menit.
              </p>
              <div className="login-form">
                <div
                  className="otp-row"
                  onPaste={handleDigitPaste}
                >
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      className="otp-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      aria-label={`Digit ${index + 1}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e)}
                      onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    />
                  ))}
                </div>
                {error ? <p className="form-error">{error}</p> : null}
                {info ? <p className="form-note">{info}</p> : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleVerify()}
                  disabled={verifying}
                >
                  {verifying ? 'Memeriksa...' : 'Masuk'}
                </button>
                <div className="login-foot">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setStep(1);
                      setDigits(['', '', '', '', '', '']);
                      setError('');
                      setInfo('');
                    }}
                  >
                    Ganti email
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => void handleResend()}
                    disabled={cooldown > 0 || sending}
                  >
                    {cooldown > 0
                      ? `Kirim ulang (${cooldown} dtk)`
                      : 'Kirim ulang'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="form-note" style={{ marginTop: 24 }}>
          Mode demo: backend OTP (Worker + D1) belum terhubung. Kode demo
          tampil di bawah (DEV ONLY, dihapus saat backend jadi).
        </p>
        {devCode ? (
          <div className="dev-code-box" style={{ marginTop: 8 }}>
            Kode demo: <strong>{devCode}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
