/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.SECURE_SIGN_IN
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Global P2P engineering under Creator authority
WHAT: Interactive sign-in screen using the original Creator-provided small LeeWay Industries logo
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/components/SecureSignIn.tsx
WHY: Returning devices need a deliberate entry gate; new users need easy owner/member onboarding
HOW: Use the exact original small PNG and canonical enrollment checks; no fake password controls or generated logos
LICENSE: Existing repository terms; original logo rights are not newly asserted
*/
import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, UserPlus, Users } from 'lucide-react';
import { LanguageDropdown } from './LanguageDropdown';
import { InstallButton } from './InstallButton';
import { LeeWayLogo } from './LeeWayLogo';
import type { LangCode, Translations } from '../utils/i18n';

// The small original LeeWay logo is rendered by LeeWayLogo on every non-loading page.
// The existing family photograph is an existing application UI asset, not new artwork.
const FAMILY_HERO = './src/assets/images/family_dinner_snap_1795518768888.jpg';

export interface SignInDeviceSummary {
  userName: string;
  circleName: string;
  role: 'owner' | 'member';
}

interface SecureSignInProps {
  t: Translations;
  lang: LangCode;
  onChangeLang: (next: LangCode) => void;
  device: SignInDeviceSummary | null;
  lockReason?: string | null;
  error?: string | null;
  busy: boolean;
  credentialSetupRequired: boolean;
  username?: string;
  onSignIn: (username: string, passphrase: string, confirmation?: string) => Promise<void>;
  onCreatePrivateLine: () => void;
  onJoinFamily: () => void;
  onRecover: () => void;
}

const COPY = {
  en: {
    title: 'Secure Sign In', sub: 'Access your LeeWay Global P2P private circle.',
    intro: 'Private communications. Your people. Your secure line.',
    enrolled: 'Authorized device', circle: 'Private family circle',
    passphrase: 'Private access passphrase', confirm: 'Confirm access passphrase',
    setupTitle: 'Create a 12+ character access passphrase for this device',
    setupAction: 'Protect This Device', setupBusy: 'Protecting device…',
    verify: 'Sign In — Verify Device', checking: 'Verifying device…',
    first: 'This device has not completed secure enrollment.',
    newLine: 'Create a Private Line', join: 'Join My Family', recover: 'Recover Device',
    note: 'Enter the login name and password from your family invite. Device membership and bound keys are also verified locally.',
    about: 'Protected communications start with an approved device.',
  },
  es: {
    title: 'Inicio de sesión seguro', sub: 'Accede a tu círculo privado de LeeWay Global P2P.',
    intro: 'Comunicaciones privadas. Tu gente. Tu línea segura.',
    enrolled: 'Dispositivo autorizado', circle: 'Círculo familiar privado',
    verify: 'Iniciar sesión — Verificar dispositivo', checking: 'Verificando dispositivo…',
    first: 'Este dispositivo todavía no ha completado la inscripción segura.',
    newLine: 'Crear una línea privada', join: 'Unirme a mi familia', recover: 'Recuperar dispositivo',
    note: 'Se comprueban la membresía firmada y la clave del dispositivo. No se ha configurado un inicio de sesión por correo o contraseña.',
    about: 'La comunicación protegida comienza con un dispositivo aprobado.',
  },
  fr: {
    title: 'Connexion sécurisée', sub: 'Accédez à votre cercle privé LeeWay Global P2P.',
    intro: 'Communications privées. Vos proches. Votre ligne sécurisée.',
    enrolled: 'Appareil autorisé', circle: 'Cercle familial privé',
    verify: 'Connexion — Vérifier l’appareil', checking: 'Vérification de l’appareil…',
    first: 'Cet appareil n’a pas encore terminé son inscription sécurisée.',
    newLine: 'Créer une ligne privée', join: 'Rejoindre ma famille', recover: 'Récupérer un appareil',
    note: 'Vérification de l’adhésion signée et de la clé locale. Aucun compte avec mot de passe n’est configuré.',
    about: 'Les communications protégées commencent par un appareil approuvé.',
  },
  ar: {
    title: 'تسجيل دخول آمن', sub: 'الوصول إلى دائرتك الخاصة في LeeWay Global P2P.',
    intro: 'اتصالات خاصة. أحباؤك. خطك الآمن.',
    enrolled: 'جهاز معتمد', circle: 'الدائرة العائلية الخاصة',
    verify: 'تسجيل الدخول — التحقق من الجهاز', checking: 'جارٍ التحقق من الجهاز…',
    first: 'لم يكمل هذا الجهاز عملية التسجيل الآمن بعد.',
    newLine: 'إنشاء خط خاص', join: 'الانضمام إلى عائلتي', recover: 'استعادة الجهاز',
    note: 'يتم التحقق من عضوية الجهاز الموقعة ومفتاحه المحلي. لم يتم إعداد تسجيل الدخول بالبريد وكلمة المرور.',
    about: 'تبدأ الاتصالات المحمية بجهاز معتمد.',
  },
  zh: {
    title: '安全登录', sub: '访问您的 LeeWay Global P2P 私密家庭圈。',
    intro: '私人通信。亲密家人。安全连线。',
    enrolled: '已授权设备', circle: '私人家庭圈',
    verify: '登录 — 验证设备', checking: '正在验证设备…',
    first: '此设备尚未完成安全注册。',
    newLine: '创建私人线路', join: '加入我的家庭', recover: '恢复设备',
    note: '验证已签署的成员授权和本地设备密钥。尚未配置邮箱密码账户登录。',
    about: '受保护的通信从获批准的设备开始。',
  },
} as const;

