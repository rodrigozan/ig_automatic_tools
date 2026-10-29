import { APP_NAME } from '../lib/appConfig'

export function AppLogo() {
  return <img src={`${import.meta.env.BASE_URL}imgs/PhanterAITools_Logo.png`} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
}

export function AppBrand({ className = '' }: { className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <AppLogo />
      <span className="font-semibold">{APP_NAME}</span>
    </span>
  )
}
