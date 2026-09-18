import { useState } from 'react';
import { Lock } from 'lucide-react';
import { ApiError } from '@workspace/api-client-react';
import { signIn } from '@/lib/admin-session';

export function AdminLoginForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel?: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!password) return setError('비밀번호를 입력해 주세요.');
    setPending(true);
    try {
      await signIn(password);
      onSuccess();
    } catch (loginError) {
      setError(loginError instanceof ApiError && loginError.status === 401 ? '비밀번호가 올바르지 않아요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login" onSubmit={submit} noValidate>
      <span className="login-icon"><Lock size={20} /></span>
      <h2>관리자 로그인</h2>
      <label className="field">
        <span>관리자 비밀번호</span>
        <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} data-testid="input-admin-password" />
      </label>
      {error && <p className="error" role="alert" data-testid="status-admin-login-error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} data-testid="button-admin-login">{pending ? '확인 중…' : '들어가기'}</button>
      {onCancel && <button className="back center" type="button" onClick={onCancel} data-testid="button-admin-cancel">취소</button>}
    </form>
  );
}
