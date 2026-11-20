"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, Card, Progress } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { formatDuration, formatMoney } from "@/lib/format";

export type AdPlayerAd = {
  id: string;
  title: string;
  advertiser_name: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  required_watch_seconds: number;
  reward_cents: number;
  campaign_name: string;
};

type Phase = "idle" | "starting" | "watching" | "paused" | "completing" | "done" | "error";

export function AdPlayer({ ad }: { ad: AdPlayerAd }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<string | null>(null);
  const busy = useRef(false);
  const completedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [watched, setWatched] = useState(0);
  const [required, setRequired] = useState(ad.required_watch_seconds);
  const [reward, setReward] = useState(ad.reward_cents);
  const [resumed, setResumed] = useState(false);
  const [message, setMessage] = useState("");

  const finish = useCallback(async () => {
    if (!sessionRef.current || completedRef.current) return;
    completedRef.current = true;
    setPhase("completing");
    try {
      const res = await fetch(`/api/ad-sessions/${sessionRef.current}/complete`, { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; rewardCents?: number; message?: string; flagged?: boolean };
      if (json.ok) {
        setPhase("done");
        toast(json.rewardCents ? `Demo reward ${formatMoney(json.rewardCents)} credited to your wallet.` : "Advertisement already completed.");
        router.refresh();
      } else {
        setPhase("error");
        setMessage(json.message ?? "The completion could not be verified.");
        videoRef.current?.pause();
      }
    } catch {
      setPhase("error");
      setMessage("Network error while completing the advertisement. Please try again.");
    }
  }, [router]);

  const tick = useCallback(async () => {
    if (!sessionRef.current || busy.current || completedRef.current) return;
    if (phase !== "watching" && phase !== "paused") return;
    busy.current = true;
    try {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const res = await fetch(`/api/ad-sessions/${sessionRef.current}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deltaSeconds: hidden ? 0 : 1, hidden }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        status?: string;
        watchedSeconds?: number;
        requiredSeconds?: number;
        code?: string;
      };
      if (typeof json.requiredSeconds === "number") setRequired(json.requiredSeconds);
      if (typeof json.watchedSeconds === "number") setWatched(json.watchedSeconds);

      if (json.status === "FLAGGED" || json.code === "FLAGGED") {
        setPhase("error");
        setMessage("This session was flagged for unusual activity and sent for moderator review. No reward was credited.");
        videoRef.current?.pause();
        return;
      }
      if (json.code === "EXPIRED") {
        setPhase("error");
        setMessage("This viewing session expired. Start again to continue.");
        videoRef.current?.pause();
        return;
      }
      if ((json.watchedSeconds ?? 0) >= (json.requiredSeconds ?? required)) {
        await finish();
      }
    } catch {
      // Transient network errors are ignored; the next heartbeat retries.
    } finally {
      busy.current = false;
    }
  }, [finish, phase, required]);

  useEffect(() => {
    if (phase !== "watching") return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, tick]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        videoRef.current?.pause();
        setPhase((current) => (current === "watching" ? "paused" : current));
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tick]);

  async function start() {
    setPhase("starting");
    setMessage("");
    completedRef.current = false;
    try {
      const res = await fetch(`/api/ads/${ad.id}/start`, { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        sessionId?: string;
        watchedSeconds?: number;
        requiredSeconds?: number;
        rewardCents?: number;
        resumed?: boolean;
      };
      if (!res.ok || !json.sessionId) {
        setPhase("error");
        setMessage(json.error ?? "Unable to start this advertisement.");
        return;
      }
      sessionRef.current = json.sessionId;
      setWatched(json.watchedSeconds ?? 0);
      setRequired(json.requiredSeconds ?? ad.required_watch_seconds);
      setReward(json.rewardCents ?? ad.reward_cents);
      setResumed(!!json.resumed);
      setPhase("watching");
      try {
        await videoRef.current?.play();
      } catch {
        // Autoplay may be blocked; the member can press play on the video.
      }
    } catch {
      setPhase("error");
      setMessage("Network error. Please check your connection and try again.");
    }
  }

  async function resume() {
    setPhase("watching");
    try {
      await videoRef.current?.play();
    } catch {
      // ignore
    }
  }

  const percent = required > 0 ? Math.min(100, Math.round((watched / required) * 100)) : 0;
  const remaining = Math.max(0, required - watched);
  const active = phase === "watching" || phase === "paused" || phase === "completing";

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video w-full bg-navy">
        {active || phase === "done" || phase === "error" ? (
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            src={ad.video_url}
            poster={ad.thumbnail_url ?? undefined}
            playsInline
            controls={false}
            preload="metadata"
            onEnded={() => {
              if (watched >= required) void finish();
              else {
                setPhase("paused");
                setMessage("The video ended before the required watch time was reached. Seek back and keep watching.");
              }
            }}
            onPause={() => setPhase((current) => (current === "watching" ? "paused" : current))}
            onPlay={() => setPhase((current) => (current === "paused" ? "watching" : current))}
          />
        ) : (
          <div className="absolute inset-0">
            {ad.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.thumbnail_url} alt="" className="h-full w-full object-cover opacity-60" />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#1d4f9c,transparent_60%)]" />
            )}
            <div className="absolute inset-0 grid place-items-center bg-navy/35">
              <button
                type="button"
                onClick={start}
                disabled={phase === "starting"}
                className="group flex flex-col items-center gap-3 text-white"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-brand shadow-float transition group-hover:scale-105">
                  {phase === "starting" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Play className="ml-0.5 h-7 w-7" />}
                </span>
                <span className="text-[13px] font-semibold">Start DEMO session</span>
              </button>
            </div>
          </div>
        )}

        {phase === "paused" ? (
          <div className="absolute inset-0 grid place-items-center bg-navy/45">
            <div className="text-center text-white">
              <Pause className="mx-auto h-8 w-8" />
              <p className="mt-2 text-[13px] font-semibold">Playback paused</p>
              <p className="mt-1 max-w-xs text-[11.5px] text-white/70">
                The timer only advances while the video is playing and this tab is visible.
              </p>
              <button
                type="button"
                onClick={resume}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-brand"
              >
                <Play className="h-3.5 w-3.5" /> Continue watching
              </button>
            </div>
          </div>
        ) : null}

        {phase === "done" ? (
          <div className="absolute inset-0 grid place-items-center bg-navy/80 text-center text-white">
            <div>
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#7ee2b0]" />
              <p className="mt-2 text-[15px] font-semibold">DEMO reward credited</p>
              <p className="mt-1 text-[12px] text-white/70">{formatMoney(reward)} added to your demo wallet.</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/dashboard/ad-history")}>
                View ad history
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "completing" ? (
          <div className="absolute inset-0 grid place-items-center bg-navy/60 text-center text-white">
            <div>
              <Loader2 className="mx-auto h-8 w-8 animate-spin" />
              <p className="mt-2 text-[12.5px] font-medium">Verifying watch time on the server…</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{ad.campaign_name}</Badge>
              <span className="text-[11.5px] text-muted">{ad.advertiser_name}</span>
            </div>
            <h2 className="mt-1.5 text-[18px] font-semibold tracking-tight text-navy">{ad.title}</h2>
          </div>
          <div className="rounded-xl bg-[#e9f8f1] px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-success">Demo reward</p>
            <p className="text-[16px] font-semibold text-success">{formatMoney(reward)}</p>
          </div>
        </div>

        {resumed ? (
          <div className="rounded-xl border border-[#cfe2ff] bg-brandsoft px-3.5 py-2.5 text-[12px] text-brand">
            Resumed an existing server session — your previous progress has been restored.
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
            <span>
              Verified watch time: <span className="font-semibold text-ink">{formatDuration(watched)}</span> of{" "}
              {formatDuration(required)}
            </span>
            <span>{percent}%</span>
          </div>
          <Progress value={percent} tone={percent >= 100 ? "success" : "brand"} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
            <span>{remaining > 0 ? `${remaining}s remaining before completion unlocks` : "Requirements met — verifying…"}</span>
            <span>Video length {formatDuration(ad.duration_seconds)}</span>
          </div>
        </div>

        {message ? (
          <div className="flex items-start gap-2 rounded-xl border border-[#f6d0d0] bg-[#fdecec] px-3.5 py-3 text-[12px] text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{message}</p>
              {phase === "error" ? (
                <button type="button" onClick={start} className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-danger underline">
                  <RotateCcw className="h-3.5 w-3.5" /> Try a new session
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2 rounded-xl bg-surface px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p>
            Sessions are validated by the server using database timestamps and stored watch progress. Switching tabs,
            seeking ahead or leaving the page pauses or invalidates progress. Rewards shown here are simulated and have
            no cash value.
          </p>
        </div>
      </div>
    </Card>
  );
}
