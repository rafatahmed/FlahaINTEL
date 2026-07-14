function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: positiveInteger(process.env.API_PORT ?? process.env.PORT, 3003),
  webOrigin: process.env.WEB_ORIGIN ?? `http://localhost:${positiveInteger(process.env.WEB_PORT, 5174)}`,
  collectionIntervalMinutes: positiveInteger(process.env.COLLECTION_INTERVAL_MINUTES, 15),
};
