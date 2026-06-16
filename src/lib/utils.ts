import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { generateId } from './shared/id'
import { slugify } from './shared/slug'
import { todayInAppTimezone } from './shared/time'

export { generateId, slugify, todayInAppTimezone }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

