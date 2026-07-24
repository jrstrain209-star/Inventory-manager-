import Link from "next/link";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Store = {
  id: string;
  store_code: string;
  store_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
};

type Requirement = {
  id: string;
  location: string | null;
  required_qty: number;
  notes: string | null;
  items:
    | {
        id: string;
        name: string;
        size: string | null;
      }
    | {
        id: string;
        name: string;
        size: string | null;
      }[]
    | null;
};

async function getStore(id: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("id, store_code, store_name, address, city, state")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Unable to load store:", error.message);
    return null;
  }

  return data;
}

async function getRequirements(id: string): Promise<Requirement[]> {
  const { data, error } = await supabase
    .from("store_item_requirements")
    .select(
      `
        id,
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
    .eq("store_id", id)
    .order("location");

  if (error) {
    console.error("Unable to load filter requirements:", error.message);
    return [];
  }

  return data ?? [];
}

function getItem(requirement: Requirement) {
  if (Array.isArray(requirement.items)) {
    return requirement.items[0] ?? null;
  }

  return requirement.items;
}

export default async function StoreDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [store, requirements] = await Promise.all([
    getStore(id),
    getRequirements(id),
  ]);

  if (!store) {
    notFound();
  }

  const totalFilters = requirements.reduce(
    (total, requirement) => total + requirement.required_qty,
    0
  );

  return (
    <main className="app-shell">
      <Link className="back-link" href="/stores">
        <ArrowLeft size={19} />
        Back to stores
      </Link>

      <header className="store-detail-header">
        <div className="store-detail-icon">
          <Building2 size={28} />
        </div>

        <div>
          <p className="eyebrow">{store.store_code}</p>
          <h1>{store.store_name}</h1>

          <p className="store-detail-location">
            <MapPin size={17} />
            {[store.address, store.city, store.state]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </header>

      <section className="store-summary">
        <div>
          <span>Filter locations</span>
          <strong>{requirements.length}</strong>
        </div>

        <div>
          <span>Total filters</span>
          <strong>{totalFilters}</strong>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Requirements</p>
            <h2>Filter list</h2>
          </div>
        </div>

        <div className="requirements-list">
          {requirements.length === 0 ? (
            <div className="empty-state">
              <h2>No filters listed</h2>
              <p>This store does not have any filter requirements yet.</p>
            </div>
          ) : (
            requirements.map((requirement) => {
              const item = getItem(requirement);

              return (
                <article className="requirement-card" key={requirement.id}>
                  <div className="requirement-main">
                    <p className="requirement-location">
                      {requirement.location || "Unassigned location"}
                    </p>

                    <h3>{item?.size || item?.name || "Unknown filter"}</h3>

                    {item?.name && item.name !== item.size ? (
                      <p className="requirement-name">{item.name}</p>
                    ) : null}

                    {requirement.notes ? (
                      <p className="requirement-notes">
                        {requirement.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="quantity-badge">
                    <span>Qty</span>
                    <strong>{requirement.required_qty}</strong>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <Link className="primary-action" href={`/stores/${store.id}/service`}>
        Start service worksheet
      </Link>
    </main>
  );
}
