"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ArrowLeft, Building2, Loader2, PackagePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AddType = "filter" | "store";

function AddForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType =
    searchParams.get("type") === "store" ? "store" : "filter";
  const [type, setType] = useState<AddType>(initialType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [filterName, setFilterName] = useState("HVAC Filter");
  const [filterSize, setFilterSize] = useState("");
  const [filterUnit, setFilterUnit] = useState("each");

  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CA");

  async function getWorkspaceId() {
    const storesResult = await supabase
      .from("stores")
      .select("workspace_id")
      .limit(1)
      .maybeSingle();

    if (storesResult.error) throw storesResult.error;
    if (storesResult.data?.workspace_id) {
      return storesResult.data.workspace_id as string;
    }

    const itemsResult = await supabase
      .from("items")
      .select("workspace_id")
      .limit(1)
      .maybeSingle();

    if (itemsResult.error) throw itemsResult.error;
    return (itemsResult.data?.workspace_id as string | undefined) ?? "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const workspaceId = await getWorkspaceId();

      if (!workspaceId) {
        throw new Error(
          "No workspace was found. Add the first workspace in Supabase before adding records.",
        );
      }

      if (type === "filter") {
        if (!filterSize.trim()) {
          throw new Error("Enter the filter size.");
        }

        const result = await supabase.from("items").insert({
          workspace_id: workspaceId,
          name: filterName.trim() || "HVAC Filter",
          size: filterSize.trim(),
          unit: filterUnit,
          active: true,
        });

        if (result.error) throw result.error;
        router.push("/inventory");
      } else {
        if (!storeCode.trim() || !storeName.trim()) {
          throw new Error("Enter both the store number and store name.");
        }

        const result = await supabase.from("stores").insert({
          workspace_id: workspaceId,
          store_code: storeCode.trim(),
          store_name: storeName.trim(),
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim().toUpperCase() || null,
          active: true,
        });

        if (result.error) throw result.error;
        router.push("/stores");
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The new record could not be saved.",
      );
      setSaving(false);
    }
  }

  return (
    <main className="app-shell add-page">
      <Link
        className="back-link"
        href={type === "filter" ? "/inventory" : "/stores"}
      >
        <ArrowLeft size={19} />
        Back
      </Link>

      <header className="topbar">
        <div>
          <p className="eyebrow">Inventory Manager</p>
          <h1>Add New</h1>
          <p className="subtitle">
            Add a filter size or store in a few quick steps.
          </p>
        </div>
      </header>

      <div className="add-type-switch" role="tablist">
        <button
          className={type === "filter" ? "active" : ""}
          type="button"
          onClick={() => {
            setType("filter");
            setError("");
          }}
        >
          <PackagePlus size={20} />
          Filter
        </button>
        <button
          className={type === "store" ? "active" : ""}
          type="button"
          onClick={() => {
            setType("store");
            setError("");
          }}
        >
          <Building2 size={20} />
          Store
        </button>
      </div>

      <form className="add-form" onSubmit={handleSubmit}>
        {type === "filter" ? (
          <>
            <label>
              Filter size
              <input
                autoFocus
                required
                value={filterSize}
                onChange={(event) => setFilterSize(event.target.value)}
                placeholder='Example: 20 × 25 × 2'
              />
            </label>
            <label>
              Item name
              <input
                required
                value={filterName}
                onChange={(event) => setFilterName(event.target.value)}
              />
            </label>
            <label>
              Unit
              <select
                value={filterUnit}
                onChange={(event) => setFilterUnit(event.target.value)}
              >
                <option value="each">Each</option>
                <option value="case">Case</option>
                <option value="box">Box</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <div className="add-form-row">
              <label>
                Store number
                <input
                  autoFocus
                  required
                  value={storeCode}
                  onChange={(event) => setStoreCode(event.target.value)}
                  placeholder="Example: 214"
                />
              </label>
              <label>
                Store name
                <input
                  required
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="Store or company name"
                />
              </label>
            </div>
            <label>
              Street address
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <div className="add-form-row city-state-row">
              <label>
                City
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </label>
              <label>
                State
                <input
                  maxLength={2}
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                />
              </label>
            </div>
          </>
        )}

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-action add-submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="spin" size={20} />
              Saving...
            </>
          ) : type === "filter" ? (
            <>
              <PackagePlus size={20} />
              Add filter
            </>
          ) : (
            <>
              <Building2 size={20} />
              Add store
            </>
          )}
        </button>
      </form>
    </main>
  );
}

export default function AddPage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell inventory-loading">
          <Loader2 className="spin" size={30} />
        </main>
      }
    >
      <AddForm />
    </Suspense>
  );
}
