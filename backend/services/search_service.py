"""Global search across master entities."""
from core.db import get_db, serialize


async def global_search(query: str, *, limit_per_type: int = 5) -> dict:
    """Search items, vendors, employees, brands, outlets, COA, doc_no in transactional."""
    if not query or len(query) < 2:
        return {"items": [], "vendors": [], "employees": [], "outlets": [],
                "brands": [], "coa": [], "users": []}
    db = get_db()
    rx = {"$regex": query, "$options": "i"}

    async def search(col: str, name_field: str = "name", extra_fields: list[str] = None) -> list[dict]:
        extra_fields = extra_fields or []
        or_clauses = [{name_field: rx}, {"code": rx}]
        for f in extra_fields:
            or_clauses.append({f: rx})
        cursor = db[col].find({
            "deleted_at": None,
            "$or": or_clauses,
        }).limit(limit_per_type)
        return [serialize(d) async for d in cursor]

    return {
        "items": await search("items", extra_fields=["sku"]),
        "vendors": await search("vendors"),
        "employees": await search("employees", name_field="full_name"),
        "outlets": await search("outlets"),
        "brands": await search("brands"),
        "coa": await search("chart_of_accounts"),
        "users": await search("users", name_field="full_name", extra_fields=["email"]),
    }
