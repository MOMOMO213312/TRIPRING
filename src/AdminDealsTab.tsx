import { useEffect, useState } from "react";

import { AgencyAmadeusPasteModal } from "../agency/AgencyAmadeusPasteModal";
import { AgencyBulkImportModal } from "../agency/AgencyBulkImportModal";
import { AgencyQuickEntryPanel } from "../agency/AgencyQuickEntryPanel";
import { fetchAirlines, fetchAirports } from "../../lib/api";
import { fetchAllAgencies } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { AgencyRow, AirlineRow, AirportRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Select } from "../ui/Select";

// Admin-side equivalent of the agency "العروض" tab: same three import paths
// (quick entry / Excel / Amadeus paste), reused as-is — the only extra step
// here is picking which agency the deals get attributed to, since an admin
// isn't scoped to a single agency the way agency staff are.

type Mode = "quick" | "bulk" | "amadeus" | null;

export function AdminDealsTab() {
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [airports, setAirports] = useState<AirportRow[]>([]);
  const [airlines, setAirlines] = useState<AirlineRow[]>([]);
  const [agencyId, setAgencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAllAgencies(), fetchAirports(), fetchAirlines()])
      .then(([ag, ap, al]) => {
        setAgencies(ag);
        setAirports(ap);
        setAirlines(al);
        if (ag.length > 0) setAgencyId((prev) => prev || ag[0].id);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل بيانات الوكالات", "AdminDealsTab.load")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center text-sm text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Card className="space-y-3">
        <p className="text-sm text-slate-600">
          العروض المُضافة من هنا هتتسجل باسم الوكالة اللي تختارها تحت — مفيش وكالة مختارة يعني مفيش
          حفظ.
        </p>
        <Select
          label="الوكالة"
          options={agencies.map((a) => ({ value: a.id, label: a.name ?? a.id }))}
          value={agencyId}
          onChange={(e) => {
            setAgencyId(e.target.value);
            setMode(null);
          }}
        />
      </Card>

      {agencyId ? (
        <>
          {!mode ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setMode("quick")}>
                ⚡ إدخال سريع (بدون إكسيل)
              </Button>
              <Button variant="outline" onClick={() => setMode("bulk")}>
                📥 استيراد من إكسل
              </Button>
              <Button variant="outline" onClick={() => setMode("amadeus")}>
                📋 لصق من أماديوس
              </Button>
            </div>
          ) : null}

          {mode === "quick" ? (
            <AgencyQuickEntryPanel
              agencyId={agencyId}
              airports={airports}
              airlines={airlines}
              key={`quick-${agencyId}-${refreshKey}`}
              onClose={() => setMode(null)}
              onImported={() => setRefreshKey((k) => k + 1)}
            />
          ) : null}

          {mode === "bulk" ? (
            <AgencyBulkImportModal
              agencyId={agencyId}
              airports={airports}
              airlines={airlines}
              key={`bulk-${agencyId}-${refreshKey}`}
              onClose={() => setMode(null)}
              onImported={() => setRefreshKey((k) => k + 1)}
            />
          ) : null}

          {mode === "amadeus" ? (
            <AgencyAmadeusPasteModal
              agencyId={agencyId}
              airports={airports}
              airlines={airlines}
              key={`amadeus-${agencyId}-${refreshKey}`}
              onClose={() => setMode(null)}
              onImported={() => setRefreshKey((k) => k + 1)}
            />
          ) : null}
        </>
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">لا توجد وكالات بعد</p>
      )}
    </div>
  );
}