export function SecureSignIn({
  t, lang, onChangeLang, device, lockReason, error, busy, credentialSetupRequired,
  username: initialUsername, onSignIn, onCreatePrivateLine, onJoinFamily, onRecover,
}: SecureSignInProps) {
  const c = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const accessLabels = { ...COPY.en, ...c };
  const [loginName, setLoginName] = useState(initialUsername ?? '');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const handleAccess = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !device) return;
    void onSignIn(loginName, passphrase, credentialSetupRequired ? confirm : undefined).finally(() => {
      setPassphrase('');
      setConfirm('');
    });
  };
  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#050A13] text-slate-100">
      {/* No generated artwork or substitute logos. The Creator's small logo is the only branding. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(9,43,80,0.35),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <LeeWayLogo size="sm" showWordmark wordmarkText={t.appName} />
          <div className="flex flex-col items-end gap-2">
            <LanguageDropdown id="leeway-signin-language" label={t.langLabel} value={lang}
              onChange={onChangeLang} variant="compact" />
            <InstallButton compact />
          </div>
        </div>
        <div className="mt-8 grid min-h-[min(740px,80dvh)] grid-cols-1 items-center gap-7 lg:grid-cols-12 lg:gap-12">
          <section className="lg:col-span-5">
            <LockKeyhole className="h-9 w-9 text-amber-400" aria-hidden="true" />
            <p className="mt-4 text-xs tracking-widest text-amber-300">PRIVATE FAMILY ENROLLMENT GATE</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.appName}</h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-slate-300">{c.intro}</p>
            <img src={FAMILY_HERO} alt="Illustration of family members around a dinner table"
              className="mt-6 w-full max-w-md rounded-2xl border border-white/10 object-cover shadow-2xl" />
            <p className="mt-4 max-w-md text-sm text-slate-400">{c.about}</p>
          </section>
          <section className="lg:col-span-7 rounded-[30px] border border-white/10 bg-[#0D1625]/90 px-5 py-7 shadow-[0_30px_90px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:px-10 sm:py-11"
            aria-labelledby="leeway-signin-title">
            <div className="mx-auto flex justify-center">
              <LockKeyhole className="h-9 w-9 text-amber-400" aria-hidden="true" />
            </div>
            <h2 id="leeway-signin-title" className="mt-4 text-center font-display text-3xl font-bold">{c.title}</h2>
            <p className="mt-2 text-center text-sm text-slate-400">{c.sub}</p>
            {device ? (
              <div className="mt-7 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-white">{c.enrolled}: {device.userName}</div>
                  <p className="mt-1 break-words text-slate-400">{c.circle}: {device.circleName}</p>
                </div>
              </div>
            ) : (
              <p className="mt-7 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">{c.first}</p>
            )}
            {(lockReason || error) && (
              <div role="alert" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-400/[0.07] p-3 text-sm text-amber-200">
                {error || lockReason}
              </div>
            )}
            {device && (
              <form onSubmit={handleAccess} className="mt-6 space-y-3" autoComplete="off">
                {credentialSetupRequired && (
                  <p className="text-sm text-amber-200">{accessLabels.setupTitle}</p>
                )}
                <label htmlFor="leeway-secure-username" className="block text-sm font-semibold text-slate-200">
                  Login name
                </label>
                <input id="leeway-secure-username" type="text" required
                  value={loginName} onChange={(event) => setLoginName(event.target.value)}
                  autoComplete="username"
                  className="w-full min-h-[50px] rounded-xl border border-white/15 bg-black/30 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <label htmlFor="leeway-secure-access-secret" className="block text-sm font-semibold text-slate-200">
                  {accessLabels.passphrase}
                </label>
                <input id="leeway-secure-access-secret" type="password" required
                  value={passphrase} onChange={(event) => setPassphrase(event.target.value)}
                  autoComplete={credentialSetupRequired ? 'new-password' : 'current-password'}
                  minLength={credentialSetupRequired ? 12 : 1} maxLength={256}
                  className="w-full min-h-[50px] rounded-xl border border-white/15 bg-black/30 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {credentialSetupRequired && (
                  <>
                    <label htmlFor="leeway-secure-access-confirm" className="block text-sm font-semibold text-slate-200">
                      {accessLabels.confirm}
                    </label>
                    <input id="leeway-secure-access-confirm" type="password" required
                      value={confirm} onChange={(event) => setConfirm(event.target.value)}
                      minLength={12} maxLength={256} autoComplete="new-password"
                      className="w-full min-h-[50px] rounded-xl border border-white/15 bg-black/30 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </>
                )}
                <button type="submit" disabled={busy}
                  className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 px-6 font-bold text-slate-950 shadow-[0_7px_28px_rgba(245,158,11,.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-65">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  {credentialSetupRequired
                    ? (busy ? accessLabels.setupBusy : accessLabels.setupAction)
                    : (busy ? c.checking : c.verify)}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </form>
            )}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!device && <button type="button" onClick={onCreatePrivateLine}
                className="flex min-h-[60px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 font-semibold text-slate-950 hover:bg-amber-400">
                <UserPlus className="h-4 w-4" aria-hidden="true" />{c.newLine}
              </button>}
              <button type="button" onClick={onJoinFamily}
                className="flex min-h-[60px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 font-semibold text-slate-100 hover:bg-white/10">
                <Users className="h-4 w-4 text-sky-400" aria-hidden="true" />{c.join}
              </button>
              <button type="button" onClick={onRecover}
                className="flex min-h-[60px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 font-semibold text-slate-100 hover:bg-white/10">
                <KeyRound className="h-4 w-4 text-amber-400" aria-hidden="true" />{c.recover}
              </button>
            </div>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">{c.note}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
