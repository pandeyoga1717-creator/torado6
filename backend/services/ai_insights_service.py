"""AI Insights service: anomaly detection, sales trend summary, conversational Q&A.
Non-blocking: all calls return empty/safe defaults if AI unavailable.
"""
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from core.config import settings
from core.db import get_db
from services import executive_service

logger = logging.getLogger("aurora.ai_insights")


async def _llm_chat(system: str, user_text: str, *, session_id: str = "insights",
                    model_provider: str = "openai", model_id: str = "gpt-5-mini") -> str:
    """Lightweight wrapper. Returns empty string if unavailable."""
    if not settings.feature_ai_enabled or not settings.emergent_llm_key:
        return ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=settings.emergent_llm_key,
            session_id=session_id,
            system_message=system,
        ).with_model(model_provider, model_id)
        return await chat.send_message(UserMessage(text=user_text)) or ""
    except Exception as e:  # noqa: BLE001
        logger.warning(f"LLM call failed: {e}")
        return ""


async def detect_anomalies(*, days: int = 14) -> dict:
    """Compute statistical anomalies on daily sales (z-score). LLM optional summary.
    Returns: {anomalies: [...], summary: str}.
    """
    trend = await executive_service.sales_trend(days=days)
    series = trend["series"]
    vals = [s["total"] for s in series]
    n = len(vals)
    if n < 7:
        return {"anomalies": [], "summary": "Data harian belum cukup untuk deteksi anomali."}
    mean = sum(vals) / n
    var = sum((v - mean) ** 2 for v in vals) / n
    sd = var ** 0.5 if var > 0 else 0
    anomalies = []
    for s in series:
        if sd == 0:
            continue
        z = (s["total"] - mean) / sd
        if abs(z) >= 1.6 and s["total"] > 0:
            anomalies.append({
                "date": s["date"],
                "total": s["total"],
                "z_score": round(z, 2),
                "deviation_pct": round((s["total"] - mean) / mean * 100, 2) if mean else 0,
                "direction": "high" if z > 0 else "low",
            })
    # LLM friendly summary (optional)
    llm_sum = ""
    if anomalies:
        sys = "You are an Indonesian F&B finance analyst. Output 1-2 sentence summary in bahasa Indonesia (no JSON)."
        prompt = (
            f"Tren {days} hari: rata-rata Rp {mean:,.0f}, std Rp {sd:,.0f}. "
            f"Anomali: {anomalies[:3]}"
        )
        llm_sum = await _llm_chat(sys, prompt, session_id="anomaly")
    return {
        "days": days,
        "mean": round(mean, 2),
        "sd": round(sd, 2),
        "anomalies": anomalies,
        "summary": llm_sum or (
            f"Ditemukan {len(anomalies)} hari dengan deviasi >1.6σ." if anomalies
            else "Tidak ada hari yang signifikan menyimpang dari pola."
        ),
    }


async def trend_summary() -> dict:
    """Quick AI-friendly insight bullets: top movers, lowest day, momentum direction."""
    trend = await executive_service.sales_trend(days=14)
    series = trend["series"]
    if len(series) < 2:
        return {"bullets": ["Data belum cukup untuk insight."], "trend": trend}
    last7 = series[-7:]
    prev7 = series[-14:-7] if len(series) >= 14 else []
    last_total = sum(s["total"] for s in last7)
    prev_total = sum(s["total"] for s in prev7) if prev7 else 0
    delta_pct = ((last_total - prev_total) / prev_total * 100) if prev_total else 0
    best = max(series, key=lambda s: s["total"]) if series else None
    worst = min((s for s in series if s["total"] > 0), key=lambda s: s["total"], default=None)
    bullets = []
    if prev_total:
        if delta_pct > 5:
            bullets.append(f"Penjualan 7 hari naik {delta_pct:.1f}% vs 7 hari sebelumnya.")
        elif delta_pct < -5:
            bullets.append(f"Penjualan 7 hari turun {abs(delta_pct):.1f}% vs 7 hari sebelumnya.")
        else:
            bullets.append(f"Penjualan 7 hari relatif stabil ({delta_pct:+.1f}%).")
    if best:
        bullets.append(f"Hari terbaik: {best['date']} — Rp {best['total']:,.0f}.")
    if worst and best and worst["date"] != best["date"]:
        bullets.append(f"Hari terlemah: {worst['date']} — Rp {worst['total']:,.0f}.")
    return {
        "bullets": bullets,
        "last_7_total": round(last_total, 2),
        "prev_7_total": round(prev_total, 2),
        "delta_pct": round(delta_pct, 2),
    }


async def insights_pack() -> dict:
    """One call returning trend bullets + anomalies + KPI snapshot."""
    trend = await trend_summary()
    anomalies = await detect_anomalies(days=14)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "trend": trend,
        "anomalies": anomalies,
    }


async def conversational_qa(question: str, *, user: dict) -> dict:
    """Answer a natural-language finance/operations question.
    Provide grounding context: KPIs + trend + recent anomalies.
    Returns {answer, sources}
    """
    if not question or len(question.strip()) < 3:
        return {"answer": "Mohon ajukan pertanyaan yang lebih spesifik.", "sources": []}
    if not settings.feature_ai_enabled or not settings.emergent_llm_key:
        return {"answer": "Layanan AI tidak aktif. Hubungi admin.", "sources": []}

    kpi = await executive_service.kpis()
    pack = await insights_pack()
    context = json.dumps({
        "kpi": kpi,
        "trend": pack["trend"],
        "anomalies": pack["anomalies"]["anomalies"][:3],
    }, ensure_ascii=False, default=str)

    sys = (
        "You are an Indonesian F&B operations & finance analyst for Aurora F&B (Torado group). "
        "Answer in bahasa Indonesia, concise (3-5 sentences max), and ground answer in given JSON context. "
        "If data not in context, say 'Data tidak tersedia.' Do NOT hallucinate numbers."
    )
    prompt = f"CONTEXT:\n{context}\n\nQUESTION:\n{question.strip()}\n\nANSWER:"
    answer = await _llm_chat(sys, prompt, session_id=f"qa-{user['id'][:8]}")
    if not answer:
        return {"answer": "Maaf, layanan AI sedang sibuk. Coba lagi sebentar.", "sources": []}
    sources = [
        {"label": f"KPI period {kpi['period']}", "link": "/executive"},
        {"label": "Trend 30 hari", "link": "/executive"},
    ]
    if pack["anomalies"]["anomalies"]:
        sources.append({"label": "Anomali sales", "link": "/executive"})
    return {"answer": answer.strip(), "sources": sources}
