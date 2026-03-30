import type {
  AppState,
  CustomerRecord,
  LeadStage,
  QuoteStatus,
  QuotationRecord,
  SolarPackage,
  SolarRecommendation,
  UserRole,
} from '../types'

export const stageMeta: Record<
  LeadStage,
  { label: string; tone: string; shortLabel: string }
> = {
  'New Lead': { label: 'New Lead', tone: 'slate', shortLabel: 'New' },
  Qualified: { label: 'Qualified', tone: 'amber', shortLabel: 'Qualified' },
  'Scheduled Visit': {
    label: 'Scheduled Visit',
    tone: 'blue',
    shortLabel: 'Visit',
  },
  Visited: { label: 'Visited', tone: 'teal', shortLabel: 'Visited' },
  'Proposal Sent': {
    label: 'Proposal Sent',
    tone: 'indigo',
    shortLabel: 'Proposal',
  },
  'Pending Approval': {
    label: 'Pending Approval',
    tone: 'rose',
    shortLabel: 'Approval',
  },
  'Negotiation / Follow Up': {
    label: 'Negotiation / Follow Up',
    tone: 'orange',
    shortLabel: 'Follow Up',
  },
  'Closed Won': { label: 'Closed Won', tone: 'emerald', shortLabel: 'Won' },
  'Closed Lost': { label: 'Closed Lost', tone: 'charcoal', shortLabel: 'Lost' },
}

export const quoteStatusTone: Record<QuoteStatus, string> = {
  Draft: 'slate',
  'Pending Approval': 'rose',
  Approved: 'emerald',
  'Proposal Sent': 'indigo',
  Signed: 'teal',
  Rejected: 'charcoal',
}

export const roleTone: Record<UserRole, string> = {
  Sales: 'amber',
  Manager: 'blue',
  Admin: 'emerald',
  Executive: 'rose',
}

const currency = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 1,
})

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCurrency(value: number) {
  return currency.format(value)
}

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatCompact(value: number) {
  return compactFormatter.format(value)
}

export function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function roundToHalf(value: number) {
  return Math.round(value * 2) / 2
}

export function buildDocumentNumber(sequence: number, date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `SOL-${year}-${month}-${String(sequence).padStart(4, '0')}`
}

export function leadStageIndex(stage: LeadStage) {
  return Object.keys(stageMeta).indexOf(stage)
}

export function findRecommendedPackage(
  packages: SolarPackage[],
  recommendedSizeKw: number,
) {
  return packages
    .filter((item) => item.active)
    .sort(
      (left, right) =>
        Math.abs(left.systemSizeKw - recommendedSizeKw) -
        Math.abs(right.systemSizeKw - recommendedSizeKw),
    )[0]
}

export function calculateSolarRecommendation(
  customer: CustomerRecord,
  packages: SolarPackage[],
  overrideKw?: number | null,
): SolarRecommendation {
  const averageKwh = average(customer.energyHistory.map((entry) => entry.kwh))
  const averageBill = average(customer.energyHistory.map((entry) => entry.bill))
  const ruleBasedKw = roundToHalf(
    (averageKwh * (customer.daytimeLoadRatio / 100)) / 118,
  )
  const roofLimitKw = roundToHalf(Math.max(3, customer.roofArea / 7))
  const recommendedSizeKw = clamp(
    overrideKw ?? ruleBasedKw,
    3,
    Math.max(roofLimitKw, 3),
  )
  const estimatedMonthlyProduction = Math.round(recommendedSizeKw * 118)
  const estimatedAnnualGeneration = estimatedMonthlyProduction * 12
  const estimatedAnnualSavings = Math.round(
    Math.min(estimatedAnnualGeneration * 4.2, averageBill * 12 * 0.88),
  )
  const estimatedOffsetPercent = Math.round(
    clamp(
      (estimatedMonthlyProduction / Math.max(averageKwh, 1)) * 100,
      18,
      95,
    ),
  )
  const panelCount = Math.max(6, Math.ceil((recommendedSizeKw * 1000) / 550))
  const recommendedPackage = findRecommendedPackage(packages, recommendedSizeKw)
  const packagePrice =
    recommendedPackage?.price ?? recommendedSizeKw * 32000 + 80000
  const roiPercent = Number(
    ((estimatedAnnualSavings / Math.max(packagePrice, 1)) * 100).toFixed(1),
  )
  const paybackYears = Number(
    (packagePrice / Math.max(estimatedAnnualSavings, 1)).toFixed(1),
  )

  return {
    recommendedSizeKw,
    estimatedMonthlyProduction,
    estimatedAnnualGeneration,
    estimatedAnnualSavings,
    estimatedOffsetPercent,
    panelCount,
    roiPercent,
    paybackYears,
    recommendedPackage,
  }
}

