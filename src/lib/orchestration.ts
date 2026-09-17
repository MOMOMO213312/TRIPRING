import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";

// ── Types ────────────────────────────────────────────────────────────────
// These tables/views were added directly on the production DB across the
// Phase 1-6 orchestration-architecture sessions and were never added to
// src/types/database.ts (which is otherwise hand-maintained, not
// generated). Typed locally here rather than touching the shared file, per
// the "لا نكسر الموجود — إضافي دايمًا" principle.

export type SupplierOrgType =
  | "agency"
  | "airline"
  | "ground_provider"
  | "transport_provider"
  | "rental_provider"
  | "hotel_provider"
  | "experience_provider";

export type SupplierStatus = "active" | "inactive" | "pending";

export type SupplierRow = {
  id: string;
  type: SupplierOrgType;
  name: string;
  status: SupplierStatus;
  country_code: string | null;
  currency: string;
  api_enabled: boolean;
  priority: number;
  reliability_score: number | null;
  sla_notes: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  linked_agency_id: string | null;
  linked_service_provider_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierCommercialModel = "markup" | "commission" | "fixed_fee";
export type SupplierContractStatus = "draft" | "active" | "suspended" | "ended";

export type SupplierContractRow = {
  id: string;
  supplier_id: string;
  status: SupplierContractStatus;
  commercial_model: SupplierCommercialModel;
  markup_percent: number | null;
  commission_percent: number | null;
  fixed_fee_amount: number | null;
  currency: string;
  settlement_terms: string | null;
  payment_terms: string | null;
  sla_hours: number | null;
  cancellation_rules: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderNeedingAttentionRow = {
  id: string;
  order_number: number;
  booking_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  agency_id: string | null;
  channel: string;
  status: string;
  currency: string | null;
  total_price: number;
  commission_amount: number;
  created_at: string;
  updated_at: string;
  fulfillment_summary: string;
  stuck_items: number;
};

export type NegativeMarginItemRow = {
  order_item_id: string;
  order_id: string;
  order_number: number;
  item_type: string;
  reference_label: string | null;
  quantity: number;
  customer_price: number;
  supplier_cost: number | null;
  margin_amount: number;
  supplier_id: string | null;
  supplier_name: string | null;
  fulfillment_status: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  item_type: string;
  supplier_id: string | null;
  reference_table: string | null;
  reference_id: string | null;
  reference_label: string | null;
  quantity: number;
  supplier_cost: number | null;
  customer_price: number;
  commercial_model: SupplierCommercialModel | null;
  margin_amount: number;
  status: string;
  fulfillment_status: string;
  created_at: string;
};

export type OrderItemStatusLogRow = {
  id: string;
  order_item_id: string;
  old_status: string | null;
  new_status: string;
  old_supplier_id: string | null;
  new_supplier_id: string | null;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type SupplierBalanceRow = {
  supplier_id: string;
  supplier_name: string;
  supplier_type: SupplierOrgType;
  total_cost_owed: number;
  unsettled_cost: number;
  total_paid_out: number;
  outstanding_balance: number;
  platform_margin_earned: number;
};

export type UnsettledSupplierItemRow = {
  supplier_id: string;
  supplier_name: string;
  order_id: string;
  order_number: number;
  order_item_id: string;
  item_type: string;
  supplier_cost: number;
  currency: string;
  occurred_at: string;
};

export type SettlementStatus = "draft" | "pending" | "paid" | "disputed" | "cancelled";

export type SupplierSettlementRow = {
  id: string;
  supplier_id: string;
  contract_id: string | null;
  period_start: string;
  period_end: string;
  currency: string;
  gross_customer_amount: number;
  supplier_cost_total: number;
  platform_margin_total: number;
  amount_due_supplier: number;
  amount_paid: number;
  items_count: number;
  status: SettlementStatus;
  generated_at: string;
  generated_by: string | null;
  paid_at: string | null;
  payment_ref: string | null;
  notes: string | null;
};

export type SubscriptionRevenueRow = {
  id: string;
  subscription_id: string;
  customer_id: string | null;
  amount: number;
  currency: string;
  occurred_at: string;
  billing_period: string;
  subscription_status: string;
  tier_name: string;
};

// ── Suppliers ────────────────────────────────────────────────────────────

export const SUPPLIER_TYPE_LABELS: Record<SupplierOrgType, string> = {
  agency: "وكالة سياحة",
  airline: "شركة طيران",
  ground_provider: "مزود خدمات أرضية",
  transport_provider: "مزود نقل (GoAir)",
  rental_provider: "مزود تأجير سيارات",
  hotel_provider: "مزود فنادق",
  experience_provider: "مزود تجارب/أنشطة",
};

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  pending: "بانتظار المراجعة",
};

export async function fetchAllSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await supabase.from("suppliers").select("*").order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(input: {
  type: SupplierOrgType;
  name: string;
  status?: SupplierStatus;
  countryCode?: string | null;
  currency?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWhatsapp?: string | null;
  slaNotes?: string | null;
  notes?: string | null;
}): Promise<SupplierRow> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      type: input.type,
      name: input.name,
      status: input.status ?? "pending",
      country_code: input.countryCode ?? null,
      currency: input.currency ?? "USD",
      contact_phone: input.contactPhone ?? null,
      contact_email: input.contactEmail ?? null,
      contact_whatsapp: input.contactWhatsapp ?? null,
      sla_notes: input.slaNotes ?? null,
      notes: input.notes ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SupplierRow;
}

export async function updateSupplier(
  supplierId: string,
  patch: Partial<
    Pick<
      SupplierRow,
      | "name"
      | "status"
      | "priority"
      | "reliability_score"
      | "sla_notes"
      | "contact_phone"
      | "contact_email"
      | "contact_whatsapp"
      | "notes"
    >
  >,
): Promise<void> {
  const { error } = await supabase.from("suppliers").update(patch as never).eq("id", supplierId);
  if (error) throw new Error(error.message);
}

// ── Supplier contracts ──────────────────────────────────────────────────

export async function fetchSupplierContracts(supplierId: string): Promise<SupplierContractRow[]> {
  const { data, error } = await supabase
    .from("supplier_contracts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierContractRow[];
}

export async function createSupplierContract(input: {
  supplierId: string;
  commercialModel: SupplierCommercialModel;
  markupPercent?: number | null;
  commissionPercent?: number | null;
  fixedFeeAmount?: number | null;
  currency?: string;
  settlementTerms?: string | null;
  paymentTerms?: string | null;
  slaHours?: number | null;
  cancellationRules?: string | null;
  startsAt?: string | null;
  status?: SupplierContractStatus;
}): Promise<SupplierContractRow> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("supplier_contracts")
    .insert({
      supplier_id: input.supplierId,
      status: input.status ?? "active",
      commercial_model: input.commercialModel,
      markup_percent: input.markupPercent ?? null,
      commission_percent: input.commissionPercent ?? null,
      fixed_fee_amount: input.fixedFeeAmount ?? null,
      currency: input.currency ?? "USD",
      settlement_terms: input.settlementTerms ?? null,
      payment_terms: input.paymentTerms ?? null,
      sla_hours: input.slaHours ?? null,
      cancellation_rules: input.cancellationRules ?? null,
      starts_at: input.startsAt ?? new Date().toISOString().slice(0, 10),
      created_by: user?.id ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SupplierContractRow;
}

export async function setSupplierContractStatus(contractId: string, status: SupplierContractStatus): Promise<void> {
  const { error } = await supabase.from("supplier_contracts").update({ status } as never).eq("id", contractId);
  if (error) throw new Error(error.message);
}

// ── Fulfillment Monitor (Phase 7.2) ─────────────────────────────────────

export async function fetchOrdersNeedingAttention(): Promise<OrderNeedingAttentionRow[]> {
  // v_orders_needing_attention has no grants and no admin check of its own
  // (raw customer PII) -- go through the admin-only RPC wrapper instead of
  // querying the view directly (fixed 2026-09-17, same pattern as the
  // Ground Portal fix).
  const { data, error } = await supabase.rpc("get_admin_orders_needing_attention");
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderNeedingAttentionRow[];
}

export async function fetchNegativeMarginItems(): Promise<NegativeMarginItemRow[]> {
  // v_negative_margin_items has no grants and no admin check of its own --
  // go through the admin-only RPC wrapper instead of querying the view
  // directly (fixed 2026-09-17, same pattern as the Ground Portal fix).
  const { data, error } = await supabase.rpc("get_admin_negative_margin_items");
  if (error) throw new Error(error.message);
  return (data ?? []) as NegativeMarginItemRow[];
}

export async function fetchOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderItemRow[];
}

export async function fetchOrderItemStatusLog(orderItemId: string): Promise<OrderItemStatusLogRow[]> {
  const { data, error } = await supabase
    .from("order_item_status_log")
    .select("*")
    .eq("order_item_id", orderItemId)
    .order("changed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderItemStatusLogRow[];
}

/** Re-runs assignment for an item still pending (e.g. after a supplier came back online). */
export async function assignOrderItem(orderItemId: string): Promise<string> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.rpc("assign_order_item", {
    p_order_item_id: orderItemId,
    p_changed_by: user?.id ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

/** Manual fallback trigger — moves a stuck/failed item to the next-best supplier. */
export async function reassignOrderItem(orderItemId: string, reason: string): Promise<string> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.rpc("reassign_order_item", {
    p_order_item_id: orderItemId,
    p_reason: reason,
    p_changed_by: user?.id ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Marks a non-flight (service) item as actually delivered. Temporary admin-only
 * action until the ground-provider portal (Phase 7.7) can call this itself.
 * Only legal confirmed -> fulfilled; flight items are advanced automatically by
 * trg_booking_fulfillment_from_status on ticket issuance, never through this path.
 */
export async function markServiceItemFulfilled(orderItemId: string, reason?: string): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase.rpc("mark_service_item_fulfilled", {
    p_order_item_id: orderItemId,
    p_changed_by: user?.id ?? null,
    p_reason: reason ?? "service marked delivered by admin",
  } as never);
  if (error) throw new Error(error.message);
}

/**
 * Item-level statuses. These MUST match the live
 * `order_items_fulfillment_status_check` constraint exactly — verified
 * against the production DB, not assumed.
 */
export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  pending_assignment: "بانتظار تعيين مورّد",
  assigned: "تم التعيين لمورّد",
  confirmed: "أكّده المورّد",
  fulfilled: "✅ تم التنفيذ",
  failed: "❌ فشل",
  reassigning: "جاري البحث عن بديل (Fallback)",
  cancelled: "ملغي",
};

/**
 * Order-level summary — a DIFFERENT value set from the item-level one above
 * (`orders_fulfillment_summary_check`). Computed by
 * recompute_order_fulfillment_summary() from all the order's items.
 */
export const FULFILLMENT_SUMMARY_LABELS: Record<string, string> = {
  pending_assignment: "بانتظار تعيين الموردين",
  partially_assigned: "تعيين جزئي",
  fully_assigned: "تم تعيين كل الموردين",
  partially_fulfilled: "تم تنفيذ جزء من الطلب",
  fully_fulfilled: "✅ تم تنفيذ الطلب بالكامل",
  needs_attention: "⚠️ يحتاج تدخل",
  cancelled: "ملغي",
};

// ── Settlement Center (Phase 7.3) ───────────────────────────────────────

export async function fetchSupplierBalances(): Promise<SupplierBalanceRow[]> {
  // v_supplier_balances has no grants and no admin check of its own (raw
  // financial data) -- go through the admin-only RPC wrapper instead of
  // querying the view directly (fixed 2026-09-17).
  const { data, error } = await supabase.rpc("get_admin_supplier_balances");
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierBalanceRow[];
}

export async function fetchUnsettledItemsForSupplier(supplierId: string): Promise<UnsettledSupplierItemRow[]> {
  // v_unsettled_supplier_items has no grants and no admin check of its own
  // -- go through the admin-only RPC wrapper instead of querying the view
  // directly (fixed 2026-09-17).
  const { data, error } = await supabase.rpc("get_admin_unsettled_supplier_items", {
    p_supplier_id: supplierId,
  } as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as UnsettledSupplierItemRow[];
}

export async function fetchSettlements(supplierId?: string): Promise<SupplierSettlementRow[]> {
  let query = supabase.from("supplier_settlements").select("*").order("generated_at", { ascending: false });
  if (supplierId) query = query.eq("supplier_id", supplierId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierSettlementRow[];
}

export async function generateSupplierSettlement(
  supplierId: string,
  periodStart: string,
  periodEnd: string,
): Promise<string> {
  const user = await getCurrentUser();
  const { data, error } = await supabase.rpc("generate_supplier_settlement", {
    p_supplier_id: supplierId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_created_by: user?.id ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

export async function markSettlementPaid(settlementId: string, paymentRef: string): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase.rpc("mark_settlement_paid", {
    p_settlement_id: settlementId,
    p_payment_ref: paymentRef,
    p_created_by: user?.id ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  draft: "مسودة",
  pending: "بانتظار السداد",
  paid: "تم السداد",
  disputed: "متنازع عليها",
  cancelled: "ملغاة",
};

// ── Subscription revenue (surfaced here per Phase 7 plan item 4) ────────

export async function fetchSubscriptionRevenue(): Promise<SubscriptionRevenueRow[]> {
  // v_subscription_revenue has no grants and no admin check of its own --
  // go through the admin-only RPC wrapper instead of querying the view
  // directly (fixed 2026-09-17).
  const { data, error } = await supabase.rpc("get_admin_subscription_revenue");
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriptionRevenueRow[];
}
