import { Router, type IRouter } from "express";
import { GetMachinePriceQueryParams, GetMachinePriceResponse } from "@workspace/api-zod";
import { getMachinePrice } from "../lib/pricing";

const router: IRouter = Router();
const buckets = new Map<string, { count: number; until: number }>();
router.get("/pricing", async (req, res): Promise<void> => {
  const parsed = GetMachinePriceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a provider, region and instance type." });
    return;
  }
  // Bound anonymous provider requests; only public pricing selections are sent.
  const key = req.ip ?? "unknown";
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.until < now) {
    bucket = { count: 0, until: now + 60000 };
    if (buckets.size > 1000) buckets.clear();
    buckets.set(key, bucket);
  }
  if (++bucket.count > 30) {
    res.setHeader("Retry-After", "60");
    res.status(503).json({ error: "Too many pricing lookups. Try again in one minute or enter a manual hourly rate." });
    return;
  }
  try {
    const price = await getMachinePrice(parsed.data);
    res.json(GetMachinePriceResponse.parse(price));
  } catch (error) {
    const message = error instanceof Error && !/timeout|aborted|fetch failed|JSON/i.test(error.message)
      ? error.message : "Public pricing is unavailable. Enter a manual hourly rate or retry.";
    req.log.warn({ provider: parsed.data.provider }, "Machine pricing lookup unavailable");
    res.status(503).json({ error: message });
  }
});
export default router;
