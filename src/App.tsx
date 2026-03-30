import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  AlertTriangle,
  Boxes,
  Calculator,
  CalendarCheck2,
  ClipboardList,
  Clock3,
  Download,
  FileSignature,
  FileText,
  LayoutDashboard,
  MapPinned,
  RefreshCcw,
  Route,
  ShieldCheck,
  Sparkles,
  SunMedium,
  TrendingUp,
  Users,
} from 'lucide-react'
import './App.css'
import { SignaturePad } from './components/SignaturePad'
import { createInitialDemoState } from './data/seed'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import {
  buildDocumentNumber,
  calculateDashboardMetrics,
  calculateSolarRecommendation,
  formatCompact,
  formatCurrency,
  formatNumber,
  getNextRevision,
  getOwnerName,
  quoteStatusTone,
  roleTone,
  stageMeta,
} from './lib/solar'
import type {
  AppState,
  AuditRecord,
  CustomerRecord,
  NavKey,
  QuotationRecord,
  QuoteStatus,
  VisitOutcome,
} from './types'
import { LEAD_STAGES } from './types'

const NAV_ITEMS = [
  { key: 'dashboard' as const, label: 'แดชบอร์ด', icon: LayoutDashboard },
  { key: 'crm' as const, label: 'ลูกค้า', icon: Users },
  { key: 'calculator' as const, label: 'เครื่องคำนวณ', icon: Calculator },
  { key: 'visits' as const, label: 'แผนเข้าพบ', icon: CalendarCheck2 },
  { key: 'quotes' as const, label: 'ใบเสนอราคา', icon: FileText },
  { key: 'packages' as const, label: 'แพ็กเกจ', icon: Boxes },
]

function Badge({
  tone,
  children,
}: {
  tone: string
  children: ReactNode
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function StageBadge({ stage }: { stage: CustomerRecord['stage'] }) {
  const meta = stageMeta[stage]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={quoteStatusTone[status]}>{status}</Badge>
}

function MetricCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  tone: string
  icon: ComponentType<{ size?: number }>
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  )
}

