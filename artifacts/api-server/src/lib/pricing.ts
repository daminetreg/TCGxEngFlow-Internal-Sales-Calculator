import { GetMachinePriceResponse } from "@workspace/api-zod";

type Selection = { provider: "aws" | "azure" | "gcp"; region: string; instanceType: string };
type Price = ReturnType<typeof GetMachinePriceResponse.parse>;
const cache = new Map<string, { expiresAt: number; price: Price }>();
const inFlight = new Map<string, Promise<Price>>();
const azureCores: Record<string, number> = {
  Standard_F2s_v2: 2, Standard_F4s_v2: 4, Standard_F8s_v2: 8,
  Standard_F16s_v2: 16, Standard_F32s_v2: 32, Standard_F64s_v2: 64,
  Standard_D2s_v5: 2, Standard_D4s_v5: 4, Standard_D8s_v5: 8,
  Standard_D16s_v5: 16, Standard_D32s_v5: 32, Standard_D64s_v5: 64,
};

type JsonObject = Record<string, unknown>;
function obj(x: unknown): JsonObject {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? x as JsonObject : {};
}
async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("Public pricing provider is unavailable. Enter a manual hourly rate.");
  const reader = r.body?.getReader();
  if (!reader) throw new Error("Empty response from pricing provider. Enter a manual hourly rate.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 12 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Pricing response too large. Enter a manual hourly rate.");
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function fetchPrice(s: Selection): Promise<Price> {
  let hourlyUsd: number;
  let vcpus: number;
  let source: string;
  let sourceUrl: string;
  if (s.provider === "aws") {
    const family = s.instanceType.split(".")[0];
    if (!/^[a-z][a-z0-9-]{0,18}\.[a-z0-9-]{1,20}$/.test(s.instanceType)) {
      throw new Error("Use an EC2 API name such as c6i.2xlarge.");
    }
    const url = `https://instances-api.vantage.sh/api/v1/instances/ec2/families/${family}/global`;
    const all = await fetchJson(url);
    const machine = Array.isArray(all) ? all.find(x => obj(x).instance_type === s.instanceType || obj(x).instanceType === s.instanceType) : undefined;
    const item = obj(machine);
    const linux = obj(obj(obj(item.pricing)[s.region]).linux);
    hourlyUsd = Number(linux.ondemand);
    vcpus = Number(item.vCPU);
    source = "Vantage Instances API · AWS EC2";
    sourceUrl = url;
  } else if (s.provider === "azure") {
    vcpus = azureCores[s.instanceType] ?? 0;
    if (!vcpus) throw new Error("Azure live lookup supports Standard_F{2,4,8,16,32,64}s_v2 and Standard_D{2,4,8,16,32,64}s_v5. For other VMs, enter a manual rate and vCPU count.");
    const query = new URLSearchParams({
      "$filter": `armRegionName eq '${s.region}' and armSkuName eq '${s.instanceType}' and priceType eq 'Consumption'`,
      currencyCode: "USD",
    });
    const url = `https://prices.azure.com/api/retail/prices?${query}`;
    const all = obj(await fetchJson(url));
    const rows = Array.isArray(all.Items) ? all.Items.map(obj) : [];
    const row = rows.find(x => x.armSkuName === s.instanceType && x.armRegionName === s.region &&
      typeof x.productName === "string" && x.productName.startsWith("Virtual Machines ") &&
      !/windows/i.test(x.productName) && !/spot|low priority/i.test(String(x.skuName)) &&
      x.unitOfMeasure === "1 Hour" && x.type === "Consumption" && Number(x.retailPrice) > 0);
    hourlyUsd = Number(row?.retailPrice);
    source = "Microsoft Azure Retail Prices API";
    sourceUrl = url;
  } else {
    throw new Error("Google Cloud live pricing is not configured. Enter your machine's USD hourly rate and vCPU count manually.");
  }
  if (!Number.isFinite(hourlyUsd) || hourlyUsd <= 0 || !Number.isInteger(vcpus) || vcpus <= 0) {
    throw new Error("No Linux on-demand price found for this machine and region. Enter a manual hourly rate.");
  }
  return GetMachinePriceResponse.parse({
    ...s, hourlyUsd, vcpus, source, sourceUrl,
    fetchedAt: new Date().toISOString(),
    description: "Linux shared-tenancy on-demand USD per instance-hour. Excludes storage, network, taxes, commitments and CI platform fees. Cached for up to six hours; timestamp is retrieval time, not the provider's price-effective date.",
  });
}
export async function getMachinePrice(s: Selection): Promise<Price> {
  if (!/^[a-z0-9-]{1,50}$/.test(s.region) || !/^[a-zA-Z0-9_.-]{1,80}$/.test(s.instanceType)) {
    throw new Error("Enter a valid region and machine API name.");
  }
  const key = `${s.provider}:${s.region}:${s.instanceType}`;
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.price;
  const ongoing = inFlight.get(key);
  if (ongoing) return ongoing;
  if (inFlight.size >= 5) throw new Error("Pricing service is busy. Try again shortly or enter a manual hourly rate.");
  const promise = fetchPrice(s).then(price => {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { price, expiresAt: Date.now() + 6 * 3600 * 1000 });
    return price;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
