import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GroundPortalShell } from "../components/groundPortal/GroundPortalShell";
import {
  fetchGroundQueue,
  updateExecutionStatus,
  type GroundQueueRow,
  type ExecutionStatus,
} from "../lib/groundPortal";
import "../styles/ground-portal.css";

const STATUS_LABEL: Record<ExecutionStatus, string> = {
  not_started: "لم تبدأ",
  accepted: "تم القبول",
  in_progress: "جاري التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  no_show: "لم يحضر الراكب",
};

function formatTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

export function GroundPortalQueuePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<GroundQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [flipping, setFlipping] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchGroundQueue();
      setRows(data);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/ground-portal/login");
        return;
      }
      setError("تعذر تحميل الطابور");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000); // refresh every 30s — this is a live ops screen
    return () => clearInterval(interval);
  }, [load]);

  async function handleAction(row: GroundQueueRow, newStatus: ExecutionStatus) {
    setFlipping(row.order_item_id);
    try {
      await updateExecutionStatus(row.order_item_id, newStatus);
      await load();
    } catch (e) {
      setError("تعذر تحديث حالة المهمة");
    } finally {
      setTimeout(() => setFlipping(null), 450);
    }
  }

  function renderActions(row: GroundQueueRow) {
    switch (row.execution_status) {
      case "not_started":
        return (
          <button className="gp-btn" onClick={() => handleAction(row, "accepted")}>
            قبول
          </button>
        );
      case "accepted":
        return (
          <>
            <button className="gp-btn" onClick={() => handleAction(row, "in_progress")}>
              بدء
            </button>
            <button className="gp-btn danger" onClick={() => handleAction(row, "no_show")}>
              لم يحضر
            </button>
          </>
        );
      case "in_progress":
        return (
          <>
            <button className="gp-btn" onClick={() => handleAction(row, "completed")}>
              إنجاز
            </button>
            <button className="gp-btn danger" onClick={() => handleAction(row, "failed")}>
              فشل
            </button>
          </>
        );
      default:
        return <span style={{ color: "#6b7a93", fontSize: 12.5 }}>—</span>;
    }
  }

  return (
    <GroundPortalShell active="queue" queue={rows}>
      <div className="gp-section-label">مهام اليوم — مرتبة بالأقرب موعد رحلة</div>

      {error && (
        <div className="gp-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="gp-board">
        {loading ? (
          <div className="gp-empty">جارِ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="gp-empty">لا توجد مهام حاليًا</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.order_item_id}
              className={`gp-row ${flipping === row.order_item_id ? "flip" : ""}`}
            >
              <div className={`gp-sla-bar ${row.sla_state}`} />

              <div className="gp-flight">
                <div className="gp-flight-num">{row.flight_number ?? "—"}</div>
                <div className="gp-route">
                  {row.from_airport ?? "؟"} → {row.to_airport ?? "؟"}
                </div>
                <div className="gp-time">{formatTime(row.scheduled_departure_at)}</div>
              </div>

              <div className="gp-passenger">
                <div className="gp-passenger-name">{row.customer_name ?? "بدون اسم"}</div>
                <div className="gp-service">{row.service_name}</div>
              </div>

              <div className="gp-status">
                <span className={`gp-status-pill ${row.execution_status}`}>
                  <span className="gp-status-dot" />
                  {STATUS_LABEL[row.execution_status]}
                </span>
              </div>

              <div className="gp-actions">{renderActions(row)}</div>
            </div>
          ))
        )}
      </div>
    </GroundPortalShell>
  );
}