function EnergyBars({ customer }: { customer: CustomerRecord }) {
  const max = Math.max(...customer.energyHistory.map((entry) => entry.kwh))

  return (
    <div className="energy-bars">
      {customer.energyHistory.map((entry) => (
        <div key={`${customer.id}-${entry.month}`} className="energy-bar-group">
          <div className="energy-bar-shell">
            <div
              className="energy-bar-fill"
              style={{ height: `${(entry.kwh / max) * 100}%` }}
            />
          </div>
          <span>{entry.month}</span>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [appState, setAppState, resetAppState] = useLocalStorageState<AppState>(
    'solar-demo-state',
    createInitialDemoState,
  )
  const [activeTab, setActiveTab] = useState<NavKey>('dashboard')
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    appState.customers[0]?.id ?? '',
  )
  const [selectedQuoteId, setSelectedQuoteId] = useState(
    appState.quotations[0]?.id ?? '',
  )
  const [customerSearch, setCustomerSearch] = useState('')
  const deferredSearch = useDeferredValue(customerSearch)
  const [manualKw, setManualKw] = useState<number | null>(null)
  const [discountDraft, setDiscountDraft] = useState(0)
  const [approvalNote, setApprovalNote] = useState('')
  const [draftSignature, setDraftSignature] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [visitDraft, setVisitDraft] = useState({
    customerId: '',
    scheduledAt: '2026-04-02T10:30',
    location: '',
    summary: '',
    outcome: 'Interested' as VisitOutcome,
    nextAction: '',
  })
  const [packageDraft, setPackageDraft] = useState({
    name: '',
    systemSizeKw: '',
    panelCount: '',
    inverter: '',
    price: '',
    promo: '',
  })

  const currentUser =
    appState.users.find((user) => user.id === appState.activeUserId) ??
    appState.users[0]

  const filteredCustomers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    if (!query) return appState.customers

    return appState.customers.filter((customer) => {
      const haystack = [
        customer.name,
        customer.accountName,
        customer.customerType,
        customer.district,
        customer.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [appState.customers, deferredSearch])

  const selectedCustomer =
    appState.customers.find((customer) => customer.id === selectedCustomerId) ??
    appState.customers[0]

  const selectedQuote =
    appState.quotations.find((quote) => quote.id === selectedQuoteId) ??
    appState.quotations[0]

  const dashboard = useMemo(() => calculateDashboardMetrics(appState), [appState])

  const selectedCustomerQuotes = useMemo(
    () =>
      appState.quotations
        .filter((quote) => quote.customerId === selectedCustomer?.id)
        .sort((left, right) => right.revision - left.revision),
    [appState.quotations, selectedCustomer],
  )

  const selectedCustomerVisits = useMemo(
    () =>
      appState.visits
        .filter((visit) => visit.customerId === selectedCustomer?.id)
        .sort(
          (left, right) =>
            new Date(right.scheduledAt).getTime() -
            new Date(left.scheduledAt).getTime(),
        ),
    [appState.visits, selectedCustomer],
  )

  const recommendation = useMemo(() => {
    if (!selectedCustomer) return null

    return calculateSolarRecommendation(selectedCustomer, appState.packages, manualKw)
  }, [appState.packages, manualKw, selectedCustomer])

  const canApprove =
    currentUser.role === 'Manager' ||
    currentUser.role === 'Executive' ||
    currentUser.role === 'Admin'

  const canManagePackages = currentUser.role === 'Admin'

  const openQuoteExists = selectedCustomerQuotes.some((quote) =>
    ['Draft', 'Pending Approval', 'Approved', 'Proposal Sent'].includes(
      quote.status,
    ),
  )

  const mapPins = useMemo(() => {
    const geoCustomers = appState.customers.filter(
      (customer) => customer.latitude && customer.longitude,
    )

    if (!geoCustomers.length) return []

    const latitudes = geoCustomers.map((customer) => customer.latitude as number)
    const longitudes = geoCustomers.map((customer) => customer.longitude as number)
    const minLat = Math.min(...latitudes)
    const maxLat = Math.max(...latitudes)
    const minLng = Math.min(...longitudes)
    const maxLng = Math.max(...longitudes)

    return geoCustomers.map((customer) => ({
      customer,
      x:
        14 +
        (((customer.longitude as number) - minLng) /
          Math.max(maxLng - minLng, 0.0001)) *
          72,
      y:
        14 +
        (1 -
          ((customer.latitude as number) - minLat) /
            Math.max(maxLat - minLat, 0.0001)) *
          64,
    }))
  }, [appState.customers])

  useEffect(() => {
    if (!appState.customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(appState.customers[0]?.id ?? '')
    }
  }, [appState.customers, selectedCustomerId])

  useEffect(() => {
    if (!appState.quotations.some((quote) => quote.id === selectedQuoteId)) {
      setSelectedQuoteId(appState.quotations[0]?.id ?? '')
    }
  }, [appState.quotations, selectedQuoteId])

  useEffect(() => {
    if (!selectedCustomer) return

    setVisitDraft((draft) => ({
      ...draft,
      customerId: selectedCustomer.id,
      location: draft.location || selectedCustomer.address,
    }))
    setManualKw(null)
  }, [selectedCustomer])

  useEffect(() => {
    if (!selectedQuote) return

    setDiscountDraft(selectedQuote.discountPercent)
    setApprovalNote(selectedQuote.approvalComment ?? '')
    setDraftSignature(selectedQuote.signature?.image ?? '')
    setSignatureName(selectedQuote.signature?.name ?? selectedQuote.customerSnapshot.name)
  }, [selectedQuote])

  const withAudit = (
    nextState: AppState,
    payload: Omit<AuditRecord, 'id' | 'at'>,
  ) => ({
    ...nextState,
    auditLog: [
      {
        ...payload,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      },
      ...nextState.auditLog,
    ].slice(0, 40),
  })

  const setActiveUser = (userId: string) => {
    setAppState((prev) => ({
      ...prev,
      activeUserId: userId,
    }))
  }

  const updateCustomer = (
    customerId: string,
    updater: (customer: CustomerRecord) => CustomerRecord,
    detail: string,
    action: string,
  ) => {
    setAppState((prev) => {
      const customers = prev.customers.map((customer) =>
        customer.id === customerId ? updater(customer) : customer,
      )

      return withAudit(
        {
          ...prev,
          customers,
        },
        {
          entityType: 'customer',
          entityId: customerId,
          action,
          actor: currentUser.name,
          detail,
        },
      )
    })
  }

  const handleStageChange = (customerId: string, stage: CustomerRecord['stage']) => {
    updateCustomer(
      customerId,
      (customer) => ({ ...customer, stage }),
      `เปลี่ยนสถานะ lead เป็น ${stage}`,
      'stage_updated',
    )
  }

  const handleOwnerChange = (customerId: string, ownerId: string) => {
    updateCustomer(
      customerId,
      (customer) => ({ ...customer, ownerId }),
      `assign lead ให้ ${getOwnerName(appState, ownerId)}`,
      'owner_reassigned',
    )
  }

  const handleCreateVisit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCustomer || !visitDraft.summary.trim() || !visitDraft.nextAction.trim()) {
      return
    }

    const visitId = crypto.randomUUID()

    setAppState((prev) => {
      const visit = {
        id: visitId,
        customerId: selectedCustomer.id,
        salesId: currentUser.id,
        scheduledAt: new Date(visitDraft.scheduledAt).toISOString(),
        location: visitDraft.location.trim() || selectedCustomer.address,
        status: 'Planned' as const,
        summary: visitDraft.summary.trim(),
        outcome: visitDraft.outcome,
        nextAction: visitDraft.nextAction.trim(),
        nextFollowUp: new Date(visitDraft.scheduledAt).toISOString(),
      }

      const customers = prev.customers.map((customer) =>
        customer.id === selectedCustomer.id &&
        ['New Lead', 'Qualified'].includes(customer.stage)
          ? { ...customer, stage: 'Scheduled Visit' as const }
          : customer,
      )

      return withAudit(
        {
          ...prev,
          customers,
          visits: [visit, ...prev.visits],
        },
        {
          entityType: 'visit',
          entityId: visitId,
          action: 'visit_created',
          actor: currentUser.name,
          detail: `สร้างแผนเข้าพบสำหรับ ${selectedCustomer.name}`,
        },
      )
    })

    setVisitDraft((draft) => ({
      ...draft,
      summary: '',
      nextAction: '',
      outcome: 'Interested',
    }))
  }

  const handleCreateQuotation = () => {
    if (!selectedCustomer || !recommendation?.recommendedPackage) {
      return
    }

    const quoteId = crypto.randomUUID()
    const quotePackage = recommendation.recommendedPackage

    setAppState((prev) => {
      const revision = getNextRevision(prev.quotations, selectedCustomer.id)
      const documentNumber = buildDocumentNumber(prev.docRunning + 1)
      const quotation: QuotationRecord = {
        id: quoteId,
        customerId: selectedCustomer.id,
        packageId: quotePackage.id,
        revision,
        documentNumber,
        basePrice: quotePackage.price,
        discountPercent: 0,
        discountAmount: 0,
        finalPrice: quotePackage.price,
        status: 'Draft',
        requestedBy: currentUser.id,
        requiresApproval: false,
        locked: false,
        createdAt: new Date().toISOString(),
        recommendedKw: recommendation.recommendedSizeKw,
        annualGeneration: recommendation.estimatedAnnualGeneration,
        estimatedPaybackYears: recommendation.paybackYears,
        lineItems: [
          {
            label: `Solar package ${quotePackage.name}`,
            amount: quotePackage.price,
          },
        ],
        approvalTrail: [],
        customerSnapshot: {
          name: selectedCustomer.name,
          accountName: selectedCustomer.accountName,
          customerType: selectedCustomer.customerType,
          address: selectedCustomer.address,
          district: selectedCustomer.district,
        },
        packageSnapshot: {
          name: quotePackage.name,
          systemSizeKw: quotePackage.systemSizeKw,
          panelCount: quotePackage.panelCount,
          inverter: quotePackage.inverter,
        },
      }

      return withAudit(
        {
          ...prev,
          docRunning: prev.docRunning + 1,
          quotations: [quotation, ...prev.quotations],
        },
        {
          entityType: 'quotation',
          entityId: quoteId,
          action: 'quotation_created',
          actor: currentUser.name,
          detail: `สร้าง draft quotation revision ${revision} สำหรับ ${selectedCustomer.name}`,
        },
      )
    })

    setSelectedQuoteId(quoteId)
    setActiveTab('quotes')
  }

  const handleSaveDiscount = () => {
    if (!selectedQuote || selectedQuote.locked) return

    const nextDiscount = Math.max(0, discountDraft)

    setAppState((prev) => {
      const quotes = prev.quotations.map((quote) => {
        if (quote.id !== selectedQuote.id) return quote

        const discountAmount = Math.round((quote.basePrice * nextDiscount) / 100)
        const finalPrice = quote.basePrice - discountAmount
        const requiresApproval = nextDiscount > currentUser.discountCap
        const approverRole = nextDiscount > 12 ? 'Executive' : 'Manager'
        const approverId = prev.users.find((user) => user.role === approverRole)?.id
        const nextStatus: QuoteStatus = requiresApproval
          ? 'Draft'
          : quote.status === 'Rejected'
            ? 'Draft'
            : quote.status

        return {
          ...quote,
          approverId,
          requiresApproval,
          status: nextStatus,
          discountPercent: nextDiscount,
          discountAmount,
          finalPrice,
          lineItems: [
            {
              label: `Solar package ${quote.packageSnapshot.name}`,
              amount: quote.basePrice,
            },
            ...(nextDiscount
              ? [
                  {
                    label: `Field discount ${nextDiscount}%`,
                    amount: -discountAmount,
                  },
                ]
              : []),
          ],
        }
      })

      return withAudit(
        {
          ...prev,
          quotations: quotes,
        },
        {
          entityType: 'quotation',
          entityId: selectedQuote.id,
          action: 'discount_updated',
          actor: currentUser.name,
          detail: `ปรับ discount quotation เป็น ${nextDiscount}%`,
        },
      )
    })
  }

  const handleRequestApproval = () => {
    if (!selectedQuote || !selectedQuote.requiresApproval) return

    setAppState((prev) => {
      const quotations = prev.quotations.map((quote) =>
        quote.id === selectedQuote.id
          ? {
              ...quote,
              status: 'Pending Approval' as const,
              approverId:
                quote.approverId ??
                prev.users.find((user) =>
                  quote.discountPercent > 12
                    ? user.role === 'Executive'
                    : user.role === 'Manager',
                )?.id,
              approvalComment: approvalNote,
            }
          : quote,
      )
      const customers = prev.customers.map((customer) =>
        customer.id === selectedQuote.customerId
          ? { ...customer, stage: 'Pending Approval' as const }
          : customer,
      )

      return withAudit(
        {
          ...prev,
          quotations,
          customers,
        },
        {
          entityType: 'quotation',
          entityId: selectedQuote.id,
          action: 'approval_requested',
          actor: currentUser.name,
          detail: `ส่ง quotation เข้าคิวอนุมัติพร้อม note: ${approvalNote || 'no comment'}`,
        },
      )
    })
  }

  const handleApproval = (decision: 'Approved' | 'Rejected') => {
    if (!selectedQuote || !canApprove) return

    setAppState((prev) => {
      const quotations = prev.quotations.map((quote) =>
        quote.id === selectedQuote.id
          ? (() => {
              const nextStatus: QuoteStatus =
                decision === 'Approved' ? 'Approved' : 'Rejected'

              return {
                ...quote,
                status: nextStatus,
                approvalComment: approvalNote,
                approvalTrail: [
                  {
                    by: currentUser.name,
                    decision,
                    at: new Date().toISOString(),
                    comment: approvalNote || 'No comment',
                  },
                  ...quote.approvalTrail,
                ],
              }
            })()
          : quote,
      )
      const customers = prev.customers.map((customer) =>
        customer.id === selectedQuote.customerId
          ? {
              ...customer,
              stage:
                decision === 'Approved'
                  ? ('Negotiation / Follow Up' as const)
                  : ('Negotiation / Follow Up' as const),
            }
          : customer,
      )

      return withAudit(
        {
          ...prev,
          quotations,
          customers,
        },
        {
          entityType: 'quotation',
          entityId: selectedQuote.id,
          action: decision === 'Approved' ? 'approved' : 'rejected',
          actor: currentUser.name,
          detail: `${decision} quotation พร้อม comment: ${approvalNote || 'no comment'}`,
        },
      )
    })
  }

  const handleSendProposal = () => {
    if (!selectedQuote) return

    setAppState((prev) => {
      const quotations = prev.quotations.map((quote) =>
        quote.id === selectedQuote.id
          ? {
              ...quote,
              status: 'Proposal Sent' as const,
              sentAt: new Date().toISOString(),
              locked: true,
            }
          : quote,
      )
      const customers = prev.customers.map((customer) =>
        customer.id === selectedQuote.customerId
          ? { ...customer, stage: 'Proposal Sent' as const }
          : customer,
      )

      return withAudit(
        {
          ...prev,
          quotations,
          customers,
        },
        {
          entityType: 'quotation',
          entityId: selectedQuote.id,
          action: 'proposal_sent',
          actor: currentUser.name,
          detail: `ส่ง proposal ${selectedQuote.documentNumber} ให้ลูกค้า`,
        },
      )
    })
  }

  const handleSignQuotation = () => {
    if (!selectedQuote || !draftSignature || !signatureName.trim()) return

    setAppState((prev) => {
      const quotations = prev.quotations.map((quote) =>
        quote.id === selectedQuote.id
          ? {
              ...quote,
              status: 'Signed' as const,
              signedAt: new Date().toISOString(),
              locked: true,
              signature: {
                name: signatureName.trim(),
                image: draftSignature,
                signedAt: new Date().toISOString(),
              },
            }
          : quote,
      )
      const customers = prev.customers.map((customer) =>
        customer.id === selectedQuote.customerId
          ? { ...customer, stage: 'Closed Won' as const }
          : customer,
      )

      return withAudit(
        {
          ...prev,
          quotations,
          customers,
        },
        {
          entityType: 'signature',
          entityId: selectedQuote.id,
          action: 'signed',
          actor: 'Customer',
          detail: `ลูกค้าเซ็นเอกสาร ${selectedQuote.documentNumber}`,
        },
      )
    })
  }

  const handleTogglePackage = (packageId: string) => {
    if (!canManagePackages) return

    setAppState((prev) => {
      const packages = prev.packages.map((item) =>
        item.id === packageId ? { ...item, active: !item.active } : item,
      )

      return withAudit(
        {
          ...prev,
          packages,
        },
        {
          entityType: 'package',
          entityId: packageId,
          action: 'package_toggled',
          actor: currentUser.name,
          detail: `สลับสถานะ package ${packageId}`,
        },
      )
    })
  }

  const handleCreatePackage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManagePackages) return

    const sizeKw = Number(packageDraft.systemSizeKw)
    const panelCount = Number(packageDraft.panelCount)
    const price = Number(packageDraft.price)

    if (
      !packageDraft.name.trim() ||
      !packageDraft.inverter.trim() ||
      !sizeKw ||
      !panelCount ||
      !price
    ) {
      return
    }

    const packageId = crypto.randomUUID()

    setAppState((prev) =>
      withAudit(
        {
          ...prev,
          packages: [
            {
              id: packageId,
              name: packageDraft.name.trim(),
              systemSizeKw: sizeKw,
              panelCount,
              inverter: packageDraft.inverter.trim(),
              price,
              monthlyProduction: Math.round(sizeKw * 118),
              roi: 19.8,
              paybackYears: 5,
              active: true,
              promo: packageDraft.promo.trim(),
              lastUpdated: new Date().toISOString(),
            },
            ...prev.packages,
          ],
        },
        {
          entityType: 'package',
          entityId: packageId,
          action: 'package_created',
          actor: currentUser.name,
          detail: `สร้าง package ใหม่ ${packageDraft.name.trim()}`,
        },
      ),
    )

    setPackageDraft({
      name: '',
      systemSizeKw: '',
      panelCount: '',
      inverter: '',
      price: '',
      promo: '',
    })
  }

  const handleExportSnapshot = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], {
      type: 'application/json',
    })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'solar-demo-snapshot.json'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const handleResetDemo = () => {
    const nextState = createInitialDemoState()
    resetAppState(nextState)
    setSelectedCustomerId(nextState.customers[0]?.id ?? '')
    setSelectedQuoteId(nextState.quotations[0]?.id ?? '')
    setActiveTab('dashboard')
    setCustomerSearch('')
    setDraftSignature('')
  }

  const renderDashboard = () => (
    <div className="tab-layout">
      <section className="grid-panels top-grid">
        <MetricCard
          tone="amber"
          icon={Users}
          label="Lead ทั้งหมด"
          value={formatNumber(dashboard.totalLeads)}
          hint={`Pipeline ที่ยังเปิดอยู่ ${formatNumber(dashboard.activePipeline)} ราย`}
        />
        <MetricCard
          tone="teal"
          icon={FileText}
          label="มูลค่า quotation"
          value={formatCompact(dashboard.quotationValue)}
          hint={`Closed won แล้ว ${formatCompact(dashboard.closedWonValue)} บาท`}
        />
        <MetricCard
          tone="rose"
          icon={ShieldCheck}
          label="Approval Queue"
          value={formatNumber(dashboard.pendingApprovals)}
          hint="รอ manager / executive ตัดสินใจ"
        />
        <MetricCard
          tone="blue"
          icon={Clock3}
          label="Average cycle"
          value={`${dashboard.averageSalesCycleDays} วัน`}
          hint={`Conversion ${dashboard.conversionRate}% จาก lead ทั้งหมด`}
        />
      </section>

      <section className="grid-panels dashboard-grid">
        <article className="panel territory-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Map & Route</span>
              <h2>Songkhla Territory Pulse</h2>
            </div>
            <Badge tone="blue">Mock map via local data</Badge>
          </div>

          <div className="territory-map">
            <div className="map-grid" />
            {mapPins.map((pin) => (
              <button
                key={pin.customer.id}
                type="button"
                className={`map-pin tone-${stageMeta[pin.customer.stage].tone}`}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                onClick={() =>
                  startTransition(() => {
                    setSelectedCustomerId(pin.customer.id)
                    setActiveTab('crm')
                  })
                }
              >
                <span className="map-pin-dot" />
                <span className="map-pin-label">{pin.customer.accountName}</span>
              </button>
            ))}
            <div className="map-watermark">
              <MapPinned size={18} />
              Demo territory layer
            </div>
          </div>

          <div className="territory-summary">
            {dashboard.territoryGroups.map((group) => (
              <div key={group.district} className="territory-chip">
                <strong>{group.district}</strong>
                <span>
                  {group.opportunities} leads • {group.scheduled} visit flows
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Pipeline</span>
              <h2>Stage Distribution</h2>
            </div>
            <Badge tone="teal">{dashboard.conversionRate}% conversion</Badge>
          </div>
          <div className="pipeline-columns">
            {dashboard.stageDistribution.map((item) => (
              <div key={item.stage} className="pipeline-column">
                <div className="pipeline-track">
                  <div
                    className={`pipeline-fill tone-${stageMeta[item.stage].tone}`}
                    style={{
                      height: `${Math.max(10, item.count * 18)}%`,
                    }}
                  />
                </div>
                <strong>{item.count}</strong>
                <span>{stageMeta[item.stage].shortLabel}</span>
              </div>
            ))}
          </div>
          <div className="panel-divider" />
          <div className="highlight-grid">
            <div>
              <span className="muted-label">Visit → conversion</span>
              <strong>{dashboard.visitToConversion}%</strong>
            </div>
            <div>
              <span className="muted-label">Closed won value</span>
              <strong>{formatCurrency(dashboard.closedWonValue)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="grid-panels dashboard-bottom">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">People</span>
              <h2>Sales Leaderboard</h2>
            </div>
            <Badge tone="amber">Live from localStorage</Badge>
          </div>
          <div className="leaderboard-list">
            {dashboard.leaderboard.map((entry) => (
              <div key={entry.user.id} className="leaderboard-row">
                <div>
                  <strong>{entry.user.name}</strong>
                  <span>
                    {entry.leads} leads • zone {entry.user.zone}
                  </span>
                </div>
                <div className="leaderboard-metrics">
                  <span>{formatCompact(entry.pipeline)} pipeline</span>
                  <strong>{formatCompact(entry.closedWon)} won</strong>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Route Queue</span>
              <h2>Next Field Moves</h2>
            </div>
            <Badge tone="rose">{dashboard.pendingApprovals} approvals waiting</Badge>
          </div>
          <div className="activity-stack">
            {appState.visits
              .slice()
              .sort(
                (left, right) =>
                  new Date(left.scheduledAt).getTime() -
                  new Date(right.scheduledAt).getTime(),
              )
              .slice(0, 4)
              .map((visit) => {
                const customer = appState.customers.find(
                  (item) => item.id === visit.customerId,
                )
                return (
                  <div key={visit.id} className="activity-card">
                    <div>
                      <strong>{customer?.accountName}</strong>
                      <span>{visit.location}</span>
                    </div>
                    <div className="activity-meta">
                      <Badge tone={visit.status === 'Completed' ? 'teal' : 'blue'}>
                        {visit.status}
                      </Badge>
                      <span>
                        {new Date(visit.scheduledAt).toLocaleString('th-TH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </article>
      </section>
    </div>
  )

  const renderCRM = () => (
    <div className="tab-layout tab-crm">
      <section className="list-panel panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Lead Management</span>
            <h2>Customer Radar</h2>
          </div>
          <Badge tone="amber">{filteredCustomers.length} matching</Badge>
        </div>
        <label className="search-box">
          <input
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, ประเภท, tag หรือพื้นที่"
          />
        </label>
        <div className="list-scroll">
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className={`customer-list-card${
                customer.id === selectedCustomer?.id ? ' is-selected' : ''
              }`}
              onClick={() => setSelectedCustomerId(customer.id)}
            >
              <div className="customer-list-head">
                <strong>{customer.accountName}</strong>
                <StageBadge stage={customer.stage} />
              </div>
              <span>{customer.name}</span>
              <div className="customer-list-meta">
                <span>{customer.customerType}</span>
                <span>{customer.district}</span>
                <span>Score {customer.potentialScore}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedCustomer && (
        <section className="detail-panel panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Lead Detail</span>
              <h2>{selectedCustomer.accountName}</h2>
            </div>
            <StageBadge stage={selectedCustomer.stage} />
          </div>

          <div className="hero-facts">
            <div>
              <span className="muted-label">Potential score</span>
              <strong>{selectedCustomer.potentialScore}/100</strong>
            </div>
            <div>
              <span className="muted-label">Owner</span>
              <strong>{getOwnerName(appState, selectedCustomer.ownerId)}</strong>
            </div>
            <div>
              <span className="muted-label">Energy months</span>
              <strong>{selectedCustomer.energyHistory.length} entries</strong>
            </div>
          </div>

          <div className="detail-grid">
            <article className="subpanel">
              <h3>Customer Snapshot</h3>
              <p>{selectedCustomer.note}</p>
              <div className="kv-grid">
                <span>Contact</span>
                <strong>{selectedCustomer.phone}</strong>
                <span>Email</span>
                <strong>{selectedCustomer.email}</strong>
                <span>Address</span>
                <strong>{selectedCustomer.address}</strong>
              </div>
              <div className="tag-row">
                {selectedCustomer.tags.map((tag) => (
                  <Badge key={tag} tone="slate">
                    {tag}
                  </Badge>
                ))}
              </div>
              {openQuoteExists && (
                <div className="warning-banner">
                  <AlertTriangle size={18} />
                  Lead นี้มี quotation ที่ยังเปิดค้างอยู่แล้ว ควรเช็ก revision ก่อนสร้างซ้ำ
                </div>
              )}
              {!selectedCustomer.latitude || !selectedCustomer.longitude ? (
                <div className="warning-banner warning-soft">
                  <MapPinned size={18} />
                  ยังไม่มีพิกัดหน้างานครบ Route planning จะใช้โหมด mock เท่านั้น
                </div>
              ) : null}
              {selectedCustomer.energyHistory.length < 6 ? (
                <div className="warning-banner warning-soft">
                  <AlertTriangle size={18} />
                  ข้อมูลใช้ไฟย้อนหลังยังไม่ครบ 6 เดือน จึงควร review sizing ก่อนส่งราคา
                </div>
              ) : null}
            </article>

            <article className="subpanel">
              <div className="subpanel-header">
                <h3>Usage Trend</h3>
                <Badge tone="teal">
                  Avg bill{' '}
                  {formatCurrency(
                    selectedCustomer.energyHistory.reduce(
                      (sum, item) => sum + item.bill,
                      0,
                    ) / Math.max(selectedCustomer.energyHistory.length, 1),
                  )}
                </Badge>
              </div>
              <EnergyBars customer={selectedCustomer} />
              <div className="panel-divider" />
              <div className="stage-actions">
                <label className="field">
                  <span>เปลี่ยน owner</span>
                  <select
                    value={selectedCustomer.ownerId}
                    onChange={(event) =>
                      handleOwnerChange(selectedCustomer.id, event.target.value)
                    }
                    disabled={
                      !['Manager', 'Admin'].includes(currentUser.role)
                    }
                  >
                    {appState.users
                      .filter((user) => user.role === 'Sales')
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>เปลี่ยน  stage</span>
                  <select
                    value={selectedCustomer.stage}
                    onChange={(event) =>
                      handleStageChange(
                        selectedCustomer.id,
                        event.target.value as CustomerRecord['stage'],
                      )
                    }
                  >
                    {LEAD_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="action-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setActiveTab('calculator')}
                  >
                    เปิด Solar sizing
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setActiveTab('quotes')}
                  >
                    เปิด Quotation studio
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div className="mini-columns">
            <article className="subpanel compact">
              <div className="subpanel-header">
                <h3>Visit history</h3>
                <Badge tone="blue">{selectedCustomerVisits.length} records</Badge>
              </div>
              <div className="mini-stack">
                {selectedCustomerVisits.length ? (
                  selectedCustomerVisits.map((visit) => (
                    <div key={visit.id} className="mini-item">
                      <strong>{visit.summary}</strong>
                      <span>
                        {visit.status} •{' '}
                        {new Date(visit.scheduledAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">ยังไม่มี visit report สำหรับ lead นี้</p>
                )}
              </div>
            </article>

            <article className="subpanel compact">
              <div className="subpanel-header">
                <h3>Quotation revisions</h3>
                <Badge tone="rose">{selectedCustomerQuotes.length} revisions</Badge>
              </div>
              <div className="mini-stack">
                {selectedCustomerQuotes.length ? (
                  selectedCustomerQuotes.map((quote) => (
                    <button
                      type="button"
                      key={quote.id}
                      className="mini-item button-reset"
                      onClick={() =>
                        startTransition(() => {
                          setSelectedQuoteId(quote.id)
                          setActiveTab('quotes')
                        })
                      }
                    >
                      <strong>{quote.documentNumber}</strong>
                      <span>
                        {quote.packageSnapshot.name} •{' '}
                        {formatCurrency(quote.finalPrice)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="empty-copy">ยังไม่มี quotation สำหรับ lead นี้</p>
                )}
              </div>
            </article>
          </div>
        </section>
      )}
    </div>
  )

  const renderCalculator = () => (
    selectedCustomer &&
    recommendation && (
      <div className="tab-layout">
        <section className="grid-panels calculator-grid">
          <article className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Rule-based AI Assistant</span>
                <h2>Solar Load Calculator</h2>
              </div>
              <Badge tone="amber">Demo only • no external API</Badge>
            </div>
            <div className="calculator-controls">
              <label className="field">
                <span>ลูกค้า</span>
                <select
                  value={selectedCustomer.id}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                >
                  {appState.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.accountName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Roof area (sqm)</span>
                <input value={selectedCustomer.roofArea} readOnly />
              </label>
              <label className="field">
                <span>Daytime load ratio</span>
                <input value={`${selectedCustomer.daytimeLoadRatio}%`} readOnly />
              </label>
              <label className="field field-wide">
                <span>Manual override size</span>
                <input
                  type="range"
                  min="3"
                  max={Math.max(12, Math.ceil(selectedCustomer.roofArea / 7))}
                  step="0.5"
                  value={manualKw ?? recommendation.recommendedSizeKw}
                  onChange={(event) => setManualKw(Number(event.target.value))}
                />
                <strong>{formatNumber(manualKw ?? recommendation.recommendedSizeKw)} kW</strong>
              </label>
            </div>
            <div className="scenario-grid">
              <MetricCard
                tone="amber"
                icon={SunMedium}
                label="Recommended size"
                value={`${formatNumber(recommendation.recommendedSizeKw)} kW`}
                hint={`${recommendation.panelCount} panels estimated`}
              />
              <MetricCard
                tone="teal"
                icon={TrendingUp}
                label="Annual savings"
                value={formatCompact(recommendation.estimatedAnnualSavings)}
                hint={`Offset ${recommendation.estimatedOffsetPercent}% ของการใช้ไฟเดิม`}
              />
              <MetricCard
                tone="blue"
                icon={Sparkles}
                label="Payback"
                value={`${formatNumber(recommendation.paybackYears)} ปี`}
                hint={`ROI ประมาณ ${formatNumber(recommendation.roiPercent)}%`}
              />
            </div>
          </article>

          <article className="panel recommendation-panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Recommended package</span>
                <h2>{recommendation.recommendedPackage?.name ?? 'No active package'}</h2>
              </div>
              {recommendation.recommendedPackage ? (
                <Badge tone="emerald">Package match ready</Badge>
              ) : (
                <Badge tone="charcoal">No active package</Badge>
              )}
            </div>
            {recommendation.recommendedPackage ? (
              <>
                <div className="package-hero">
                  <div>
                    <span className="muted-label">System size</span>
                    <strong>
                      {formatNumber(
                        recommendation.recommendedPackage.systemSizeKw,
                      )}{' '}
                      kW
                    </strong>
                  </div>
                  <div>
                    <span className="muted-label">Monthly production</span>
                    <strong>
                      {formatCompact(
                        recommendation.recommendedPackage.monthlyProduction,
                      )}{' '}
                      kWh
                    </strong>
                  </div>
                  <div>
                    <span className="muted-label">Package price</span>
                    <strong>
                      {formatCurrency(recommendation.recommendedPackage.price)}
                    </strong>
                  </div>
                </div>
                <div className="kv-grid">
                  <span>Panels</span>
                  <strong>{recommendation.recommendedPackage.panelCount}</strong>
                  <span>Inverter</span>
                  <strong>{recommendation.recommendedPackage.inverter}</strong>
                  <span>Promo</span>
                  <strong>
                    {recommendation.recommendedPackage.promo ?? 'Standard SLA'}
                  </strong>
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleCreateQuotation}
                  >
                    สร้าง draft quotation
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setManualKw(null)}
                  >
                    Reset sizing
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-copy">
                ยังไม่มี package ที่ active ใกล้กับขนาดที่ระบบแนะนำ
              </p>
            )}
          </article>
        </section>
      </div>
    )
  )

  const renderVisits = () => (
    selectedCustomer && (
      <div className="tab-layout visits-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Field playbook</span>
              <h2>Plan next customer visit</h2>
            </div>
            <Badge tone="blue">{selectedCustomer.accountName}</Badge>
          </div>
          <form className="form-grid" onSubmit={handleCreateVisit}>
            <label className="field">
              <span>Scheduled at</span>
              <input
                type="datetime-local"
                value={visitDraft.scheduledAt}
                onChange={(event) =>
                  setVisitDraft((draft) => ({
                    ...draft,
                    scheduledAt: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Location</span>
              <input
                value={visitDraft.location}
                onChange={(event) =>
                  setVisitDraft((draft) => ({
                    ...draft,
                    location: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field field-wide">
              <span>Visit objective</span>
              <textarea
                rows={4}
                value={visitDraft.summary}
                onChange={(event) =>
                  setVisitDraft((draft) => ({
                    ...draft,
                    summary: event.target.value,
                  }))
                }
                placeholder="เช่น ตรวจหลังคา, สอบถาม peak load, ขอข้อมูล meter เพิ่มเติม"
              />
            </label>
            <label className="field">
              <span>Expected outcome</span>
              <select
                value={visitDraft.outcome}
                onChange={(event) =>
                  setVisitDraft((draft) => ({
                    ...draft,
                    outcome: event.target.value as VisitOutcome,
                  }))
                }
              >
                <option value="Interested">Interested</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Closed Won">Closed Won</option>
              </select>
            </label>
            <label className="field">
              <span>Next action</span>
              <input
                value={visitDraft.nextAction}
                onChange={(event) =>
                  setVisitDraft((draft) => ({
                    ...draft,
                    nextAction: event.target.value,
                  }))
                }
              />
            </label>
            <div className="action-row">
              <button type="submit" className="primary-button">
                บันทึกแผนเข้าพบ
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Visit timeline</span>
              <h2>Upcoming and recent reports</h2>
            </div>
            <Badge tone="teal">{appState.visits.length} total visits</Badge>
          </div>
          <div className="activity-stack">
            {appState.visits
              .slice()
              .sort(
                (left, right) =>
                  new Date(right.scheduledAt).getTime() -
                  new Date(left.scheduledAt).getTime(),
              )
              .map((visit) => {
                const customer = appState.customers.find(
                  (item) => item.id === visit.customerId,
                )
                return (
                  <div key={visit.id} className="timeline-card">
                    <div className="timeline-top">
                      <div>
                        <strong>{customer?.accountName}</strong>
                        <span>{visit.summary}</span>
                      </div>
                      <Badge tone={visit.status === 'Completed' ? 'teal' : 'blue'}>
                        {visit.status}
                      </Badge>
                    </div>
                    <div className="timeline-meta">
                      <span>
                        {new Date(visit.scheduledAt).toLocaleString('th-TH', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <span>{visit.location}</span>
                      <span>{visit.nextAction}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      </div>
    )
  )

  const renderQuotations = () => (
    <div className="tab-layout quotes-grid">
      <section className="list-panel panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Document control</span>
            <h2>Quotation revisions</h2>
          </div>
          <Badge tone="rose">
            {
              appState.quotations.filter(
                (quote) => quote.status === 'Pending Approval',
              ).length
            }{' '}
            waiting
          </Badge>
        </div>
        <div className="list-scroll">
          {appState.quotations.map((quote) => (
            <button
              type="button"
              key={quote.id}
              className={`quote-list-card${
                quote.id === selectedQuote?.id ? ' is-selected' : ''
              }`}
              onClick={() =>
                startTransition(() => {
                  setSelectedQuoteId(quote.id)
                  setSelectedCustomerId(quote.customerId)
                })
              }
            >
              <div className="customer-list-head">
                <strong>{quote.documentNumber}</strong>
                <QuoteStatusBadge status={quote.status} />
              </div>
              <span>{quote.customerSnapshot.accountName}</span>
              <div className="customer-list-meta">
                <span>Rev {quote.revision}</span>
                <span>{quote.packageSnapshot.name}</span>
                <span>{formatCompact(quote.finalPrice)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedQuote && (
        <section className="detail-panel panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Quotation detail</span>
              <h2>{selectedQuote.documentNumber}</h2>
            </div>
            <QuoteStatusBadge status={selectedQuote.status} />
          </div>

          <div className="detail-grid">
            <article className="subpanel">
              <div className="subpanel-header">
                <h3>Commercial snapshot</h3>
                <Badge tone="amber">{selectedQuote.customerSnapshot.accountName}</Badge>
              </div>
              <div className="kv-grid">
                <span>Package</span>
                <strong>{selectedQuote.packageSnapshot.name}</strong>
                <span>System size</span>
                <strong>{selectedQuote.packageSnapshot.systemSizeKw} kW</strong>
                <span>Revision</span>
                <strong>{selectedQuote.revision}</strong>
                <span>Estimated payback</span>
                <strong>{selectedQuote.estimatedPaybackYears} ปี</strong>
              </div>
              <div className="quote-pricing">
                <div>
                  <span className="muted-label">Base price</span>
                  <strong>{formatCurrency(selectedQuote.basePrice)}</strong>
                </div>
                <div>
                  <span className="muted-label">Discount</span>
                  <strong>{formatCurrency(selectedQuote.discountAmount)}</strong>
                </div>
                <div>
                  <span className="muted-label">Final price</span>
                  <strong>{formatCurrency(selectedQuote.finalPrice)}</strong>
                </div>
              </div>
              <div className="line-item-list">
                {selectedQuote.lineItems.map((item) => (
                  <div key={`${selectedQuote.id}-${item.label}`} className="line-item">
                    <span>{item.label}</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="subpanel">
              <div className="subpanel-header">
                <h3>Workflow controls</h3>
                <Badge tone={roleTone[currentUser.role]}>{currentUser.role}</Badge>
              </div>
              <label className="field">
                <span>Discount %</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={discountDraft}
                  onChange={(event) => setDiscountDraft(Number(event.target.value))}
                  disabled={selectedQuote.locked}
                />
              </label>
              <p className="helper-copy">
                สิทธิ์ของคุณลดได้สูงสุด {currentUser.discountCap}% หากเกินจากนี้ระบบจะบังคับเข้า approval queue
              </p>
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSaveDiscount}
                  disabled={selectedQuote.locked}
                >
                  Save pricing
                </button>
                {selectedQuote.requiresApproval &&
                selectedQuote.status === 'Draft' ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleRequestApproval}
                  >
                    ขออนุมัติส่วนลด
                  </button>
                ) : null}
                {!selectedQuote.requiresApproval &&
                ['Draft', 'Approved'].includes(selectedQuote.status) ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSendProposal}
                  >
                    ส่ง proposal ให้ลูกค้า
                  </button>
                ) : null}
                {selectedQuote.status === 'Approved' ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleSendProposal}
                  >
                    Lock & send
                  </button>
                ) : null}
              </div>

              <label className="field field-wide">
                <span>Approval note</span>
                <textarea
                  rows={3}
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  placeholder="เหตุผลประกอบการอนุมัติหรือเงื่อนไขพิเศษ"
                />
              </label>
              {selectedQuote.status === 'Pending Approval' && canApprove ? (
                <div className="action-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleApproval('Approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary-button danger"
                    onClick={() => handleApproval('Rejected')}
                  >
                    Reject
                  </button>
                </div>
              ) : null}

              <div className="approval-trail">
                <strong>Approval trail</strong>
                {selectedQuote.approvalTrail.length ? (
                  selectedQuote.approvalTrail.map((item) => (
                    <div
                      key={`${selectedQuote.id}-${item.at}`}
                      className="mini-item mini-item-static"
                    >
                      <strong>
                        {item.decision} by {item.by}
                      </strong>
                      <span>{item.comment}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">ยังไม่มีประวัติการอนุมัติ</p>
                )}
              </div>
            </article>
          </div>

          <article className="subpanel signature-shell">
            <div className="subpanel-header">
              <h3>Digital signature</h3>
              <Badge tone="teal">Option A • onsite signature</Badge>
            </div>
            <label className="field">
              <span>Signer name</span>
              <input
                value={signatureName}
                onChange={(event) => setSignatureName(event.target.value)}
                placeholder="ชื่อลูกค้าที่เซ็น"
                disabled={
                  !['Proposal Sent', 'Approved'].includes(selectedQuote.status) &&
                  selectedQuote.status !== 'Signed'
                }
              />
            </label>
            <SignaturePad
              value={draftSignature}
              onChange={setDraftSignature}
              disabled={
                !['Proposal Sent', 'Approved'].includes(selectedQuote.status) &&
                selectedQuote.status !== 'Signed'
              }
            />
            <div className="action-row">
              <button
                type="button"
                className="primary-button"
                onClick={handleSignQuotation}
                disabled={!['Proposal Sent', 'Approved'].includes(selectedQuote.status)}
              >
                บันทึกการเซ็นเอกสาร
              </button>
            </div>
            {selectedQuote.signature ? (
              <div className="signature-preview">
                <span className="muted-label">
                  Signed at{' '}
                  {new Date(selectedQuote.signature.signedAt).toLocaleString('th-TH')}
                </span>
                <img src={selectedQuote.signature.image} alt="Customer signature" />
              </div>
            ) : null}
          </article>
        </section>
      )}
    </div>
  )

  const renderPackages = () => (
    <div className="tab-layout packages-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Master data</span>
            <h2>Package catalog</h2>
          </div>
          <Badge tone="emerald">
            {appState.packages.filter((item) => item.active).length} active
          </Badge>
        </div>
        <div className="package-list">
          {appState.packages.map((item) => (
            <article key={item.id} className="package-card">
              <div className="customer-list-head">
                <strong>{item.name}</strong>
                <Badge tone={item.active ? 'emerald' : 'charcoal'}>
                  {item.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p>
                {item.systemSizeKw} kW • {item.panelCount} panels • {item.inverter}
              </p>
              <div className="package-price">
                <strong>{formatCurrency(item.price)}</strong>
                <span>{item.promo ?? 'Standard package'}</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleTogglePackage(item.id)}
                disabled={!canManagePackages}
              >
                {item.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Admin composer</span>
            <h2>Create demo package</h2>
          </div>
          <Badge tone={roleTone[currentUser.role]}>{currentUser.role}</Badge>
        </div>
        <form className="form-grid" onSubmit={handleCreatePackage}>
          <label className="field">
            <span>Package name</span>
            <input
              value={packageDraft.name}
              onChange={(event) =>
                setPackageDraft((draft) => ({
                  ...draft,
                  name: event.target.value,
                }))
              }
              disabled={!canManagePackages}
            />
          </label>
          <label className="field">
            <span>System size kW</span>
            <input
              type="number"
              value={packageDraft.systemSizeKw}
              onChange={(event) =>
                setPackageDraft((draft) => ({
                  ...draft,
                  systemSizeKw: event.target.value,
                }))
              }
              disabled={!canManagePackages}
            />
          </label>
          <label className="field">
            <span>Panel count</span>
            <input
              type="number"
              value={packageDraft.panelCount}
              onChange={(event) =>
                setPackageDraft((draft) => ({
                  ...draft,
                  panelCount: event.target.value,
                }))
              }
              disabled={!canManagePackages}
            />
          </label>
          <label className="field">
            <span>Inverter</span>
            <input
              value={packageDraft.inverter}
              onChange={(event) =>
                setPackageDraft((draft) => ({
                  ...draft,
                  inverter: event.target.value,
                }))
              }
              disabled={!canManagePackages}
            />
          </label>
          <label className="field">
            <span>Price</span>
            <input
              type="number"
              value={packageDraft.price}
              onChange={(event) =>
                setPackageDraft((draft) => ({
                  ...draft,
                  price: event.target.value,
                }))
              }
              disabled={!canManagePackages}
            />
          </label>
          <label className="field field-wide">
            <span>Promotion</span>
            <input
              value={packageDraft.promo}
              onChange={(event) =>
                setPackageDraft((draft) => ({
                  ...draft,
                  promo: event.target.value,
                }))
              }
              disabled={!canManagePackages}
            />
          </label>
          <div className="action-row">
            <button
              type="submit"
              className="primary-button"
              disabled={!canManagePackages}
            >
              เพิ่ม package
            </button>
          </div>
        </form>
        {!canManagePackages ? (
          <div className="warning-banner warning-soft">
            <ShieldCheck size={18} />
            สลับ persona เป็น Admin เพื่อทดสอบ package management แบบแก้ไขได้
          </div>
        ) : null}
      </section>
    </div>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-badge">
            <SunMedium size={22} />
          </div>
          <div>
            <span className="eyebrow">Solar Integrated Platform</span>
            <h1>SOLAR OS</h1>
          </div>
          <p>
            React + Vite demo ที่รีเฟอเรนซ์จาก Stitch export จริง และยังคงใช้{' '}
            <code>localStorage</code> สำหรับการจำลอง flow ทั้งหมด
          </p>
        </div>

        <nav className="nav-stack">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-button${activeTab === item.key ? ' is-active' : ''}`}
                onClick={() => setActiveTab(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-card">
          <div className="panel-header compact-header">
            <div>
              <span className="eyebrow">Role switcher</span>
              <h2>Persona simulator</h2>
            </div>
          </div>
          <select
            className="persona-select"
            value={currentUser.id}
            onChange={(event) => setActiveUser(event.target.value)}
          >
            {appState.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} • {user.role}
              </option>
            ))}
          </select>
          <div className="persona-chip">
            <Badge tone={roleTone[currentUser.role]}>{currentUser.role}</Badge>
            <span>
              ลดราคาได้สูงสุด {currentUser.discountCap}% • zone {currentUser.zone}
            </span>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="panel-header compact-header">
            <div>
              <span className="eyebrow">Recent audit</span>
              <h2>Trail</h2>
            </div>
          </div>
          <div className="mini-stack">
            {appState.auditLog.slice(0, 4).map((item) => (
              <div key={item.id} className="mini-item mini-item-static">
                <strong>{item.action.replaceAll('_', ' ')}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">อิงจาก Stitch export ที่คุณให้มา</span>
            <h2>
              ระบบขาย Solar แบบครบ flow ตั้งแต่ลีดจนถึงปิดการขาย
            </h2>
            <p>
              โครงสร้างข้อมูลและ interaction ยังเป็น demo แบบเล่นได้จริง แต่ visual
              language รอบนี้จะยึด design system จากไฟล์ Stitch export เป็นหลัก
            </p>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleExportSnapshot}
            >
              <Download size={16} />
              Export snapshot
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleResetDemo}
            >
              <RefreshCcw size={16} />
              Reset demo
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'crm' && renderCRM()}
        {activeTab === 'calculator' && renderCalculator()}
        {activeTab === 'visits' && renderVisits()}
        {activeTab === 'quotes' && renderQuotations()}
        {activeTab === 'packages' && renderPackages()}

        <footer className="workspace-footer">
          <div className="footer-chip">
            <ClipboardList size={16} />
            Running number ล่าสุด {appState.docRunning}
          </div>
          <div className="footer-chip">
            <Route size={16} />
            ไม่มี database จริง • state จำลองผ่าน local persistence
          </div>
          <div className="footer-chip">
            <FileSignature size={16} />
            Signature ภายใน demo ถูกเก็บเป็นภาพใน browser
          </div>
        </footer>
      </main>

      <nav className="mobile-nav">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              className={`mobile-nav-button${
                activeTab === item.key ? ' is-active' : ''
              }`}
              onClick={() => setActiveTab(item.key)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default App
