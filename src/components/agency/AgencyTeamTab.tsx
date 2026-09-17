import { useEffect, useState } from "react";

import { fetchMyAgencyTeam, type AgencyTeamMember } from "../../lib/agency";
import { inviteAgencyUser } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

// Self-service team management for agencies. Visible/usable only to an
// "owner" — a staff member opening this tab will see an empty/self-only
// list (RLS only grants the full-team view to owners) and can't invite.
// Owners can only invite plain "staff" here; granting a second "owner"
// still requires TripRing admin (see invite-agency-user Edge Function).
export function AgencyTeamTab({ agencyId, isOwner }: { agencyId: string; isOwner: boolean }) {
  const [team, setTeam] = useState<AgencyTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyAgencyTeam(agencyId);
      setTeam(rows);
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل فريق الوكالة", "AgencyTeamTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  if (!isOwner) {
    return (
      <Card className="text-center text-sm text-slate-500">
        إدارة الفريق متاحة فقط لمالك الوكالة. لو محتاج تضيف زميل جديد، اطلب من مالك الحساب يعمل ذلك من هنا.
      </Card>
    );
  }

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">جاري التحميل...</p>;

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">فريق الوكالة ({team.length})</h3>
        <Button type="button" onClick={() => setInviteOpen((v) => !v)}>
          {inviteOpen ? "إخفاء" : "+ دعوة موظف"}
        </Button>
      </div>

      {inviteOpen ? (
        <InviteTeamMemberForm
          agencyId={agencyId}
          onDone={() => {
            setInviteOpen(false);
            reload();
          }}
        />
      ) : null}

      <div className="space-y-2">
        {team.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">لا يوجد أعضاء بعد.</Card>
        ) : (
          team.map((member) => (
            <Card key={member.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{member.full_name ?? "—"}</p>
                <p className="text-xs text-slate-500" dir="ltr">
                  {member.phone ?? ""}
                </p>
              </div>
              <Badge tone={member.agency_role === "owner" ? "flash" : "default"}>
                {member.agency_role === "owner" ? "مالك" : "موظف"}
              </Badge>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function InviteTeamMemberForm({ agencyId, onDone }: { agencyId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) {
      setError("الإيميل مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // agencyRole is intentionally not sent here — the Edge Function
      // forces "staff" for any non-admin caller, so there's no point
      // exposing a role picker that would be silently ignored.
      const result = await inviteAgencyUser({
        agencyId,
        email: email.trim(),
        fullName: fullName.trim() || undefined,
      });
      setSuccess(`تم إرسال دعوة إلى ${result.email}`);
      setEmail("");
      setFullName("");
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إرسال الدعوة", "AgencyTeamTab.invite"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-2 bg-slate-50">
      <p className="text-xs text-slate-500">
        هيتبعت إيميل دعوة (من Supabase) عشان الموظف يحدد كلمة سر ويدخل بصلاحية "موظف" داخل وكالتك.
      </p>
      <input
        type="email"
        placeholder="الإيميل"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        dir="ltr"
      />
      <input
        type="text"
        placeholder="الاسم بالكامل (اختياري)"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "جاري الإرسال..." : "إرسال الدعوة"}
        </Button>
      </div>
    </Card>
  );
}
