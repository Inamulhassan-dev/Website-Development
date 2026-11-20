import { Wallet, PlayCircle, Users2, TrendingUp, CheckCircle2 } from "lucide-react";

/** Clearly-labelled illustration of the member dashboard. Not live data. */
export function DashboardPreview() {
  const bars = [38, 52, 44, 68, 57, 76, 64, 82, 70, 88, 79, 94];
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[32px] bg-brandsoft/70 blur-2xl" />
      <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_30px_80px_-40px_rgba(16,35,63,0.45)]">
        <div className="flex items-center justify-between border-b border-line bg-[#fbfdff] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#e2e8f0]" />
            <span className="h-2 w-2 rounded-full bg-[#e2e8f0]" />
            <span className="h-2 w-2 rounded-full bg-[#e2e8f0]" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Illustrative preview</span>
          <span className="rounded-full bg-[#fffaf0] px-2 py-0.5 text-[9px] font-bold text-[#9a6b12]">DEMO</span>
        </div>
        <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[76px_1fr]">
          <div className="border-r border-line bg-[#fbfdff] px-2 py-4">
            <div className="mx-auto mb-5 grid h-7 w-7 place-items-center rounded-lg bg-brand text-[9px] font-bold text-white">UB</div>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`mx-auto h-6 w-6 rounded-lg ${i === 0 ? "bg-brandsoft" : "bg-[#f1f5fa]"}`} />
              ))}
            </div>
          </div>
          <div className="p-3.5 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted">Welcome back</p>
                <p className="text-[13px] font-semibold text-navy">Member dashboard</p>
              </div>
              <div className="h-6 w-6 rounded-full bg-brandsoft" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Wallet, label: "Available demo balance", value: "$24.60" },
                { icon: PlayCircle, label: "Completed ads", value: "18" },
                { icon: Users2, label: "Referrals", value: "3" },
                { icon: TrendingUp, label: "Pending review", value: "1" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-white p-2.5">
                  <div className="flex items-center gap-1.5 text-muted">
                    <item.icon className="h-3 w-3" />
                    <span className="text-[8.5px] font-medium uppercase tracking-wide">{item.label}</span>
                  </div>
                  <p className="mt-1 text-[15px] font-semibold text-navy">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2.5 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-navy">Demo rewards</p>
                <span className="text-[8.5px] text-success">+12.4%</span>
              </div>
              <div className="mt-2 flex h-[54px] items-end gap-1">
                {bars.map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-brand/80" style={{ height: `${h}%`, opacity: 0.35 + i * 0.05 }} />
                ))}
              </div>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {["Brand campaign completed", "Demo reward credited", "Referral activated"].map((text, i) => (
                <div key={text} className="flex items-center gap-2 rounded-lg bg-[#fafcff] px-2 py-1.5">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-[9px] text-ink">{text}</span>
                  <span className="ml-auto text-[8px] text-muted">{i + 1}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
