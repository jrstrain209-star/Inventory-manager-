"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  workspace_id: string;
  store_code: string;
  store_name: string;
  city: string | null;
  state: string | null;
};

type Item = {
  id: string;
  name: string;
  size: string | null;
};

type RequirementRow = {
  id: string;
  item_id: string;
  location: string;
  required_qty: number;
  notes: string | null;
  items: Item | Item[] | null;
};

type WorksheetItem = {
  requirementId: string;
  itemId: string;
  location: string;
  expectedQty: number;
  actualQty: number;
  completed: boolean;
  condition: string;
  notes: string;
  itemName: string;
  size: string;
};

function firstItem(items: Item | Item[] | null): Item | null {
  if (Array.isArray(items)) {
    return items[0] ?? null;
  }

  return items;
}

export default function ServiceWorksheetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const storeId = params.id;

  const [store, setStore] = useState<Store | null>(null);
  const [worksheetItems, setWorksheetItems] = useState<WorksheetItem[]>([]);
  const [technicianName, setTechnicianName] = useState("Joseph Strain");
  const [visitNotes, setVisitNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function loadWorksheet() {
      setLoading(true);
      setLoadError("");

      const storeResult = await supabase
        .from("stores")
        .select(
          "id, workspace_id, store_code, store_name, city, state"
        )
        .eq("id", storeId)
        .single();

      if (storeResult.error || !storeResult.data) {
        setLoadError(
          storeResult.error?.message || "The store could not be loaded."
        );
        setLoading(false);
        return;
      }

      const requirementsResult = await supabase
        .from("store_item_requirements")
        .select(
          `
            id,
            item_id,
            location,
            required_qty,
            notes,
            items (
              id,
              name,
              size
            )
          `
        )
        .eq("store_id", storeId)
        .order("location");

      if (requirementsResult.error) {
        setLoadError(requirementsResult.error.message);
        setLoading(false);
        return;
      }

      const requirements =
        (requirementsResult.data as RequirementRow[] | null) ?? [];

      const preparedItems: WorksheetItem[] = requirements.map(
        (requirement) => {
          const item = firstItem(requirement.items);

          return {
            requirementId: requirement.id,
            itemId: requirement.item_id,
            location: requirement.location,
            expectedQty: requirement.required_qty,
            actualQty: requirement.required_qty,
            completed: false,
            condition: "changed",
            notes: requirement.notes ?? "",
            itemName: item?.name ?? "HVAC Filter",
            size: item?.size ?? "Unknown size",
          };
        }
      );

      setStore(storeResult.data);
      setWorksheetItems(preparedItems);
      setLoading(false);
    }

    if (storeId) {
      loadWorksheet();
    }
  }, [storeId]);

  const completedCount = useMemo(
    () => worksheetItems.filter((item) => item.completed).length,
    [worksheetItems]
  );

  const installedTotal = useMemo(
    () =>
      worksheetItems.reduce(
        (total, item) =>
          total + (item.completed ? item.actualQty : 0),
        0
      ),
    [worksheetItems]
  );

  const allCompleted =
    worksheetItems.length > 0 &&
    completedCount === worksheetItems.length;

  function updateItem(
    requirementId: string,
    changes: Partial<WorksheetItem>
  ) {
    setWorksheetItems((current) =>
      current.map((item) =>
        item.requirementId === requirementId
          ? { ...item, ...changes }
          : item
      )
    );
  }

  function changeQuantity(
    requirementId: string,
    amount: number
  ) {
    setWorksheetItems((current) =>
      current.map((item) => {
        if (item.requirementId !== requirementId) {
          return item;
        }

        return {
          ...item,
          actualQty: Math.max(0, item.actualQty + amount),
        };
      })
    );
  }

  function markAllComplete() {
    setWorksheetItems((current) =>
      current.map((item) => ({
        ...item,
        completed: true,
      }))
    );
  }

  async function finishVisit() {
    if (!store) {
      return;
    }

    if (!technicianName.trim()) {
      setSaveError("Enter the technician name.");
      return;
    }

    if (!allCompleted) {
      setSaveError(
        "Complete every filter location before finishing the visit."
      );
      return;
    }

    setSaving(true);
    setSaveError("");

    const today = new Date().toISOString().slice(0, 10);

    const visitResult = await supabase
      .from("service_visits")
      .insert({
        workspace_id: store.workspace_id,
        store_id: store.id,
        scheduled_date: today,
        completed_at: new Date().toISOString(),
        status: "completed",
        technician_name: technicianName.trim(),
        notes: visitNotes.trim() || null,
      })
      .select("id")
      .single();

    if (visitResult.error || !visitResult.data) {
      setSaveError(
        visitResult.error?.message ||
          "The service visit could not be saved."
      );
      setSaving(false);
      return;
    }

    const visitItems = worksheetItems.map((item) => ({
      service_visit_id: visitResult.data.id,
      requirement_id: item.requirementId,
      item_id: item.itemId,
      location: item.location,
      expected_qty: item.expectedQty,
      actual_qty: item.actualQty,
      completed: item.completed,
      condition: item.condition,
      notes: item.notes.trim() || null,
    }));

    const itemsResult = await supabase
      .from("service_visit_items")
      .insert(visitItems);

    if (itemsResult.error) {
      setSaveError(itemsResult.error.message);
      setSaving(false);
      return;
    }

    router.push(
      `/stores/${store.id}?serviceCompleted=true`
    );
    router.refresh();
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="worksheet-loading">
          <Loader2 className="spin" size={32} />
          <p>Loading service worksheet...</p>
        </div>
      </main>
    );
  }

  if (loadError || !store) {
    return (
      <main className="app-shell">
        <Link className="back-link" href="/stores">
          <ArrowLeft size={19} />
          Back to stores
        </Link>

        <div className="empty-state">
          <h1>Worksheet unavailable</h1>
          <p>{loadError || "The store could not be found."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell service-page">
      <Link
        className="back-link"
        href={`/stores/${store.id}`}
      >
        <ArrowLeft size={19} />
        Back to store
      </Link>

      <header className="worksheet-header">
        <div className="worksheet-title-row">
          <div className="store-detail-icon">
            <ClipboardCheck size={28} />
          </div>

          <div>
            <p className="eyebrow">{store.store_code}</p>
            <h1>Service Worksheet</h1>
            <p className="subtitle">{store.store_name}</p>
          </div>
        </div>

        <div className="worksheet-progress">
          <div>
            <span>Locations complete</span>
            <strong>
              {completedCount} / {worksheetItems.length}
            </strong>
          </div>

          <div>
            <span>Filters installed</span>
            <strong>{installedTotal}</strong>
          </div>
        </div>
      </header>

      <section className="worksheet-info-card">
        <label>
          Technician
          <input
            type="text"
            value={technicianName}
            onChange={(event) =>
              setTechnicianName(event.target.value)
            }
            placeholder="Technician name"
          />
        </label>
      </section>

      <div className="worksheet-toolbar">
        <h2>Filter locations</h2>

        {!allCompleted ? (
          <button
            className="text-button"
            type="button"
            onClick={markAllComplete}
          >
            <Check size={17} />
            Mark all complete
          </button>
        ) : null}
      </div>

      <section className="worksheet-list">
        {worksheetItems.map((item) => (
          <article
            className={`worksheet-card ${
              item.completed ? "worksheet-card-complete" : ""
            }`}
            key={item.requirementId}
          >
            <button
              className="worksheet-check"
              type="button"
              aria-label={
                item.completed
                  ? "Mark incomplete"
                  : "Mark complete"
              }
              onClick={() =>
                updateItem(item.requirementId, {
                  completed: !item.completed,
                })
              }
            >
              {item.completed ? <Check size={22} /> : null}
            </button>

            <div className="worksheet-card-content">
              <p className="requirement-location">
                {item.location}
              </p>

              <div className="worksheet-filter-heading">
                <h3>{item.size}</h3>
                <span>Expected: {item.expectedQty}</span>
              </div>

              <p className="requirement-name">
                {item.itemName}
              </p>

              <div className="worksheet-field-row">
                <div>
                  <span className="field-label">
                    Installed quantity
                  </span>

                  <div className="quantity-control">
                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(item.requirementId, -1)
                      }
                      aria-label="Decrease quantity"
                    >
                      <Minus size={18} />
                    </button>

                    <strong>{item.actualQty}</strong>

                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(item.requirementId, 1)
                      }
                      aria-label="Increase quantity"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                <label>
                  Condition
                  <select
                    value={item.condition}
                    onChange={(event) =>
                      updateItem(item.requirementId, {
                        condition: event.target.value,
                      })
                    }
                  >
                    <option value="changed">
                      Filters changed
                    </option>
                    <option value="good">
                      Existing filters good
                    </option>
                    <option value="missing">
                      Filter missing
                    </option>
                    <option value="damaged">
                      Equipment damaged
                    </option>
                    <option value="inaccessible">
                      Could not access
                    </option>
                  </select>
                </label>
              </div>

              <label className="worksheet-notes">
                Notes
                <textarea
                  rows={2}
                  value={item.notes}
                  onChange={(event) =>
                    updateItem(item.requirementId, {
                      notes: event.target.value,
                    })
                  }
                  placeholder="Add notes for this location"
                />
              </label>
            </div>
          </article>
        ))}
      </section>

      <section className="visit-notes-card">
        <label>
          Visit notes
          <textarea
            rows={4}
            value={visitNotes}
            onChange={(event) =>
              setVisitNotes(event.target.value)
            }
            placeholder="Add notes about the overall service visit"
          />
        </label>
      </section>

      {saveError ? (
        <div className="form-error">{saveError}</div>
      ) : null}

      <button
        className="primary-action worksheet-finish"
        type="button"
        disabled={saving || !allCompleted}
        onClick={finishVisit}
      >
        {saving ? (
          <>
            <Loader2 className="spin" size={20} />
            Saving visit...
          </>
        ) : (
          <>
            <ClipboardCheck size={20} />
            Finish and save visit
          </>
        )}
      </button>
    </main>
  );
}
