"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RouteRecord = {
  id: string;
  name: string;
  route_date: string | null;
  status: string;
};

type Store = {
  id: string;
  store_code: string;
  store_name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  notes: string | null;
};

type RouteStoreRow = {
  id: string;
  store_id: string;
  stop_order: number;
  stores: Store | Store[] | null;
};

type Item = {
  id: string;
  name: string;
  size: string | null;
  unit: string;
};

type RequirementRow = {
  id: string;
  store_id: string;
  item_id: string;
  location: string;
  required_qty: number;
  notes: string | null;
  items: Item | Item[] | null;
};

type FilterTotal = {
  itemId: string;
  name: string;
  size: string;
  unit: string;
  quantity: number;
  locations: string[];
  notes: string[];
};

type RouteStop = {
  routeStoreId: string;
  stopOrder: number;
  store: Store;
};

function getSingleRecord<T>(record: T | T[] | null): T | null {
  if (!record) return null;
  return Array.isArray(record) ? record[0] ?? null : record;
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return "No date selected";

  const date = new Date(`${dateValue}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RouteDetailsPage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;

  const [route, setRoute] = useState<RouteRecord | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);

  const [loadedStoreIds, setLoadedStoreIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeId) return;

    void loadRoute();
  }, [routeId]);

  async function loadRoute() {
    setLoading(true);
    setError("");

    try {
      const routeResult = await supabase
        .from("routes")
        .select("id, name, route_date, status")
        .eq("id", routeId)
        .single();

      if (routeResult.error) {
        throw routeResult.error;
      }

      const routeStoresResult = await supabase
        .from("route_stores")
        .select(
          `
            id,
            store_id,
            stop_order,
            stores (
              id,
              store_code,
              store_name,
              city,
              state,
              address,
              notes
            )
          `,
        )
        .eq("route_id", routeId)
        .order("stop_order", { ascending: true });

      if (routeStoresResult.error) {
        throw routeStoresResult.error;
      }

      const routeStoreRows =
        (routeStoresResult.data ?? []) as unknown as RouteStoreRow[];

      const stops: RouteStop[] = routeStoreRows
        .map((row) => {
          const store = getSingleRecord(row.stores);

          if (!store) return null;

          return {
            routeStoreId: row.id,
            stopOrder: row.stop_order,
            store,
          };
        })
        .filter((stop): stop is RouteStop => stop !== null);

      const storeIds = stops.map((stop) => stop.store.id);

      let requirementRows: RequirementRow[] = [];

      if (storeIds.length > 0) {
        const requirementsResult = await supabase
          .from("store_item_requirements")
          .select(
            `
              id,
              store_id,
              item_id,
              location,
              required_qty,
              notes,
              items (
                id,
                name,
                size,
                unit
              )
            `,
          )
          .in("store_id", storeIds)
          .order("location", { ascending: true });

        if (requirementsResult.error) {
          throw requirementsResult.error;
        }

        requirementRows =
          (requirementsResult.data ?? []) as unknown as RequirementRow[];
      }

      setRoute(routeResult.data as RouteRecord);
      setRouteStops(stops);
      setRequirements(requirementRows);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "The route could not be loaded.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function getStoreFilterTotals(storeId: string): FilterTotal[] {
    const storeRequirements = requirements.filter(
      (requirement) => requirement.store_id === storeId,
    );

    const totals = new Map<string, FilterTotal>();

    for (const requirement of storeRequirements) {
      const item = getSingleRecord(requirement.items);

      if (!item) continue;

      const existing = totals.get(item.id);

      if (existing) {
        existing.quantity += requirement.required_qty;

        if (
          requirement.location &&
          !existing.locations.includes(requirement.location)
        ) {
          existing.locations.push(requirement.location);
        }

        if (
          requirement.notes &&
          !existing.notes.includes(requirement.notes)
        ) {
          existing.notes.push(requirement.notes);
        }
      } else {
        totals.set(item.id, {
          itemId: item.id,
          name: item.name,
          size: item.size || item.name,
          unit: item.unit,
          quantity: requirement.required_qty,
          locations: requirement.location
            ? [requirement.location]
            : [],
          notes: requirement.notes ? [requirement.notes] : [],
        });
      }
    }

    return Array.from(totals.values()).sort((a, b) =>
      a.size.localeCompare(b.size, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }

  function toggleLoaded(storeId: string) {
    setLoadedStoreIds((current) => {
      if (current.includes(storeId)) {
        return current.filter((id) => id !== storeId);
      }

      return [...current, storeId];
    });
  }

  const routeFilterTotal = useMemo(() => {
    return routeStops.reduce((routeTotal, stop) => {
      const storeTotal = getStoreFilterTotals(stop.store.id).reduce(
        (total, filter) => total + filter.quantity,
        0,
      );

      return routeTotal + storeTotal;
    }, 0);
  }, [routeStops, requirements]);

  const loadedCount = routeStops.filter((stop) =>
    loadedStoreIds.includes(stop.store.id),
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="font-medium text-slate-600">Loading route...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !route) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/routes"
            className="mb-4 inline-block font-semibold text-blue-700"
          >
            ← Back to routes
          </Link>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-bold text-red-900">
              Route unavailable
            </h1>

            <p className="mt-2 text-red-800">
              {error || "The route could not be found."}
            </p>

            <button
              type="button"
              onClick={loadRoute}
              className="mt-4 rounded-xl bg-red-700 px-4 py-3 font-bold text-white"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 pb-24 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link
            href="/routes"
            className="mb-3 inline-block text-sm font-semibold text-blue-700"
          >
            ← Build another route
          </Link>

          <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Daily route
                </p>

                <h1 className="mt-1 text-3xl font-bold">{route.name}</h1>

                <p className="mt-2 text-slate-300">
                  {formatDate(route.route_date)}
                </p>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-2 text-sm font-bold">
                {formatStatus(route.status)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 p-3 text-center">
                <p className="text-2xl font-bold">{routeStops.length}</p>
                <p className="text-xs text-slate-300">Stores</p>
              </div>

              <div className="rounded-xl bg-white/10 p-3 text-center">
                <p className="text-2xl font-bold">{routeFilterTotal}</p>
                <p className="text-xs text-slate-300">Filters</p>
              </div>

              <div className="rounded-xl bg-white/10 p-3 text-center">
                <p className="text-2xl font-bold">
                  {loadedCount}/{routeStops.length}
                </p>
                <p className="text-xs text-slate-300">Loaded</p>
              </div>
            </div>
          </div>
        </header>

        {routeStops.length === 0 ? (
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              No stores on this route
            </h2>

            <p className="mt-2 text-slate-600">
              This route was saved without any store stops.
            </p>

            <Link
              href="/routes"
              className="mt-5 inline-block rounded-xl bg-blue-700 px-5 py-3 font-bold text-white"
            >
              Build a new route
            </Link>
          </section>
        ) : (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Store load cards
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Keep the filters grouped separately for each store.
              </p>
            </div>

            <div className="space-y-5">
              {routeStops.map((stop) => {
                const store = stop.store;
                const filterTotals = getStoreFilterTotals(store.id);
                const isLoaded = loadedStoreIds.includes(store.id);

                const storeFilterTotal = filterTotals.reduce(
                  (total, filter) => total + filter.quantity,
                  0,
                );

                return (
                  <article
                    key={stop.routeStoreId}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                      isLoaded
                        ? "border-green-400"
                        : "border-transparent"
                    }`}
                  >
                    <div
                      className={`px-5 py-4 text-white ${
                        isLoaded ? "bg-green-700" : "bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-white/70">
                            Stop {stop.stopOrder}
                          </p>

                          <h3 className="mt-1 text-xl font-bold">
                            {store.store_code} — {store.store_name}
                          </h3>

                          {(store.city || store.state) && (
                            <p className="mt-1 text-sm text-white/75">
                              {[store.city, store.state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="min-w-16 rounded-xl bg-white/10 px-3 py-2 text-center">
                          <p className="text-2xl font-bold">
                            {storeFilterTotal}
                          </p>
                          <p className="text-xs text-white/70">filters</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      {filterTotals.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="font-semibold text-amber-900">
                            No filter requirements entered
                          </p>

                          <p className="mt-1 text-sm text-amber-800">
                            Open the store page to add its filter sizes and
                            quantities.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {filterTotals.map((filter) => (
                            <div
                              key={filter.itemId}
                              className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                            >
                              <div className="min-w-0">
                                <p className="text-lg font-bold text-slate-900">
                                  {filter.size}
                                </p>

                                {filter.name !== filter.size && (
                                  <p className="text-sm text-slate-600">
                                    {filter.name}
                                  </p>
                                )}

                                {filter.locations.length > 0 && (
                                  <p className="mt-1 text-sm text-slate-500">
                                    Locations:{" "}
                                    {filter.locations.join(", ")}
                                  </p>
                                )}

                                {filter.notes.length > 0 && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {filter.notes.join(" • ")}
                                  </p>
                                )}
                              </div>

                              <div className="flex min-w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 px-4 py-3">
                                <span className="text-2xl font-bold text-slate-900">
                                  {filter.quantity}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
                        <span className="font-bold text-slate-700">
                          Store total
                        </span>

                        <span className="text-xl font-bold text-slate-900">
                          {storeFilterTotal}
                        </span>
                      </div>

                      {store.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            store.address,
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 block rounded-xl border border-slate-300 px-4 py-3 text-center font-bold text-slate-700"
                        >
                          Open in Google Maps
                        </a>
                      )}

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => toggleLoaded(store.id)}
                          className={`rounded-xl px-4 py-3 font-bold ${
                            isLoaded
                              ? "bg-green-100 text-green-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {isLoaded
                            ? "✓ Filters loaded"
                            : "Mark filters loaded"}
                        </button>

                        <Link
                          href={`/stores/${store.id}/service`}
                          className="rounded-xl bg-blue-700 px-4 py-3 text-center font-bold text-white"
                        >
                          Open service worksheet
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