export function getNextRevision(quotations: QuotationRecord[], customerId: string) {
  return (
    Math.max(
      0,
      ...quotations
        .filter((quote) => quote.customerId === customerId)
        .map((quote) => quote.revision),
    ) + 1
  )
}

export function calculateDashboardMetrics(state: AppState) {
  const totalLeads = state.customers.length
  const wonLeads = state.customers.filter(
    (customer) => customer.stage === 'Closed Won',
  ).length
  const activePipeline = state.customers.filter(
    (customer) =>
      customer.stage !== 'Closed Won' && customer.stage !== 'Closed Lost',
  ).length
  const pendingApprovals = state.quotations.filter(
    (quote) => quote.status === 'Pending Approval',
  ).length
  const quotationValue = state.quotations
    .filter((quote) => quote.status !== 'Rejected')
    .reduce((sum, quote) => sum + quote.finalPrice, 0)
  const closedWonValue = state.quotations
    .filter((quote) => quote.status === 'Signed')
    .reduce((sum, quote) => sum + quote.finalPrice, 0)
  const signedQuotes = state.quotations.filter((quote) => quote.status === 'Signed')
  const averageSalesCycleDays = signedQuotes.length
    ? Math.round(
        average(
          signedQuotes.map((quote) => {
            const customer = state.customers.find(
              (item) => item.id === quote.customerId,
            )
            if (!customer || !quote.signedAt) return 0
            const started = new Date(customer.createdAt).getTime()
            const signed = new Date(quote.signedAt).getTime()
            return (signed - started) / (1000 * 60 * 60 * 24)
          }),
        ),
      )
    : 0
  const conversionRate = totalLeads
    ? Math.round((wonLeads / totalLeads) * 100)
    : 0
  const visitToConversion = state.visits.filter((visit) => visit.status === 'Completed')
    .length
    ? Math.round(
        (signedQuotes.length /
          state.visits.filter((visit) => visit.status === 'Completed').length) *
          100,
      )
    : 0

  const stageDistribution = Object.keys(stageMeta).map((stage) => ({
    stage: stage as LeadStage,
    count: state.customers.filter((customer) => customer.stage === stage).length,
  }))

  const leaderboard = state.users
    .filter((user) => user.role === 'Sales')
    .map((user) => {
      const ownedCustomers = state.customers.filter(
        (customer) => customer.ownerId === user.id,
      )
      const ownedQuotes = state.quotations.filter((quote) => {
        const customer = state.customers.find((item) => item.id === quote.customerId)
        return customer?.ownerId === user.id
      })
      return {
        user,
        leads: ownedCustomers.length,
        pipeline: ownedQuotes
          .filter((quote) => quote.status !== 'Rejected')
          .reduce((sum, quote) => sum + quote.finalPrice, 0),
        closedWon: ownedQuotes
          .filter((quote) => quote.status === 'Signed')
          .reduce((sum, quote) => sum + quote.finalPrice, 0),
      }
    })
    .sort((left, right) => right.closedWon - left.closedWon)

  const territoryGroups = Array.from(
    state.customers.reduce((map, customer) => {
      const entry = map.get(customer.district) ?? {
        district: customer.district,
        opportunities: 0,
        scheduled: 0,
      }
      entry.opportunities += 1
      if (customer.stage === 'Scheduled Visit' || customer.stage === 'Visited') {
        entry.scheduled += 1
      }
      map.set(customer.district, entry)
      return map
    }, new Map<string, { district: string; opportunities: number; scheduled: number }>()),
  ).map(([, value]) => value)

  return {
    totalLeads,
    activePipeline,
    pendingApprovals,
    quotationValue,
    closedWonValue,
    conversionRate,
    averageSalesCycleDays,
    visitToConversion,
    stageDistribution,
    leaderboard,
    territoryGroups,
  }
}

export function getOwnerName(state: AppState, userId: string) {
  return state.users.find((user) => user.id === userId)?.name ?? 'Unknown'
}
