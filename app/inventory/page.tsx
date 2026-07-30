"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  Loader2,
  Map as MapIcon,
  PackageSearch,
  Plus,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Item = {
  id: string;
  name: string;
  size: string | null;
  unit: string | null;
  active: boolean | null;
};

type Store = {
  id: string;
  store_code: string;
  store_name: string;
};

type RequirementRow = {
  item_id: string;
  store_id: string;
  required_qty: number;
  stores: Store | Store[] | null;
};

type ShortageRow = Record<string, unknown>;

type InventoryItem = {
  id: string;
  name: string;
  size: string;
  unit: string;
  required: number;
  onHand: number;
  shortage: number;
  stores: StoreTotal[];
};

type StoreTotal = {
  id: string;
  code: string;
  name: string;
  quantity: number;
};

function numberFrom(row: ShortageRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function stringFrom(row: ShortageRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return "";
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [shortages, setShortages] = useState<ShortageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showShortagesOnly, setShowShortagesOnly] = useState(false);

  useEffect(() => {
    async function loadInventory() {
      setLoading(true);
      setError("");

      const [itemsResult, requirementsResult, shortagesResult] =
        await Promise.all([
          supabase
            .from("items")
            .select("id, name, size, unit, active")
            .eq("active", true)
            .order("size"),
          supabase.from("store_item_requirements").select(`
            item_id,
            store_id,
            required_qty,
            stores (
              id,
              store_code,
              store_name
            )
          `),
          supabase.from("inventory_shortages").select("*"),
        ]);

      if (itemsResult.error) {
        setError(itemsResult.error.message);
      } else if (requirementsResult.error) {
        setError(requirementsResult.error.message);
      } else if (shortagesResult.error) {
        setError(shortagesResult.error.message);
      } else {
        setItems((itemsResult.data ?? []) as Item[]);
        setRequirements(
          (requirementsResult.data ?? []) as unknown as RequirementRow[],
        );
        setShortages((shortagesResult.data ?? []) as ShortageRow[]);
      }

      setLoading(false);
    }

    void loadInventory();
  }, []);

  const inventory = useMemo<InventoryItem[]>(() => {
    const shortagesByItem = new Map<string, ShortageRow>();

    for (const row of shortages) {
      const itemId = stringFrom(row, ["item_id", "id"]);
      if (itemId) shortagesByItem.set(itemId, row);
    }

    return items
      .map((item) => {
        const itemRequirements = requirements.filter(
          (requirement) => requirement.item_id === item.id,
        );
        const storeTotals = new Map<string, StoreTotal>();

        for (const requirement of itemRequirements) {
          const store: Store | null = Array.isArray(requirement.stores)
            ? requirement.stores[0] ?? null
            : requirement.stores;
          if (!store) continue;

          const existing = storeTotals.get(store.id);
          if (existing) {
            existing.quantity += requirement.required_qty ?? 0;
          } else {
            storeTotals.set(store.id, {
              id: store.id,
              code: store.store_code,
              name: store.store_name,
              quantity: requirement.required_qty ?? 0,
            });
          }
        }

        const required = itemRequirements.reduce(
          (total, requirement) => total + (requirement.required_qty ?? 0),
          0,
        );
        const shortageRow = shortagesByItem.get(item.id);
        const onHand = numberFrom(shortageRow, [
          "on_hand",
          "quantity_on_hand",
          "current_qty",
          "available_qty",
          "stock_qty",
        ]);
        const reportedShortage = numberFrom(shortageRow, [
          "shortage_qty",
          "needed_qty",
          "quantity_needed",
          "short_by",
        ]);

        return {
          id: item.id,
          name: item.name,
          size: item.size || item.name,
          unit: item.unit || "each",
          required,
          onHand,
          shortage: Math.max(reportedShortage, required - onHand, 0),
          stores: Array.from(storeTotals.values()).sort((a, b) =>
            a.code.localeCompare(b.code, undefined, { numeric: true }),
          ),
        };
      })
      .sort((a, b) =>
        a.size.localeCompare(b.size, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [items, requirements, shortages]);

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();

    return inventory.filter((item) => {
      const matchesSearch =
        !term ||
        item.size.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        item.stores.some(
          (store) =>
            store.code.toLowerCase().includes(term) ||
            store.name.toLowerCase().includes(term),
        );

      return matchesSearch && (!showShortagesOnly || item.shortage > 0);
    });
  }, [inventory, search, showShortagesOnly]);

  const totals = useMemo(
    () =>
      inventory.reduce(
        (summary, item) => ({
          required: summary.required + item.required,
          onHand: summary.onHand + item.onHand,
          needed: summary.needed + item.shortage,
          lowStock: summary.lowStock + (item.shortage > 0 ? 1 : 0),
        }),
        { required: 0, onHand: 0, needed: 0, lowStock: 0 },
      ),
    [inventory],
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Inventory Manager</p>
          <h1>Inventory</h1>
          <p className="subtitle">
            See every filter size, how many all stores require, what is on
            hand, and what still needs to be ordered.
          </p>
        </div>

        <Link className="header-add-button" href="/add?type=filter">
          <Plus size={19} />
          Add filter
        </Link>
      </header>

      {loading ? (
        <div className="inventory-loading">
          <Loader2 className="spin" size={30} />
          <p>Loading inventory...</p>
        </div>
      ) : error ? (
        <div className="inventory-error">
          <AlertTriangle size={28} />
          <div>
            <h2>Inventory could not be loaded</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <section className="summary-grid" aria-label="Inventory totals">
            <article className="summary-card">
              <div className="card-icon">
                <Boxes size={22} />
              </div>
              <div>
                <p className="card-label">Required</p>
                <p className="card-value">{totals.required}</p>
                <p className="card-description">For all active stores</p>
              </div>
            </article>

            <article className="summary-card">
              <div className="card-icon">
                <PackageSearch size={22} />
              </div>
              <div>
                <p className="card-label">On Hand</p>
                <p className="card-value">{totals.onHand}</p>
                <p className="card-description">Current available stock</p>
              </div>
            </article>

            <article className="summary-card shortage-summary-card">
              <div className="card-icon">
                <AlertTriangle size={22} />
              </div>
              <div>
                <p className="card-label">Need to Order</p>
                <p className="card-value">{totals.needed}</p>
                <p className="card-description">Filters currently short</p>
              </div>
            </article>

            <article className="summary-card">
              <div className="card-icon">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="card-label">Low Stock Sizes</p>
                <p className="card-value">{totals.lowStock}</p>
                <p className="card-description">Sizes needing attention</p>
              </div>
            </article>
          </section>

          <section className="section">
            <div className="inventory-toolbar">
              <label className="inventory-search">
                <Search size={19} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search size or store"
                />
              </label>

              <button
                className={`shortage-filter ${
                  showShortagesOnly ? "active" : ""
                }`}
                type="button"
                onClick={() => setShowShortagesOnly((current) => !current)}
              >
                <AlertTriangle size={17} />
                Shortages only
              </button>
            </div>

            <div className="inventory-list">
              {filteredInventory.map((item) => {
                const isShort = item.shortage > 0;

                return (
                  <details
                    className={`inventory-card ${
                      isShort ? "inventory-card-short" : ""
                    }`}
                    key={item.id}
                  >
                    <summary>
                      <div className="inventory-size">
                        <span>{item.name}</span>
                        <strong>{item.size}</strong>
                        <small>
                          {item.stores.length}{" "}
                          {item.stores.length === 1 ? "store" : "stores"}
                        </small>
                      </div>

                      <div className="inventory-quantities">
                        <span>
                          <small>Required</small>
                          <strong>{item.required}</strong>
                        </span>
                        <span>
                          <small>On hand</small>
                          <strong>{item.onHand}</strong>
                        </span>
                        <span className={isShort ? "shortage-number" : ""}>
                          <small>{isShort ? "Need" : "Status"}</small>
                          <strong>
                            {isShort ? item.shortage : <CheckCircle2 size={22} />}
                          </strong>
                        </span>
                      </div>
                    </summary>

                    <div className="inventory-store-breakdown">
                      <p className="inventory-breakdown-heading">
                        Required by store
                      </p>

                      {item.stores.length > 0 ? (
                        item.stores.map((store) => (
                          <Link
                            className="inventory-store-row"
                            href={`/stores/${store.id}`}
                            key={store.id}
                          >
                            <span>
                              <strong>{store.code}</strong>
                              <small>{store.name}</small>
                            </span>
                            <b>{store.quantity}</b>
                          </Link>
                        ))
                      ) : (
                        <p className="inventory-no-stores">
                          No active store requirements use this size.
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>

            {filteredInventory.length === 0 ? (
              <div className="empty-state">
                <PackageSearch size={32} />
                <h2>No filters found</h2>
                <p>Try a different search or turn off “Shortages only.”</p>
              </div>
            ) : null}
          </section>
        </>
      )}

      <nav className="mobile-nav" aria-label="Main navigation">
        <Link className="nav-item" href="/">
          <Boxes size={20} />
          <span>Dashboard</span>
        </Link>
        <Link className="nav-item" href="/stores">
          <Building2 size={20} />
          <span>Stores</span>
        </Link>
        <Link className="nav-item active" href="/inventory">
          <PackageSearch size={20} />
          <span>Inventory</span>
        </Link>
        <Link className="nav-item" href="/routes">
          <MapIcon size={20} />
          <span>Routes</span>
        </Link>
      </nav>
    </main>
  );
}
