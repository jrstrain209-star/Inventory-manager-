"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  workspace_id: string;
  store_code: string;
  store_name: string;
  city: string | null;
  state: string | null;
  address: string | null;
};

type RequirementRow = {
  store_id: string;
  item_id: string;
  location: string;
  required_qty: number;
  items:
    | {
        id: string;
        name: string;
        size: string | null;
        unit: string;
      }
    | {
        id: string;
        name: string;
        size: string | null;
        unit: string;
      }[]
    | null;
};

type FilterTotal = {
  itemId: string;
  name: string;
  size: string;
  quantity: number;
  locations: string[];
};

function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getItem(
  items: RequirementRow["items"],
): {
  id: string;
  name: string;
  size: string | null;
  unit: string;
} | null {
  if (!items) return null;
  return Array.isArray(items) ? items[0] ?? null : items;
}

export default function RoutesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const [routeDate, setRouteDate] = useState(getLocalDate());
  const [routeName, setRouteName] = useState("Today's Route");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadRouteData();
  }, []);

  async function loadRouteData() {
    setLoading(true);
    setError("");

    try {
      const [storesResult, requirementsResult] = await Promise.all([
        supabase
          .from("stores")
          .select(
            "id, workspace_id, store_code, store_name, city, state, address",
          )
          .eq("active", true)
          .order("store_code", { ascending: true }),

        supabase
          .from("store_item_requirements")
          .select(
            `
              store_id,
              item_id,
              location,
              required_qty,
              items (
                id,
                name,
                size,
                unit
              )
            `,
          )
          .order("location", { ascending: true }),
      ]);

      if (storesResult.error) {
        throw storesResult.error;
      }

      if (requirementsResult.error) {
        throw requirementsResult.error;
      }

      setStores((storesResult.data ?? []) as Store[]);
      setRequirements(
        (requirementsResult.data ?? []) as unknown as RequirementRow[],
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load the stores.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function toggleStore(storeId: string) {
    setSuccessMessage("");

    setSelectedStoreIds((current) => {
      if (current.includes(storeId)) {
        return current.filter((id) => id !== storeId);
      }

      return [...current, storeId];
    });
  }

  function selectAllStores() {
    setSelectedStoreIds(stores.map((store) => store.id));
    setSuccessMessage("");
  }

  function clearSelection() {
    setSelectedStoreIds([]);
    setSuccessMessage("");
  }

  function getStoreFilterTotals(storeId: string): FilterTotal[] {
    const storeRequirements = requirements.filter(
      (requirement) => requirement.store_id === storeId,
    );

    const totals = new Map<string, FilterTotal>();

    for (const requirement of storeRequirements) {
      const item = getItem(requirement.items);

      if (!item) continue;

      const key = item.id;
      const existing = totals.get(key);

      if (existing) {
        existing.quantity += requirement.required_qty;

        if (
          requirement.location &&
          !existing.locations.includes(requirement.location)
        ) {
          existing.locations.push(requirement.location);
        }
      } else {
        totals.set(key, {
          itemId: item.id,
          name: item.name,
          size: item.size || item.name,
          quantity: requirement.required_qty,
          locations: requirement.location
            ? [requirement.location]
            : [],
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

  const selectedStores = useMemo(() => {
    return selectedStoreIds
      .map((id) => stores.find((store) => store.id === id))
      .filter((store): store is Store => Boolean(store));
  }, [selectedStoreIds, stores]);

  const routeFilterCount = useMemo(() => {
    return selectedStores.reduce((total, store) => {
      const storeTotal = getStoreFilterTotals(store.id).reduce(
        (subtotal, filter) => subtotal + filter.quantity,
        0,
      );

      return total + storeTotal;
    }, 0);
  }, [selectedStores, requirements]);

  async function saveRoute() {
    setError("");
    setSuccessMessage("");

    if (selectedStores.length === 0) {
      setError("Select at least one store for the route.");
      return;
    }

    const firstStore = selectedStores[0];

    if (!firstStore?.workspace_id) {
      setError("The selected store does not have a workspace.");
      return;
    }

    const storesFromDifferentWorkspaces = selectedStores.some(
      (store) => store.workspace_id !== firstStore.workspace_id,
    );

    if (storesFromDifferentWorkspaces) {
      setError("All stores on a route must belong to the same workspace.");
      return;
    }

    setSaving(true);

    try {
      const cleanRouteName =
        routeName.trim() || `Route for ${routeDate}`;

      const routeResult = await supabase
        .from("routes")
        .insert({
          workspace_id: firstStore.workspace_id,
          name: cleanRouteName,
          route_date: routeDate,
          status: "planned",
        })
        .select("id")
        .single();

      if (routeResult.error) {
        throw routeResult.error;
      }

      const routeStoreRows = selectedStores.map((store, index) => ({
        route_id: routeResult.data.id,
        store_id: store.id,
        stop_order: index + 1,
      }));

      const routeStoresResult = await supabase
        .from("route_stores")
        .insert(routeStoreRows);

      if (routeStoresResult.error) {
        // Remove the empty route if adding its stores failed.
        await supabase
          .from("routes")
          .delete()
          .eq("id", routeResult.data.id);

        throw routeStoresResult.error;
      }

      setSuccessMessage(
        `Route saved with ${selectedStores.length} ${
          selectedStores.length === 1 ? "store" : "stores"
        } and ${routeFilterCount} filters.`,
      );

      setSelectedStoreIds([]);
      setRouteName("Today's Route");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "The route could not be saved.";

      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-slate-600">Loading stores...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link
            href="/"
            className="mb-3 inline-block text-sm font-semibold text-blue-700"
          >
            ← Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-slate-900">
            Build Today&apos;s Route
          </h1>

          <p className="mt-2 text-slate-600">
            Select the stores you are servicing. Each store&apos;s filters stay
            separated on its own load card.
          </p>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Route details</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Route name
              </span>

              <input
                type="text"
                value={routeName}
                onChange={(event) => setRouteName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Today's Route"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Service date
              </span>

              <input
                type="date"
                value={routeDate}
                onChange={(event) => setRouteDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Select stores
              </h2>

              <p className="text-sm text-slate-500">
                {selectedStores.length} of {stores.length} selected
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllStores}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Select all
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Clear
              </button>
            </div>
          </div>

          {stores.length === 0 ? (
            <div className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-slate-600">
              No active stores were found.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {stores.map((store) => {
                const selected = selectedStoreIds.includes(store.id);
                const filterTotals = getStoreFilterTotals(store.id);
                const filterCount = filterTotals.reduce(
                  (total, filter) => total + filter.quantity,
                  0,
                );

                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => toggleStore(store.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {store.store_code}
                        </p>

                        <p className="text-sm font-medium text-slate-700">
                          {store.store_name}
                        </p>

                        {(store.city || store.state) && (
                          <p className="mt-1 text-sm text-slate-500">
                            {[store.city, store.state]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>

                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </div>

                    <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
                      {filterTotals.length} filter{" "}
                      {filterTotals.length === 1 ? "size" : "sizes"} ·{" "}
                      {filterCount} total
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedStores.length > 0 && (
          <section className="mb-28">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Store load cards
              </h2>

              <p className="text-sm text-slate-600">
                Keep each store&apos;s filters together while loading.
              </p>
            </div>

            <div className="space-y-5">
              {selectedStores.map((store, storeIndex) => {
                const filterTotals = getStoreFilterTotals(store.id);

                const storeTotal = filterTotals.reduce(
                  (total, filter) => total + filter.quantity,
                  0,
                );

                return (
                  <article
                    key={store.id}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm"
                  >
                    <div className="bg-slate-900 px-5 py-4 text-white">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
                            Stop {storeIndex + 1}
                          </p>

                          <h3 className="mt-1 text-xl font-bold">
                            {store.store_code} — {store.store_name}
                          </h3>

                          {(store.city || store.state) && (
                            <p className="mt-1 text-sm text-slate-300">
                              {[store.city, store.state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                          <p className="text-2xl font-bold">{storeTotal}</p>
                          <p className="text-xs text-slate-300">filters</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      {filterTotals.length === 0 ? (
                        <div className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
                          No filter requirements have been entered for this
                          store.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {filterTotals.map((filter) => (
                            <div
                              key={filter.itemId}
                              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                            >
                              <div>
                                <p className="font-bold text-slate-900">
                                  {filter.size}
                                </p>

                                {filter.name !== filter.size && (
                                  <p className="text-sm text-slate-500">
                                    {filter.name}
                                  </p>
                                )}

                                {filter.locations.length > 0 && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {filter.locations.join(", ")}
                                  </p>
                                )}
                              </div>

                              <div className="min-w-14 rounded-xl bg-slate-100 px-3 py-2 text-center">
                                <p className="text-xl font-bold text-slate-900">
                                  {filter.quantity}
                                </p>
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
                          {storeTotal}
                        </span>
                      </div>

                      <div className="mt-4">
                        <Link
                          href={`/stores/${store.id}/service`}
                          className="block rounded-xl border border-blue-600 px-4 py-3 text-center font-bold text-blue-700"
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

        {selectedStores.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900">
                  {selectedStores.length}{" "}
                  {selectedStores.length === 1 ? "store" : "stores"}
                </p>

                <p className="text-sm text-slate-500">
                  {routeFilterCount} filters total
                </p>
              </div>

              <button
                type="button"
                onClick={saveRoute}
                disabled={saving}
                className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
   
