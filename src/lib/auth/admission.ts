export const ACCOUNT_PENDING_ADMISSION_CODE = 'account_pending_admission'

export interface AdmissionUser {
  isActive: boolean
}

export function canAccessApp(user: AdmissionUser): boolean {
  return user.isActive
}
