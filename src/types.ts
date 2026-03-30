export const LEAD_STAGES = [
  'New Lead',
  'Qualified',
  'Scheduled Visit',
  'Visited',
  'Proposal Sent',
  'Pending Approval',
  'Negotiation / Follow Up',
  'Closed Won',
  'Closed Lost',
] as const

export type LeadStage = (typeof LEAD_STAGES)[number]

export type CustomerType = 'Residential' | 'Business' | 'Factory'
export type UserRole = 'Sales' | 'Manager' | 'Admin' | 'Executive'
export type VisitStatus = 'Planned' | 'Completed'
export type VisitOutcome =
  | 'Interested'
  | 'Not Interested'
  | 'Follow Up'
  | 'Closed Won'

export type QuoteStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Proposal Sent'
  | 'Signed'
  | 'Rejected'

export type NavKey =
  | 'dashboard'
  | 'crm'
  | 'calculator'
  | 'visits'
  | 'quotes'
  | 'packages'

export interface UserProfile {
  id: string
  name: string
  role: UserRole
  zone: string
  discountCap: number
  initials: string
}

export interface MonthlyUsage {
  month: string
  kwh: number
  bill: number
}

export interface CustomerRecord {
  id: string
  name: string
  accountName: string
  customerType: CustomerType
  phone: string
  email: string
  address: string
  district: string
  latitude?: number
  longitude?: number
  roofArea: number
  daytimeLoadRatio: number
  tags: string[]
  stage: LeadStage
  ownerId: string
  potentialScore: number
  createdAt: string
  note: string
  energyHistory: MonthlyUsage[]
}

export interface SolarPackage {
  id: string
  name: string
  systemSizeKw: number
  panelCount: number
  inverter: string
  price: number
  monthlyProduction: number
  roi: number
  paybackYears: number
  active: boolean
  promo?: string
  lastUpdated: string
}

export interface VisitRecord {
  id: string
  customerId: string
  salesId: string
  scheduledAt: string
  location: string
  status: VisitStatus
  outcome?: VisitOutcome
  summary: string
  photoLabel?: string
  nextAction: string
  nextFollowUp?: string
}

export interface QuotationLineItem {
  label: string
  amount: number
}

export interface ApprovalRecord {
  by: string
  decision: 'Approved' | 'Rejected'
  at: string
  comment: string
}

export interface SignatureRecord {
  name: string
  image: string
  signedAt: string
}

export interface QuotationRecord {
  id: string
  customerId: string
  packageId: string
  revision: number
  documentNumber: string
  basePrice: number
  discountPercent: number
  discountAmount: number
  finalPrice: number
  status: QuoteStatus
  requestedBy: string
  approverId?: string
  approvalComment?: string
  requiresApproval: boolean
  sentAt?: string
  signedAt?: string
  locked: boolean
  createdAt: string
  recommendedKw: number
  annualGeneration: number
  estimatedPaybackYears: number
  lineItems: QuotationLineItem[]
  approvalTrail: ApprovalRecord[]
  signature?: SignatureRecord
  customerSnapshot: {
    name: string
    accountName: string
    customerType: CustomerType
    address: string
    district: string
  }
  packageSnapshot: {
    name: string
    systemSizeKw: number
    panelCount: number
    inverter: string
  }
}

export interface AuditRecord {
  id: string
  entityType: string
  entityId: string
  action: string
  actor: string
  at: string
  detail: string
}

export interface SolarRecommendation {
  recommendedSizeKw: number
  estimatedMonthlyProduction: number
  estimatedAnnualGeneration: number
  estimatedAnnualSavings: number
  estimatedOffsetPercent: number
  panelCount: number
  roiPercent: number
  paybackYears: number
  recommendedPackage?: SolarPackage
}

export interface AppState {
  users: UserProfile[]
  customers: CustomerRecord[]
  packages: SolarPackage[]
  visits: VisitRecord[]
  quotations: QuotationRecord[]
  auditLog: AuditRecord[]
  activeUserId: string
  docRunning: number
  seededAt: string
}
