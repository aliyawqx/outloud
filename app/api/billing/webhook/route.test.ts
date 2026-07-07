import crypto from 'node:crypto'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { setPlanMock, setTrialingMock, markTrialStartedMock, setPolarRefsMock } = vi.hoisted(() => ({
  setPlanMock: vi.fn(),
  setTrialingMock: vi.fn(),
  markTrialStartedMock: vi.fn(),
  setPolarRefsMock: vi.fn(),
}))
const { addCreditsMock, grantPlanMock, grantTrialPoolMock, zeroPlanCreditsMock, packByProductIdMock } = vi.hoisted(() => ({
  addCreditsMock: vi.fn(),
  grantPlanMock: vi.fn(),
  grantTrialPoolMock: vi.fn(),
  zeroPlanCreditsMock: vi.fn(),
  packByProductIdMock: vi.fn(() => undefined),
}))
const { planForProductIdMock } = vi.hoisted(() => ({ planForProductIdMock: vi.fn(() => 'starter') }))

vi.mock('@/lib/profile/store', () => ({
  setPlan: setPlanMock,
  setTrialing: setTrialingMock,
  markTrialStarted: markTrialStartedMock,
  setPolarRefs: setPolarRefsMock,
  setPlanStatus: vi.fn(),
  setBillingPeriod: vi.fn(),
  getProfile: vi.fn(async () => null),
}))
vi.mock('@/lib/credits', () => ({
  addCredits: addCreditsMock,
  grantPlan: grantPlanMock,
  grantTrialPool: grantTrialPoolMock,
  zeroPlanCredits: zeroPlanCreditsMock,
  packByProductId: packByProductIdMock,
  grantUpgradeDelta: vi.fn(),
  PLAN_ALLOWANCE: { free: 10_000, starter: 200_000, pro: 600_000, founder: 1_000_000_000 },
}))
vi.mock('@/lib/billing/plans', () => ({ planForProductId: planForProductIdMock, intervalForProductId: vi.fn(() => 'monthly') }))
vi.mock('@/lib/autopilot/gating', () => ({ dropAutopilotForNonPro: vi.fn(async () => false) }))
vi.mock('@/lib/auth/users', () => ({ getUserByEmail: vi.fn() }))

import { POST } from '@/app/api/billing/webhook/route'

const SECRET = 'whsec_' + Buffer.from('testkey').toString('base64')

function signedReq(event: unknown) {
  const body = JSON.stringify(event)
  const id = 'msg_1'
  const ts = '1700000000'
  const key = Buffer.from(SECRET.slice(6), 'base64')
  const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  return new Request('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: {
      'webhook-id': id,
      'webhook-timestamp': ts,
      'webhook-signature': `v1,${sig}`,
    },
    body,
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.POLAR_WEBHOOK_SECRET = SECRET
  packByProductIdMock.mockReturnValue(undefined)
  planForProductIdMock.mockReturnValue('starter')
})

describe('billing webhook — subscription trial start', () => {
  it('grants the FULL plan allowance on subscription.created (not the 10k trial pool)', async () => {
    const res = await POST(
      signedReq({
        type: 'subscription.created',
        data: { status: 'trialing', product_id: 'prod_starter', metadata: { userId: 'u1' } },
      }),
    )
    expect(res.status).toBe(200)
    expect(grantPlanMock).toHaveBeenCalledWith('u1', 'starter')
    expect(grantTrialPoolMock).not.toHaveBeenCalled()
    // Still flagged as a trial (blocks top-ups, marks trial_used).
    expect(markTrialStartedMock).toHaveBeenCalledWith('u1')
  })
})
